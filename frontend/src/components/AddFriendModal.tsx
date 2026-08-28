import { useState } from "react";
import {
  useSearchProfiles,
  useSendFriendRequest,
} from "@/hooks/useApi";
import { AvatarCircle } from "@/components/AvatarCircle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { InlineAnonymousFriendForm } from "./InlineAnonymousFriendForm";

interface AddFriendModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function AddFriendModal({ open, onOpenChange }: AddFriendModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingRequestIds, setPendingRequestIds] = useState<Set<string>>(
    new Set()
  );

  const { data: searchResults, isLoading: searching } =
    useSearchProfiles(searchQuery);
  const sendFriendRequest = useSendFriendRequest();
  const { toast } = useToast();

  const handleAnonymousCreated = () => {
    onOpenChange(false);
  };

  const handleSendFriendRequest = async (profileId: string) => {
    setPendingRequestIds((prev) => new Set(prev).add(profileId));
    try {
      await sendFriendRequest.mutateAsync(profileId);
      toast({
        title: "Request sent",
        description: "Friend request has been sent",
      });
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        variant: "destructive",
        title: "Failed to send request",
        description: err.message || "Something went wrong",
      });
    } finally {
      setPendingRequestIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Add a Friend</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="anonymous" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="anonymous">Anonymous</TabsTrigger>
            <TabsTrigger value="search">Search Users</TabsTrigger>
          </TabsList>
          <TabsContent value="anonymous" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Create a friend profile for someone who isn't on Cashus yet
            </p>
            <InlineAnonymousFriendForm onCreated={handleAnonymousCreated} />
          </TabsContent>
          <TabsContent value="search" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or username..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {searchResults && searchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50"
                  >
                    <AvatarCircle
                      name={profile.name}
                      imageUrl={profile.avatar}
                      size="sm"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{profile.name}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendFriendRequest(profile.id)}
                      disabled={pendingRequestIds.has(profile.id)}
                    >
                      {pendingRequestIds.has(profile.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 &&
              !searching &&
              searchResults?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No users found
                </p>
              )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
