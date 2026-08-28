import { useState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateAnonymousFriend } from "@/hooks/useApi";
import { useToast } from "@/hooks/use-toast";

interface InlineAnonymousFriendFormProps {
  readonly onCreated?: (profileId: string) => void;
  readonly onCancel?: () => void;
}

export function InlineAnonymousFriendForm({
  onCreated,
  onCancel,
}: InlineAnonymousFriendFormProps) {
  const [name, setName] = useState("");
  const createAnonymousFriend = useCreateAnonymousFriend();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      const result = await createAnonymousFriend.mutateAsync({ name: name.trim() });
      toast({
        title: "Friend added",
        description: `${name} has been added`,
      });
      setName("");
      onCreated?.(result.profileId);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        variant: "destructive",
        title: "Failed to add friend",
        description: err.message || "Something went wrong",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    } else if (e.key === "Escape") {
      onCancel?.();
    }
  };

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-primary/50 bg-primary/5">
      <Input
        placeholder="Enter name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 h-8"
        autoFocus
        disabled={createAnonymousFriend.isPending}
      />
      <Button
        type="button"
        size="sm"
        onClick={handleCreate}
        disabled={!name.trim() || createAnonymousFriend.isPending}
      >
        {createAnonymousFriend.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
      </Button>
      {onCancel && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={createAnonymousFriend.isPending}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
