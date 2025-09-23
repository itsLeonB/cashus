export interface ExpenseBillResponse {
  id: string;
  creatorProfileId: string;
  payerProfileId: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  isCreatedByUser: boolean;
  isPaidByUser: boolean;
  creatorProfileName: string;
  payerProfileName: string;
}
