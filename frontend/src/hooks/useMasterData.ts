import { useQuery } from "@tanstack/react-query";
import { debtsApi, groupExpensesApi } from "@/lib/api";
import { TransferMethodFilter } from "@/lib/api/debts";
import { queryKeys } from "@/lib/queryKeys";

export function useFilteredTransferMethods(
  filter: TransferMethodFilter,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.transferMethods.filter(filter),
    queryFn: () => debtsApi.getTransferMethods(filter),
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useCalculationMethods() {
  return useQuery({
    queryKey: queryKeys.calculationMethods.all,
    queryFn: groupExpensesApi.getCalculationMethods,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
