import { useState, useEffect, useRef, useCallback } from "react";
import { AvatarCircle } from "@/components/AvatarCircle";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, Minus, Plus, Settings2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { useSyncItemParticipants } from "@/hooks/useApi";
import type { ExpenseItemResponse, SimpleProfile } from "@/lib/api/types";
import { toast } from "@/hooks/use-toast";

interface ItemParticipantManagerProps {
  item: ExpenseItemResponse;
  expenseId: string;
  availableParticipants: SimpleProfile[];
  isConfirmed: boolean;
  currency: string;
  isReadOnly?: boolean;
}

// Map of profileId -> weight (presence means selected, weight >= 1)
type ParticipantWeights = Record<string, number>;

// Helper to convert participant response to weight map
function participantsToWeights(
  participants: ExpenseItemResponse["participants"] | undefined,
): ParticipantWeights {
  if (!participants) return {};
  return participants.reduce<ParticipantWeights>((acc, p) => {
    // Default to weight 1 if not provided or 0
    acc[p.profile.id] = p.weight > 0 ? p.weight : 1;
    return acc;
  }, {});
}

// Helper to check if any weight > 1
function hasCustomWeights(weights: ParticipantWeights): boolean {
  return Object.values(weights).some((w) => w > 1);
}

// Helper to get sorted IDs for comparison
function getWeightsKey(weights: ParticipantWeights): string {
  return Object.entries(weights)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, w]) => `${id}:${w}`)
    .join(",");
}

export function ItemParticipantManager({
  item,
  expenseId,
  availableParticipants,
  isConfirmed,
  currency,
  isReadOnly = false,
}: Readonly<ItemParticipantManagerProps>) {
  const canEdit = !isConfirmed && !isReadOnly;
  const syncParticipants = useSyncItemParticipants(expenseId, item.id);

  // Weight-based state: presence in map = selected, value = weight
  const initialWeights = participantsToWeights(item.participants);

  // Show advanced mode if any weight > 1 on initial load
  const [showAdvanced, setShowAdvanced] = useState(() =>
    hasCustomWeights(initialWeights),
  );

  const [weights, setWeights] = useState<ParticipantWeights>(initialWeights);
  const [isSyncing, setIsSyncing] = useState(false);

  // Debounce the weights for sync
  const debouncedWeights = useDebounce(weights, 500);

  // Track if this is the initial render to avoid syncing on mount
  const isFirstRender = useRef(true);

  // Track the last known state on the server
  const serverWeightsRef = useRef<ParticipantWeights>(initialWeights);

  // Toggle handler - adds with weight 1 or removes entirely
  const handleToggle = useCallback(
    (profileId: string) => {
      if (!canEdit) return;

      setWeights((prev) => {
        const newWeights = { ...prev };
        if (profileId in newWeights) {
          delete newWeights[profileId];
        } else {
          newWeights[profileId] = 1;
        }
        return newWeights;
      });
    },
    [canEdit],
  );

  // Weight adjustment handler
  const handleWeightChange = useCallback(
    (profileId: string, delta: number) => {
      if (!canEdit) return;

      setWeights((prev) => {
        if (!(profileId in prev)) return prev;
        const newWeight = Math.max(1, prev[profileId] + delta);
        return { ...prev, [profileId]: newWeight };
      });
    },
    [canEdit],
  );

  // Effect to sync when debounced weights change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const currentKey = getWeightsKey(debouncedWeights);
    const serverKey = getWeightsKey(serverWeightsRef.current);

    // Ignore if debounced state matches server
    if (currentKey === serverKey) {
      return;
    }

    const sync = async () => {
      setIsSyncing(true);
      try {
        const participantsRequest = Object.entries(debouncedWeights).map(
          ([profileId, weight]) => ({
            profileId,
            weight,
          }),
        );

        await syncParticipants.mutateAsync({
          participants: participantsRequest,
        });

        // Update server ref after successful mutation
        serverWeightsRef.current = { ...debouncedWeights };
      } catch (error) {
        console.error("Failed to sync participants", error);
        toast({
          variant: "destructive",
          title: "Failed to update participants",
          description: "Could not save changes. Please try again.",
        });
        // Revert to last known server state
        setWeights(serverWeightsRef.current);
      } finally {
        setIsSyncing(false);
      }
    };

    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedWeights]);

  // Track the most recent version of props we have processed
  const lastPropWeightsRef = useRef<ParticipantWeights>(initialWeights);

  // Update local state if props change (e.g. from websocket or other updates)
  useEffect(() => {
    const propWeights = participantsToWeights(item.participants);
    const propKey = getWeightsKey(propWeights);
    const lastKey = getWeightsKey(lastPropWeightsRef.current);

    const propsChanged = propKey !== lastKey;

    // Update references to current server truth
    lastPropWeightsRef.current = propWeights;
    serverWeightsRef.current = propWeights;

    // Only update local weights if props actually changed AND user is idle
    if (
      propsChanged &&
      !isSyncing &&
      getWeightsKey(weights) === getWeightsKey(debouncedWeights)
    ) {
      setWeights(propWeights);
      // Update showAdvanced based on new weights
      if (hasCustomWeights(propWeights)) {
        setShowAdvanced(true);
      }
    }
  }, [item.participants, isSyncing, weights, debouncedWeights]);

  // Filter weights against availableParticipants
  useEffect(() => {
    const availableIds = new Set(availableParticipants.map((p) => p.id));
    const filteredWeights: ParticipantWeights = {};
    let hasChange = false;

    for (const [id, weight] of Object.entries(weights)) {
      if (availableIds.has(id)) {
        filteredWeights[id] = weight;
      } else {
        hasChange = true;
      }
    }

    if (hasChange) {
      setWeights(filteredWeights);
    }
  }, [availableParticipants, weights]);

  // Calculate total weight for split preview
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const itemAmount = (Number.parseFloat(item.amount) || 0) * item.quantity;

  // Check if any weight is different from 1 (show advanced indicator)
  const hasCustomWeightsFlag = hasCustomWeights(weights);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Split between:</p>
        <div className="flex items-center gap-2">
          {canEdit && Object.keys(weights).length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings2 className="h-3 w-3 mr-1" />
              {showAdvanced ? "Simple" : "Adjust split"}
            </Button>
          )}
          {isSyncing && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {availableParticipants.map((participant) => {
          const isSelected = participant.id in weights;
          const weight = weights[participant.id] || 0;
          const shareAmount =
            totalWeight > 0 ? (weight / totalWeight) * itemAmount : 0;

          if (!canEdit && !isSelected) return null;

          return (
            <div
              key={participant.id}
              className="flex flex-col items-center gap-1"
            >
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => handleToggle(participant.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1 border transition-colors",
                  isSelected && "border-primary bg-primary/10 text-primary",
                  !isSelected &&
                    !canEdit &&
                    "border-border/50 opacity-50 cursor-not-allowed",
                  !isSelected &&
                    canEdit &&
                    "border-border/50 hover:border-border",
                )}
              >
                {canEdit && (
                  <Checkbox
                    checked={isSelected}
                    className="h-3 w-3 pointer-events-none"
                  />
                )}
                <AvatarCircle
                  name={participant.name}
                  imageUrl={participant.avatar}
                  size="xs"
                />
                <span className="text-sm">
                  {participant.isUser ? "You" : participant.name}
                </span>
                {isSelected && hasCustomWeightsFlag && !showAdvanced && (
                  <span className="text-xs text-muted-foreground">
                    ×{weight}
                  </span>
                )}
              </button>

              {/* Advanced weight controls */}
              {showAdvanced && isSelected && canEdit && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleWeightChange(participant.id, -1)}
                    disabled={weight <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-medium w-6 text-center">
                    {weight}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleWeightChange(participant.id, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Share amount preview */}
              {isSelected && totalWeight > 0 && (
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(shareAmount, currency)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Info text for advanced mode */}
      {showAdvanced && Object.keys(weights).length > 0 && (
        <p className="text-xs text-muted-foreground">
          Units decide how the total is divided. Equal units = equal split.
        </p>
      )}
    </div>
  );
}
