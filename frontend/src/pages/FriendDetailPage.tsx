import { Activity, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useFriendship } from "@/hooks/useApi";
import { AvatarCircle } from "@/components/AvatarCircle";
import { AmountDisplay } from "@/components/AmountDisplay";
import { TransactionModal } from "@/components/TransactionModal";
import { AssociateProfileModal } from "@/components/AssociateProfileModal";
import { TransferMethodsModal } from "@/components/TransferMethodsModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Link2, CreditCard, Share2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { shareFriendProfile } from "@/utils/share";
import { useToast } from "@/hooks/use-toast";
import { FriendBalanceSection } from "@/components/FriendBalanceSection";

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function FriendDetailPage() {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const {
    data: friendship,
    isLoading,
    error,
    isError,
  } = useFriendship(friendId || "");
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [associateOpen, setAssociateOpen] = useState(false);
  const [transferMethodsOpen, setTransferMethodsOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const balancesPerCurrency = friendship?.balancesPerCurrency || {};
  const currencies = Object.keys(balancesPerCurrency);
  const hasMultipleCurrencies = currencies.length > 1;
  const activeCurrency = currencies[0] || user?.homeCurrency || "IDR";
  const activeBalance =
    balancesPerCurrency[activeCurrency] || friendship?.balance;
  const balance = Number.parseFloat(activeBalance?.netBalance || "0");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!friendship) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Friend not found</p>
        <Link to="/friends">
          <Button variant="link">Back to Friends</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Back Link */}
      <Link
        to="/friends"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Friends
      </Link>

      {/* Friend Header */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <AvatarCircle
              name={friendship.friend.name}
              imageUrl={friendship.friend.avatar}
              size="xl"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-display font-bold">
                  {friendship.friend.name}
                </h1>
                <Activity
                  mode={
                    friendship.friend.type === "ANON" ? "visible" : "hidden"
                  }
                >
                  <Badge variant="secondary">Anonymous</Badge>
                </Activity>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Friends since {formatDate(friendship.friend.createdAt)}
              </p>
              <Activity
                mode={friendship.friend.type === "ANON" ? "visible" : "hidden"}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setAssociateOpen(true)}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Link to Real Profile
                </Button>
              </Activity>
              <Activity
                mode={
                  friendship.friend.type === "ANON" && friendship.friend.slug
                    ? "visible"
                    : "hidden"
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 ml-2"
                  onClick={async () => {
                    try {
                      const result = await shareFriendProfile(
                        friendship.friend.name,
                        friendship.friend.slug,
                        balancesPerCurrency,
                      );
                      if (result === "copied") {
                        toast({ title: "Copied to clipboard" });
                      }
                      if (result === "cancelled") {
                        return;
                      }
                    } catch {
                      toast({
                        title: "Failed to share",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </Activity>
            </div>
            <Activity mode={hasMultipleCurrencies ? "hidden" : "visible"}>
              <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                <AmountDisplay
                  amount={balance}
                  currency={activeCurrency}
                  size="lg"
                  showLabel
                />
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setTransferMethodsOpen(true)}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Transfer Methods
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => setTransactionOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Record Transaction
                  </Button>
                </div>
              </div>
            </Activity>
            <Activity mode={hasMultipleCurrencies ? "visible" : "hidden"}>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setTransferMethodsOpen(true)}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Transfer Methods
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => setTransactionOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Record Transaction
                </Button>
              </div>
            </Activity>
          </div>
        </CardContent>
      </Card>

      <FriendBalanceSection
        balancesPerCurrency={balancesPerCurrency}
        friendName={friendship.friend.name}
        defaultCurrency={user?.homeCurrency || "IDR"}
        isLoading={isLoading}
        error={error}
        isError={isError}
        onRecordTransaction={() => setTransactionOpen(true)}
      />

      <TransactionModal
        open={transactionOpen}
        onOpenChange={setTransactionOpen}
        defaultFriendId={friendship.friend.profileId}
      />

      <AssociateProfileModal
        open={associateOpen}
        onOpenChange={setAssociateOpen}
        anonProfileId={friendship.friend.profileId}
        anonProfileName={friendship.friend.name}
        onSuccess={() => navigate(`/friends`)}
      />

      <TransferMethodsModal
        open={transferMethodsOpen}
        onOpenChange={setTransferMethodsOpen}
        profileId={friendship.friend.profileId}
        profileName={friendship.friend.name}
      />
    </div>
  );
}
