import { apiClient } from "./client";

// shortcut: OpenAPI lacks these routes in this checkout; generate these types after backend integration.
export interface SplitReminder {
  id: string;
  friendshipId: string;
  senderProfileId: string;
  recipientProfileId: string;
  description: string;
  mealDate: string | null;
  status: "OPEN" | "CANCELLED" | "DECLINED" | "COMPLETED" | "FRIENDSHIP_CLOSED";
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  draftExpenseId: string | null;
  expenseId: string | null;
}
export interface SendSplitReminder {
  description: string;
  mealDate?: string | null;
}
export const splitRemindersApi = {
  send: (friendshipId: string, data: SendSplitReminder, key: string) =>
    apiClient.post<SplitReminder>(`/friendships/${friendshipId}/split-reminders`, data, { "Idempotency-Key": key }),
  list: (friendshipId: string) =>
    apiClient.get<SplitReminder[]>(`/friendships/${friendshipId}/split-reminders`),
  get: (id: string) => apiClient.get<SplitReminder>(`/split-reminders/${id}`),
};
