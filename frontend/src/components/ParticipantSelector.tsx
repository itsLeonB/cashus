import { useState, useEffect, useMemo } from "react";
import { Loader2, Users, Check, CreditCard, Plus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarCircle } from "./AvatarCircle";
import { InlineAnonymousFriendForm } from "./InlineAnonymousFriendForm";
import { cn } from "@/lib/utils";
import { useSyncParticipants, useFriendships } from "@/hooks/useApi";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ParticipantProfile {
  profileId: string;
  name: string;
  avatar?: string | null;
}

interface ParticipantSelectorProps {
  expenseId?: string;
  currentParticipants?: ParticipantProfile[];
  currentPayerId?: string | null;
  currentProxyMap?: Record<string, string>;
  onSuccess?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  showSkip?: boolean;
  onSkip?: () => void;
  enableProxySelection?: boolean;
}

const EMPTY_PARTICIPANTS: ParticipantProfile[] = [];
const EMPTY_PROXY_MAP: Record<string, string> = {};

export function ParticipantSelector({
  expenseId,
  currentParticipants = EMPTY_PARTICIPANTS,
  currentPayerId = null,
  currentProxyMap = EMPTY_PROXY_MAP,
  onSuccess,
  onCancel,
  submitLabel = "Continue",
  showSkip = false,
  onSkip,
  enableProxySelection = false,
}: Readonly<ParticipantSelectorProps>) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    () => {
      if (currentParticipants.length > 0) {
        return currentParticipants.map((p) => p.profileId);
      }
      return user?.id ? [user.id] : [];
    },
  );
  const [payerProfileId, setPayerProfileId] = useState<string | null>(
    () => currentPayerId ?? (user?.id || null),
  );
  // proxyMap: participantId -> proxyProfileId
  const [proxyMap, setProxyMap] = useState<Record<string, string>>(
    () => currentProxyMap,
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const { data: friendships, isLoading, refetch } = useFriendships();
  const syncParticipants = useSyncParticipants(expenseId || "");

  // Capture initial selection for stable sorting across renders while mounted
  const initialSelectionAtOpen = useMemo(() => {
    let ids: string[] = [];
    if (currentParticipants.length > 0) {
      ids = currentParticipants.map((p) => p.profileId);
    } else if (user?.id) {
      ids = [user.id];
    }
    return new Set(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only capture once on mount to ensure stable ordering during interaction

  const handleAnonymousFriendCreated = async (profileId: string) => {
    await refetch();
    setSelectedParticipants((prev) => [...prev, profileId]);
    setShowAddForm(false);
  };

  useEffect(() => {
    if (expenseId) {
      setSelectedParticipants(currentParticipants.map((p) => p.profileId));
      setPayerProfileId(currentPayerId);
      setProxyMap(currentProxyMap);
    } else if (user?.id) {
      setSelectedParticipants((prev) => (prev.length === 0 ? [user.id] : prev));
      setPayerProfileId((prev) => prev ?? user.id);
    }
  }, [
    expenseId,
    user?.id,
    currentParticipants,
    currentPayerId,
    currentProxyMap,
  ]);

  const toggleParticipant = (profileId: string) => {
    setSelectedParticipants((prev) => {
      const next = prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId];

      if (payerProfileId === profileId && !next.includes(profileId)) {
        setPayerProfileId(null);
      }

      return next;
    });

    // Clean up proxy references when removing a participant
    setProxyMap((prev) => {
      const next = { ...prev };
      // Remove proxy assignment for this participant
      delete next[profileId];
      // Remove any proxy pointing to this participant
      for (const [key, value] of Object.entries(next)) {
        if (value === profileId) {
          delete next[key];
        }
      }
      return next;
    });
  };

  const selectPayer = (profileId: string) => {
    setPayerProfileId(profileId);
    if (!selectedParticipants.includes(profileId)) {
      setSelectedParticipants((prev) => [...prev, profileId]);
    }

    // Clear proxy assignment if this person becomes the payer
    setProxyMap((prev) => {
      const next = { ...prev };
      delete next[profileId];
      return next;
    });
  };

  const handleProxyChange = (participantId: string, proxyId: string) => {
    setProxyMap((prev) => {
      const next = { ...prev };
      if (proxyId === "self" || proxyId === participantId) {
        delete next[participantId];
      } else {
        // Validate: no proxy chains (the selected proxy must not itself have a proxy)
        if (next[proxyId]) {
          toast({
            variant: "destructive",
            title: "Invalid proxy",
            description: "A proxy cannot have another proxy assigned to them.",
          });
          return prev;
        }
        next[participantId] = proxyId;
      }
      return next;
    });
  };

  const allProfiles = useMemo(
    () => [
      ...(user
        ? [
            {
              profileId: user.id,
              profileName: user.name,
              profileAvatar: user.avatar,
              isUser: true,
            },
          ]
        : []),
      ...(friendships?.map((f) => ({
        profileId: f.profileId,
        profileName: f.profileName,
        profileAvatar: f.profileAvatar,
        isUser: false,
      })) || []),
    ],
    [user, friendships],
  );

  const selectableProfiles = useMemo(() => {
    const selected: typeof allProfiles = [];
    const unselected: typeof allProfiles = [];
    for (const profile of allProfiles) {
      if (initialSelectionAtOpen.has(profile.profileId)) {
        selected.push(profile);
      } else {
        unselected.push(profile);
      }
    }
    return [...selected, ...unselected];
  }, [allProfiles, initialSelectionAtOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!payerProfileId || !selectedParticipants.includes(payerProfileId)) {
      toast({
        variant: "destructive",
        title: "Missing payer",
        description: "Please select one of the participants as the payer",
      });
      return;
    }

    if (selectedParticipants.length === 0) {
      toast({
        variant: "destructive",
        title: "No participants",
        description: "Please select at least one participant",
      });
      return;
    }

    if (!expenseId) {
      onSuccess?.();
      return;
    }

    // Build proxyByProfileIds: only entries with valid proxy
    const proxyByProfileIds: Record<string, string> = {};
    for (const [participantId, proxyId] of Object.entries(proxyMap)) {
      if (
        proxyId &&
        proxyId !== participantId &&
        selectedParticipants.includes(participantId) &&
        selectedParticipants.includes(proxyId)
      ) {
        proxyByProfileIds[participantId] = proxyId;
      }
    }

    try {
      await syncParticipants.mutateAsync({
        participantProfileIds: selectedParticipants,
        proxyByProfileIds,
        payerProfileId,
      });
      toast({ title: "Participants updated successfully" });
      onSuccess?.();
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        variant: "destructive",
        title: "Failed to update participants",
        description: err.message || "Something went wrong",
      });
    }
  };

  const participantsList = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (selectableProfiles.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No friends found</p>
          <p className="text-xs">Add friends to include them in expenses</p>
        </div>
      );
    }

    const payerName = selectableProfiles.find(
      (p) => p.profileId === payerProfileId,
    )?.profileName;

    // Get selected profile details for proxy options
    const selectedProfileDetails = selectableProfiles.filter((p) =>
      selectedParticipants.includes(p.profileId),
    );

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {selectableProfiles.map((profile) => {
            const isSelected = selectedParticipants.includes(profile.profileId);
            const isPayer = payerProfileId === profile.profileId;
            const currentProxy = proxyMap[profile.profileId];
            const hasProxy = isSelected && !!currentProxy;

            // Proxy options: other selected participants who don't already have a proxy themselves
            // AND are not the payer (proxying to the payer is technically redundant/invalid per requirement)
            const proxyOptions = selectedProfileDetails.filter(
              (p) =>
                p.profileId !== profile.profileId &&
                p.profileId !== payerProfileId &&
                !proxyMap[p.profileId],
            );

            return (
              <div key={profile.profileId} className="space-y-1">
                <div
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                  onClick={() => toggleParticipant(profile.profileId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleParticipant(profile.profileId);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-5 w-5 rounded border flex items-center justify-center transition-colors",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground hover:border-primary",
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <AvatarCircle
                      name={profile.profileName}
                      imageUrl={profile.profileAvatar}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {profile.profileName}
                        {profile.isUser && (
                          <span className="text-muted-foreground ml-1">
                            (You)
                          </span>
                        )}
                      </p>
                      {hasProxy && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Covered by{" "}
                          {selectedProfileDetails.find(
                            (p) => p.profileId === currentProxy,
                          )?.profileName || "unknown"}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={isPayer ? "default" : "outline"}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectPayer(profile.profileId);
                    }}
                    className="gap-1 relative z-10"
                  >
                    <CreditCard className="h-3 w-3" />
                    {isPayer ? "Payer" : "Set as Payer"}
                  </Button>
                </div>

                {/* Proxy selector - only show for selected participants who are not the payer */}
                {enableProxySelection &&
                  isSelected &&
                  !isPayer &&
                  proxyOptions.length > 0 && (
                    <div
                      className="flex items-center gap-2 pl-11 pr-3 pb-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        Paid by:
                      </span>
                      <Select
                        value={currentProxy || "self"}
                        onValueChange={(value) =>
                          handleProxyChange(profile.profileId, value)
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="self">Self</SelectItem>
                          {proxyOptions.map((opt) => (
                            <SelectItem
                              key={opt.profileId}
                              value={opt.profileId}
                            >
                              {opt.isUser ? "You" : opt.profileName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
              </div>
            );
          })}
        </div>

        {selectedParticipants.length > 0 && !payerProfileId && (
          <div className="text-xs text-destructive font-medium px-1">
            Please select which participant paid for this expense
          </div>
        )}

        {selectedParticipants.length > 0 && payerProfileId && (
          <div className="text-sm text-muted-foreground px-1">
            {selectedParticipants.length} participant
            {selectedParticipants.length !== 1 && "s"} selected
            {payerName && ` • Payer: ${payerName}`}
          </div>
        )}

        <div className="flex gap-2">
          {showSkip && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onSkip}
            >
              Skip
            </Button>
          )}
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            className="flex-1"
            disabled={
              syncParticipants.isPending ||
              selectedParticipants.length === 0 ||
              !payerProfileId ||
              !selectedParticipants.includes(payerProfileId)
            }
          >
            {syncParticipants.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {submitLabel}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <>
      {showAddForm ? (
        <InlineAnonymousFriendForm
          onCreated={handleAnonymousFriendCreated}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-3 w-full p-3 rounded-lg border border-dashed border-muted-foreground/50 hover:border-primary/50 hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
        >
          <div className="h-5 w-5 rounded border border-dashed border-current flex items-center justify-center">
            <Plus className="h-3 w-3" />
          </div>
          <span className="text-sm">Create new friend</span>
        </button>
      )}
      {participantsList()}
    </>
  );
}
