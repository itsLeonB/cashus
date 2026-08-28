import { Activity } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { publicApi } from "@/lib/api/public";
import { AvatarCircle } from "@/components/AvatarCircle";
import { AmountDisplay } from "@/components/AmountDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { UserPlus } from "lucide-react";
import { FriendBalanceSection } from "@/components/FriendBalanceSection";
import { Seo } from "@/components/Seo";

export default function PublicFriendPage() {
  const { slug } = useParams<{ slug: string }>();

  const {
    data: friendship,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["public-profile", slug],
    queryFn: () => publicApi.getProfileBySlug(slug),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        <Seo title="Shared Profile" noindex />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !friendship) {
    return (
      <div className="max-w-3xl mx-auto p-4 text-center py-16">
        <Seo title="Shared Profile" noindex />
        <p className="text-muted-foreground mb-4">
          {(error as { message?: string })?.message || "Profile not found"}
        </p>
        <Link to="/">
          <Button variant="link">Go to Home</Button>
        </Link>
      </div>
    );
  }

  const balancesPerCurrency = friendship.balancesPerCurrency || {};
  const currencies = Object.keys(balancesPerCurrency);
  const hasMultipleCurrencies = currencies.length > 1;
  const activeCurrency = currencies[0] || "IDR";
  const activeBalance = balancesPerCurrency[activeCurrency];
  const balance = Number.parseFloat(activeBalance?.netBalance || "0");

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6 animate-fade-up">
      <Seo title="Shared Profile" noindex />
      {/* Header */}
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
                <Badge variant="secondary">Shared</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Expense summary shared with you
              </p>
            </div>
            <Activity mode={hasMultipleCurrencies ? "hidden" : "visible"}>
              <AmountDisplay
                amount={balance}
                currency={activeCurrency}
                size="lg"
                showLabel
              />
            </Activity>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1">
            <p className="font-medium">Want to manage expenses together?</p>
            <p className="text-sm text-muted-foreground">
              Create an account to track and settle debts easily.
            </p>
          </div>
          <Link to={`/register?slug=${slug}`}>
            <Button variant="premium">
              <UserPlus className="h-4 w-4 mr-2" />
              Create Account
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Balances & Transactions */}
      <FriendBalanceSection
        balancesPerCurrency={balancesPerCurrency}
        friendName={friendship.friend.name}
      />
    </div>
  );
}
