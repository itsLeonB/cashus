import { apiClient } from "./client";
import { PaymentResponse } from "./plan";

export const subscriptionApi = {
  makePayment: (subscriptionId: string) =>
    apiClient.post<PaymentResponse>(`/subscriptions/${subscriptionId}`),
};
