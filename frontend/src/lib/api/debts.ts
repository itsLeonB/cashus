import { apiClient } from "./client";
import {
  DebtTransactionResponse,
  FriendBalance,
  NewDebtTransactionRequest,
  TransferMethod,
} from "./types";

export type TransferMethodFilter = "parents" | "children" | "for-transaction";

export const debtsApi = {
  getAll: () => apiClient.get<DebtTransactionResponse[]>("/debts"),

  create: (data: NewDebtTransactionRequest) =>
    apiClient.post<DebtTransactionResponse>("/debts", data),

  getTransferMethods: (filter: TransferMethodFilter) =>
    apiClient.get<TransferMethod[]>("/transfer-methods", {
      status: filter,
    }),

  getSummary: () =>
    apiClient.get<Record<string, FriendBalance>>("/debts/summary"),

  getRecent: () => apiClient.get<DebtTransactionResponse[]>("/debts/recent"),
};
