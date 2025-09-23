import axios from "axios";
import type { AxiosInstance, AxiosResponse } from "axios";
import type {
  RegisterRequest,
  LoginRequest,
  LoginResponse,
  ProfileResponse,
  NewAnonymousFriendshipRequest,
  FriendshipResponse,
  TransferMethodResponse,
  NewDebtTransactionRequest,
  DebtTransactionResponse,
} from "../types/api";
import type { FriendDetailsResponse } from "../types/friend";
import type {
  ExpenseItemResponse,
  FeeCalculationMethodInfo,
  GroupExpenseResponse,
  NewExpenseItemRequest,
  NewGroupExpenseRequest,
  NewOtherFeeRequest,
  OtherFeeResponse,
  UpdateExpenseItemRequest,
  UpdateOtherFeeRequest,
} from "../types/groupExpense";
import type { ExpenseBillResponse } from "../types/expenseBill";

class ApiClient {
  private readonly client: AxiosInstance;

  constructor(
    baseURL: string = import.meta.env.VITE_API_BASE_URL ||
      "http://localhost:8080"
  ) {
    this.client = axios.create({
      baseURL: `${baseURL}/api/v1`,
      headers: {},
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling and unwrapping ApiResponse
    this.client.interceptors.response.use(
      (response) => {
        // Automatically unwrap ApiResponse wrapper if it exists
        if (
          response.data &&
          typeof response.data === "object" &&
          "data" in response.data
        ) {
          response.data = response.data.data;
        }
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Clear token and redirect to login
          localStorage.removeItem("authToken");
          window.location.href = "/login";
        }
        return Promise.reject(
          error instanceof Error
            ? error
            : new Error(error?.message || "Unknown error")
        );
      }
    );
  }

  // Auth endpoints
  async register(data: RegisterRequest): Promise<void> {
    await this.client.post("/auth/register", data);
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response: AxiosResponse<LoginResponse> = await this.client.post(
      "/auth/login",
      data
    );
    return response.data;
  }

  // Profile endpoints
  async getProfile(): Promise<ProfileResponse> {
    const response: AxiosResponse<ProfileResponse> = await this.client.get(
      "/profile"
    );
    return response.data;
  }

  // Friendship endpoints
  async createAnonymousFriendship(
    data: NewAnonymousFriendshipRequest
  ): Promise<void> {
    await this.client.post("/friendships", data);
  }

  async getFriendships(): Promise<FriendshipResponse[]> {
    const response: AxiosResponse<FriendshipResponse[]> = await this.client.get(
      "/friendships"
    );
    return response.data;
  }

  async getFriendDetails(friendId: string): Promise<FriendDetailsResponse> {
    const response: AxiosResponse<FriendDetailsResponse> =
      await this.client.get(`/friendships/${friendId}`);
    return response.data;
  }

  // Transfer method endpoints
  async getTransferMethods(): Promise<TransferMethodResponse[]> {
    const response: AxiosResponse<TransferMethodResponse[]> =
      await this.client.get("/transfer-methods");
    return response.data;
  }

  // Debt transaction endpoints
  async createDebtTransaction(data: NewDebtTransactionRequest): Promise<void> {
    await this.client.post("/debts", data);
  }

  async getDebtTransactions(): Promise<DebtTransactionResponse[]> {
    const response: AxiosResponse<DebtTransactionResponse[]> =
      await this.client.get("/debts");
    return response.data;
  }

  // Group expense endpoints
  async createDraftGroupExpense(data: NewGroupExpenseRequest): Promise<void> {
    await this.client.post("/group-expenses", data);
  }

  async getCreatedGroupExpenses(): Promise<GroupExpenseResponse[]> {
    const response: AxiosResponse<GroupExpenseResponse[]> =
      await this.client.get("/group-expenses");
    return response.data;
  }

  async getGroupExpenseDetails(
    expenseId: string
  ): Promise<GroupExpenseResponse> {
    const response: AxiosResponse<GroupExpenseResponse> = await this.client.get(
      `/group-expenses/${expenseId}`
    );
    return response.data;
  }

  async getExpenseItemDetails(
    groupExpenseId: string,
    expenseItemId: string
  ): Promise<ExpenseItemResponse> {
    const response = await this.client.get(
      `/group-expenses/${groupExpenseId}/items/${expenseItemId}`
    );
    return response.data;
  }

  async updateExpenseItem(
    request: UpdateExpenseItemRequest
  ): Promise<ExpenseItemResponse> {
    const response = await this.client.put(
      `/group-expenses/${request.groupExpenseId}/items/${request.id}`,
      request
    );
    return response.data;
  }

  async confirmDraftGroupExpense(
    groupExpenseId: string
  ): Promise<GroupExpenseResponse> {
    const response = await this.client.patch(
      `/group-expenses/${groupExpenseId}/confirmed`
    );
    return response.data;
  }

  async getFeeCalculationMethods(): Promise<FeeCalculationMethodInfo[]> {
    const response = await this.client.get(
      "/group-expenses/fee-calculation-methods"
    );
    return response.data;
  }

  async updateOtherFee(
    request: UpdateOtherFeeRequest
  ): Promise<OtherFeeResponse> {
    const response = await this.client.put(
      `/group-expenses/${request.groupExpenseId}/fees/${request.id}`,
      request
    );
    return response.data;
  }

  async addExpenseItem(
    request: NewExpenseItemRequest
  ): Promise<ExpenseItemResponse> {
    const response = await this.client.post(
      `/group-expenses/${request.groupExpenseId}/items`,
      request
    );
    return response.data;
  }

  async addOtherFee(request: NewOtherFeeRequest): Promise<OtherFeeResponse> {
    const response = await this.client.post(
      `/group-expenses/${request.groupExpenseId}/fees`,
      request
    );
    return response.data;
  }

  async removeExpenseItem(
    groupExpenseId: string,
    expenseItemId: string
  ): Promise<void> {
    await this.client.delete(
      `/group-expenses/${groupExpenseId}/items/${expenseItemId}`
    );
  }

  async removeOtherFee(
    groupExpenseId: string,
    otherFeeId: string
  ): Promise<void> {
    await this.client.delete(
      `/group-expenses/${groupExpenseId}/fees/${otherFeeId}`
    );
  }

  async uploadBill(payerProfileId: string, billFile: File): Promise<void> {
    const formData = new FormData();
    formData.append("payerProfileId", payerProfileId);
    formData.append("bill", billFile);
    await this.client.post("/group-expenses/bills", formData);
  }

  async getAllCreatedBills(): Promise<ExpenseBillResponse[]> {
    const response = await this.client.get("/group-expenses/bills");
    return response.data;
  }

  async getBillDetails(billId: string): Promise<ExpenseBillResponse> {
    const response = await this.client.get(`/group-expenses/bills/${billId}`);
    return response.data;
  }

  async deleteBill(billId: string): Promise<void> {
    await this.client.delete(`/group-expenses/bills/${billId}`);
  }

  // Auth helpers
  setAuthToken(token: string): void {
    localStorage.setItem("authToken", token);
  }

  clearAuthToken(): void {
    localStorage.removeItem("authToken");
  }

  getAuthToken(): string | null {
    return localStorage.getItem("authToken");
  }

  isAuthenticated(): boolean {
    return !!this.getAuthToken();
  }
}

export const apiClient = new ApiClient();
export default apiClient;
