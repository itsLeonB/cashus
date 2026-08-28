import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarCircle } from "@/components/AvatarCircle";
import { useSearchProfiles, useAssociateProfile } from "@/hooks/useApi";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Link2, UserCheck } from "lucide-react";

interface AssociateProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anonProfileId: string;
  anonProfileName: string;
  onSuccess?: () => void;
}

export function AssociateProfileModal({
  open,
  onOpenChange,
  anonProfileId,
  anonProfileName,
  onSuccess,
}: Readonly<AssociateProfileModalProps>) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: profiles, isLoading: isSearching } =
    useSearchProfiles(searchQuery);
  const { toast } = useToast();
  const { mutate: associateProfile, isPending: isAssociating } =
    useAssociateProfile();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  );

  const handleAssociate = (realProfileId: string) => {
    setSelectedProfileId(realProfileId);

    associateProfile(
      { realProfileId, anonProfileId },
      {
        onSuccess: () => {
          toast({
            title: "Profile linked",
            description: `${anonProfileName} has been linked to the selected profile.`,
          });
          onOpenChange(false);
          if (onSuccess) {
            onSuccess();
          }
        },
        onError: (error: unknown) => {
          const err = error as { message?: string };
          toast({
            variant: "destructive",
            title: "Failed to link profile",
            description: err.message || "Something went wrong",
          });
        },
        onSettled: () => {
          setSelectedProfileId(null);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Link to Real Profile
          </DialogTitle>
          <DialogDescription>
            Search for a registered user to link "{anonProfileName}" to their
            real profile. All transactions will be transferred.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {searchQuery.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Type at least 2 characters to search
              </p>
            )}

            {isSearching && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {profiles?.length === 0 && searchQuery.length >= 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No users found
              </p>
            )}

            {profiles?.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AvatarCircle
                    name={profile.name}
                    imageUrl={profile.avatar}
                    size="sm"
                  />
                  <div>
                    <p className="font-medium">{profile.name}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAssociate(profile.id)}
                  disabled={isAssociating}
                >
                  {isAssociating && selectedProfileId === profile.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-1" />
                      Link
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
