import { apiClient } from "./client";
import { ProfileTransferMethod } from "./types";

export const profilesApi = {
  getTransferMethods: (profileId: string) =>
    apiClient.get<ProfileTransferMethod[]>(
      `/profiles/${profileId}/transfer-methods`
    ),
};
