import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "loading" | "success" | "canceled";

export default function PaymentReturnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>(
    searchParams.get("status") === "cancel" ? "canceled" : "loading",
  );

  useEffect(() => {
    if (status !== "loading") return;

    // ponytail: single delay — give backend 2s to process webhook, then invalidate.
    // Ceiling: if webhook takes >2s user sees success before sub is active. Upgrade: poll subscription status.
    const timer = setTimeout(async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profile.subscription,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profile.current,
      });
      setStatus("success");
    }, 2000);

    return () => clearTimeout(timer);
  }, [status, queryClient]);

  if (status === "loading") {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Spinner />
        <p className="text-muted-foreground">Processing payment…</p>
      </div>
    );
  }

  if (status === "canceled") {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <XCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-semibold">Payment Canceled</h1>
        <p className="text-muted-foreground">You canceled the payment.</p>
        <Button onClick={() => navigate("/subscription")}>
          Back to Plans
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
      <CheckCircle2 className="h-12 w-12 text-green-500" />
      <h1 className="text-xl font-semibold">Payment Received!</h1>
      <p className="text-muted-foreground">
        Your subscription is being activated.
      </p>
      <Button onClick={() => navigate("/subscription")}>
        View Subscription
      </Button>
    </div>
  );
}
