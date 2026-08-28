import { apiClient } from "./client";
import { NewProfileTransferMethod, ProfileTransferMethod } from "./types";

export interface SubscriptionDetails {
  id: string;
  createdAt: string;
  updatedAt: string;
  profileId: string;
  profileName: string;
  planVersionId: string;
  planName: string;
  endsAt?: string;
  canceledAt?: string;
  autoRenew: boolean;
  billUploadsDaily: number;
  billUploadsMonthly: number;
  status: "active" | "past_due_payment" | "canceled" | "incomplete_payment";
  paymentDueDays: number;
}

export const profileApi = {
  addTransferMethod: (data: NewProfileTransferMethod) =>
    apiClient.post("/profile/transfer-methods", data),

  getTransferMethods: () =>
    apiClient.get<ProfileTransferMethod[]>("/profile/transfer-methods"),

  getActiveSubscriptionDetails: () =>
    apiClient.get<SubscriptionDetails>("/profile/subscription"),
};
