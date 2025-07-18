export interface NewGroupExpenseRequest {
  payerProfileId?: string;
  totalAmount: string;
  description?: string;
  items: NewExpenseItemRequest[];
  otherFees?: NewOtherFeeRequest[];
}

export interface NewExpenseItemRequest {
  name: string;
  amount: string;
  quantity: number;
}

export interface NewOtherFeeRequest {
  name: string;
  amount: string;
  calculationMethod: string;
}

export interface UpdateOtherFeeRequest {
  id: string;
  groupExpenseId: string;
  name: string;
  amount: string;
  calculationMethod: string;
}

export interface GroupExpenseResponse {
  id: string;
  payerProfileId?: string;
  payerName?: string;
  paidByUser: boolean;
  totalAmount: string;
  description?: string;
  items: ExpenseItemResponse[];
  otherFees?: OtherFeeResponse[];
  creatorProfileId: string;
  creatorName?: string;
  createdByUser: boolean;
  confirmed: boolean;
  participantsConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  participants?: ExpenseParticipantResponse[];
}

export interface ExpenseItemResponse {
  id: string;
  groupExpenseId: string;
  name: string;
  amount: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  participants: ItemParticipantResponse[];
}

export interface ItemParticipantResponse {
  profileName: string;
  profileId: string;
  share: string;
  isUser: boolean;
}

export interface UpdateExpenseItemRequest {
  id: string;
  groupExpenseId: string;
  name: string;
  amount: string;
  quantity: number;
  participants: ItemParticipantRequest[];
}

export interface ItemParticipantRequest {
  profileId: string;
  share: string;
}

export interface OtherFeeResponse {
  id: string;
  name: string;
  amount: string;
  calculationMethod: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ExpenseParticipantResponse {
  profileName: string;
  profileId: string;
  shareAmount: string;
  isUser: boolean;
}

export interface FeeCalculationMethodInfo {
  name: string;
  display: string;
  description: string;
}
