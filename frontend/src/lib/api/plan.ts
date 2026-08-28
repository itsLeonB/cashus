import { apiClient } from "./client";

export interface PlanVersionResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  planId: string;
  planName: string;
  priceAmount: string;
  priceCurrency: string;
  billingInterval: string;
  billUploadsDaily: number;
  billUploadsMonthly: number;
  effectiveFrom: string;
  effectiveTo?: string;
  isDefault: boolean;
}

export interface PaymentResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  subscriptionId: string;
  amount: string;
  currency: string;
  gateway: string;
  gatewayTransactionId?: string;
  gatewaySubscriptionId?: string;
  status: string;
  failureReason?: string;
  startsAt?: string;
  endsAt?: string;
  gatewayEventId?: string;
  paidAt?: string;
}

export const planApi = {
  getActive: () => apiClient.get<PlanVersionResponse[]>("/plans"),

  purchasePlan: (planId: string, planVersionId: string) =>
    apiClient.post<PaymentResponse>(
      `/plans/${planId}/versions/${planVersionId}/subscriptions`,
    ),
};
