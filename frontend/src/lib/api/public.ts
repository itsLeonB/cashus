import { apiClient } from "./client";
import { FriendDetailsResponse } from "./types";

export const publicApi = {
  getProfileBySlug: (slug?: string) => {
    if (!slug) {
      return Promise.reject(new Error("Slug is required"));
    }
    return apiClient.get<FriendDetailsResponse>(`/public/profiles/${slug}`);
  },
};
