import { apiClient } from "./client";
import {
  FriendshipResponse,
  NewAnonymousFriendshipRequest,
  SearchProfileResult,
  FriendRequest,
  FriendDetailsResponse,
} from "./types";

export const friendshipsApi = {
  getAll: () => apiClient.get<FriendshipResponse[]>("/friendships"),

  getById: (friendId: string) =>
    apiClient.get<FriendDetailsResponse>(`/friendships/${friendId}`),

  createAnonymous: (data: NewAnonymousFriendshipRequest) =>
    apiClient.post<FriendshipResponse>("/friendships", data),

  searchProfiles: (query: string) =>
    apiClient.get<SearchProfileResult[]>(
      `/profiles?query=${encodeURIComponent(query)}`
    ),

  sendFriendRequest: (profileId: string) =>
    apiClient.post<FriendRequest>(`/profiles/${profileId}/friend-requests`),

  getSentRequests: () =>
    apiClient.get<FriendRequest[]>("/friend-requests/sent"),

  getReceivedRequests: () =>
    apiClient.get<FriendRequest[]>("/friend-requests/received"),

  cancelRequest: (requestId: string) =>
    apiClient.delete(`/friend-requests/sent/${requestId}`),

  ignoreRequest: (requestId: string) =>
    apiClient.delete(`/friend-requests/received/${requestId}`),

  acceptRequest: (requestId: string) =>
    apiClient.post<FriendshipResponse>(
      `/friend-requests/received/${requestId}`
    ),

  blockRequest: (requestId: string) =>
    apiClient.patch(`/friend-requests/received/${requestId}?command=block`),

  unblockRequest: (requestId: string) =>
    apiClient.patch(`/friend-requests/received/${requestId}?command=unblock`),

  associateProfile: (realProfileId: string, anonProfileId: string) =>
    apiClient.post("/profile/associate", { realProfileId, anonProfileId }),
};
