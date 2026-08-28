import { useAuth } from "@/contexts/AuthContext";
import { UploadLimit } from "@/lib/api/types";

export interface UploadPermission {
  isLoading: boolean;
  canUpload: boolean;
  daily: UploadLimit | null;
  monthly: UploadLimit | null;
  hasLimits: boolean;
}

export function useUploadPermission(): UploadPermission {
  const { user, isLoading } = useAuth();
  if (isLoading)
    return {
      isLoading: true,
      canUpload: false,
      daily: null,
      monthly: null,
      hasLimits: false,
    };

  if (!user) {
    return {
      isLoading: false,
      canUpload: false,
      daily: null,
      monthly: null,
      hasLimits: false,
    };
  }

  const { uploads } = user.currentSubscription.limits;
  const { daily, monthly } = uploads;
  const hasDailyLimit = daily.limit > 0;
  const hasMonthlyLimit = monthly.limit > 0;

  return {
    isLoading: false,
    canUpload: uploads.canUpload,
    daily: hasDailyLimit ? daily : null,
    monthly: hasMonthlyLimit ? monthly : null,
    hasLimits: hasDailyLimit || hasMonthlyLimit,
  };
}
