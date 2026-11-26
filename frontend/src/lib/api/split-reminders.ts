import { apiClient } from "./client";

import type { components } from "./schema.gen";

export type SplitReminder = components["schemas"]["SplitReminderResponse"];
export type SendSplitReminder = components["schemas"]["SendSplitReminderRequest"];
export const splitRemindersApi = {
  send: (friendshipId: string, data: SendSplitReminder, key: string) =>
    apiClient.post<SplitReminder>(`/friendships/${friendshipId}/split-reminders`, data, { "Idempotency-Key": key }),
  list: (friendshipId: string) =>
    apiClient.get<SplitReminder[]>(`/friendships/${friendshipId}/split-reminders`),
  get: (id: string) => apiClient.get<SplitReminder>(`/split-reminders/${id}`),
};
