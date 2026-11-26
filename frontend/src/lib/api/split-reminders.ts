import { apiClient } from "./client";

import type { SplitReminder, SendSplitReminder } from "./types";
export type { SplitReminder, SendSplitReminder } from "./types";
export const splitRemindersApi = {
  send: (friendshipId: string, data: SendSplitReminder) =>
    apiClient.post<SplitReminder>(`/friendships/${friendshipId}/split-reminders`, data),
  list: (friendshipId: string) =>
    apiClient.get<SplitReminder[]>(`/friendships/${friendshipId}/split-reminders`),
  get: (id: string) => apiClient.get<SplitReminder>(`/split-reminders/${id}`),
};
