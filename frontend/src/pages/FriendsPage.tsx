import { useState } from "react";
import { AddFriendModal } from "@/components/AddFriendModal";
import {
  useFriendships,
  useFriendRequests,
  useAcceptFriendRequest,
  useIgnoreFriendRequest,
  useCancelFriendRequest,
  useBlockFriendRequest,
  useUnblockFriendRequest,
} from "@/hooks/useApi";
import { AvatarCircle } from "@/components/AvatarCircle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Users,
  UserCheck,
  Clock,
  Loader2,
  Ban,
  ShieldOff,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AmountDisplay } from "@/components/AmountDisplay";

export default function FriendsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const homeCurrency = user?.homeCurrency || "IDR";

  const activeTab = searchParams.get("tab") || "all";

  const { data: friendships, isLoading } = useFriendships();
  const { sent, received } = useFriendRequests();
  const acceptFriendRequest = useAcceptFriendRequest();
  const ignoreFriendRequest = useIgnoreFriendRequest();
  const cancelFriendRequest = useCancelFriendRequest();
  const blockFriendRequest = useBlockFriendRequest();
  const unblockFriendRequest = useUnblockFriendRequest();
  const { toast } = useToast();

  const filteredFriends = friendships?.filter((f) =>
    f.profileName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequest.mutateAsync(requestId);
      toast({
        title: "Request accepted",
        description: "You are now friends",
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        variant: "destructive",
        title: "Failed to accept request",
        description: err.message || "Something went wrong",
      });
    }
  };

  const handleIgnoreRequest = async (requestId: string) => {
    try {
      await ignoreFriendRequest.mutateAsync(requestId);
      toast({
        title: "Request ignored",
        description: "The request has been removed",
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        variant: "destructive",
        title: "Failed to ignore request",
        description: err.message || "Something went wrong",
      });
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      await cancelFriendRequest.mutateAsync(requestId);
      toast({
        title: "Request cancelled",
        description: "The request has been cancelled",
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        variant: "destructive",
        title: "Failed to cancel request",
        description: err.message || "Something went wrong",
      });
    }
  };

  const handleBlockRequest = async (requestId: string) => {
    try {
      await blockFriendRequest.mutateAsync(requestId);
      toast({
        title: "Request blocked",
        description: "The user has been blocked",
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        variant: "destructive",
        title: "Failed to block request",
        description: err.message || "Something went wrong",
      });
    }
  };

  const handleUnblockRequest = async (requestId: string) => {
    try {
      await unblockFriendRequest.mutateAsync(requestId);
      toast({
        title: "Request unblocked",
        description: "The user has been unblocked",
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        variant: "destructive",
        title: "Failed to unblock request",
        description: err.message || "Something went wrong",
      });
    }
  };

  const activeReceivedRequests =
    received.data?.filter((r) => !r.isBlocked) || [];
  const blockedRequests = received.data?.filter((r) => r.isBlocked) || [];
  const pendingCount = activeReceivedRequests.length;

  const allFriendsTabContent = () => {
    if (isLoading)
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {new Array(6).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      );

    if (filteredFriends?.length > 0)
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filteredFriends.map((friendship) => {
            const balances = friendship.balancesPerCurrency ?? {};
            const currencyKeys = Object.keys(balances);
            const hasHome = homeCurrency in balances;
            const displayCurrency = hasHome
              ? homeCurrency
              : (currencyKeys[0] ?? homeCurrency);
            const parsed = Number.parseFloat(balances[displayCurrency] ?? "0");
            const displayAmount = Number.isFinite(parsed) ? parsed : 0;
            const otherCount = currencyKeys.filter(
              (c) => c !== displayCurrency,
            ).length;
            const showBalance = displayAmount !== 0 || otherCount > 0;

            return (
              <Link key={friendship.id} to={`/friends/${friendship.id}`}>
                <Card className="border-border/50 hover:border-border transition-colors h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <AvatarCircle
                        name={friendship.profileName}
                        imageUrl={friendship.profileAvatar}
                        size="lg"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {friendship.profileName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {friendship.type === "ANON" ? (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded">
                              Anonymous
                            </span>
                          ) : (
                            <span className="text-xs text-success flex items-center gap-1">
                              <UserCheck className="h-3 w-3" />
                              Connected
                            </span>
                          )}
                        </div>
                      </div>
                      {showBalance && (
                        <div className="shrink-0 flex flex-col items-end gap-0.5">
                          {displayAmount !== 0 && (
                            <AmountDisplay
                              amount={displayAmount}
                              currency={displayCurrency}
                              size="sm"
                            />
                          )}
                          {otherCount > 0 && (
                            <span className="text-xs text-muted-foreground">
                              & {otherCount} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      );

    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-1">No friends yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Add friends to start tracking expenses together
          </p>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add your first friend
          </Button>
        </CardContent>
      </Card>
    );
  };

  const receivedRequestsTabContent = () => {
    if (received.isLoading)
      return (
        <div className="space-y-3">
          {new Array(2).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      );

    if (activeReceivedRequests.length > 0)
      return (
        <div className="space-y-3">
          {activeReceivedRequests.map((request) => (
            <div
              key={request.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
            >
              <AvatarCircle
                name={request.senderName}
                imageUrl={request.senderAvatar}
                size="md"
              />
              <div className="flex-1">
                <p className="font-medium">{request.senderName}</p>
                <p className="text-xs text-muted-foreground">
                  Sent {new Date(request.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => handleBlockRequest(request.id)}
                  disabled={blockFriendRequest.isPending}
                  title="Block user"
                >
                  {blockFriendRequest.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Ban className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleIgnoreRequest(request.id)}
                  disabled={ignoreFriendRequest.isPending}
                >
                  {ignoreFriendRequest.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Ignore"
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAcceptRequest(request.id)}
                  disabled={acceptFriendRequest.isPending}
                >
                  {acceptFriendRequest.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Accept"
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      );

    return (
      <p className="text-center text-muted-foreground py-8">
        No pending requests
      </p>
    );
  };

  const blockedRequestsTabContent = () => {
    if (received.isLoading)
      return (
        <div className="space-y-3">
          {new Array(2).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      );

    if (blockedRequests.length > 0)
      return (
        <div className="space-y-3">
          {blockedRequests.map((request) => (
            <div
              key={request.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
            >
              <AvatarCircle
                name={request.senderName}
                imageUrl={request.senderAvatar}
                size="md"
              />
              <div className="flex-1">
                <p className="font-medium">{request.senderName}</p>
                <p className="text-xs text-muted-foreground">
                  Blocked{" "}
                  {request.blockedAt
                    ? new Date(request.blockedAt).toLocaleDateString()
                    : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleUnblockRequest(request.id)}
                disabled={unblockFriendRequest.isPending}
              >
                {unblockFriendRequest.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4 mr-1" />
                    Unblock
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      );

    return (
      <p className="text-center text-muted-foreground py-8">
        No blocked requests
      </p>
    );
  };

  const sentRequestsTabContent = () => {
    if (sent?.isLoading)
      return (
        <div className="space-y-3">
          {new Array(2).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      );

    if (sent?.data?.length > 0)
      return (
        <div className="space-y-3">
          {sent.data.map((request) => (
            <div
              key={request.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
            >
              <AvatarCircle
                name={request.recipientName}
                imageUrl={request.recipientAvatar}
                size="md"
              />
              <div className="flex-1">
                <p className="font-medium">{request.recipientName}</p>
                <p className="text-xs text-muted-foreground">
                  Pending since{" "}
                  {new Date(request.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => handleCancelRequest(request.id)}
                disabled={cancelFriendRequest.isPending}
              >
                {cancelFriendRequest.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Cancel"
                )}
              </Button>
            </div>
          ))}
        </div>
      );

    return (
      <p className="text-center text-muted-foreground py-8">No sent requests</p>
    );
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">
            Friends
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your connections and track balances
          </p>
        </div>
        <Button variant="premium" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Friend
        </Button>
      </div>

      <AddFriendModal open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search friends..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setSearchParams({ tab: value })}
      >
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <Users className="h-4 w-4" />
            All Friends
            {friendships && (
              <span className="text-xs bg-muted px-1.5 rounded">
                {friendships.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <Clock className="h-4 w-4" />
            Requests
            {pendingCount > 0 && (
              <span className="text-xs bg-primary text-primary-foreground px-1.5 rounded">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {allFriendsTabContent()}
        </TabsContent>

        <TabsContent value="requests" className="mt-6 space-y-6">
          {/* Received Requests */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-display">
                Received Requests
              </CardTitle>
            </CardHeader>
            <CardContent>{receivedRequestsTabContent()}</CardContent>
          </Card>

          {/* Sent Requests */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-display">
                Sent Requests
              </CardTitle>
            </CardHeader>
            <CardContent>{sentRequestsTabContent()}</CardContent>
          </Card>

          {/* Blocked Requests */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Ban className="h-5 w-5 text-destructive" />
                Blocked Requests
              </CardTitle>
            </CardHeader>
            <CardContent>{blockedRequestsTabContent()}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
