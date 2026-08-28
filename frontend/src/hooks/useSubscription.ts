import { useMutation, useQueryClient } from "@tanstack/react-query";
import { planApi } from "@/lib/api/plan";
import { subscriptionApi } from "@/lib/api/subscription";
import { queryKeys } from "@/lib/queryKeys";

export function usePurchasePlan() {
  return useMutation({
    mutationFn: ({
      planId,
      planVersionId,
    }: {
      planId: string;
      planVersionId: string;
    }) => planApi.purchasePlan(planId, planVersionId),
  });
}

export function useMakePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: subscriptionApi.makePayment,
    // Belt-and-suspenders: if user navigates back without hitting /payment/return
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.profile.subscription,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.current });
    },
  });
}
