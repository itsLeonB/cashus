import { UploadPermission } from "@/hooks/useUploadPermission";
import { AlertCircle, Clock, Loader2 } from "lucide-react";
import { UploadLimit } from "@/lib/api/types";

interface UploadLimitInfoProps {
  permission: UploadPermission;
}

function formatResetTime(resetAt: string): string {
  return new Date(resetAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatResetDateTime(resetAt: string): string {
  const d = new Date(resetAt);
  return (
    d.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " at " +
    d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}

function LimitLine({
  label,
  limit,
  blocked,
}: Readonly<{
  label: string;
  limit: UploadLimit;
  blocked: boolean;
}>) {
  if (blocked) {
    const resetDisplay =
      label === "Monthly"
        ? `Resets on ${formatResetDateTime(limit.resetAt)}`
        : `Resets at ${formatResetTime(limit.resetAt)}`;
    return (
      <span className="flex items-center gap-1.5 text-destructive text-xs">
        <AlertCircle className="h-3 w-3 shrink-0" />
        {label} limit reached. {resetDisplay}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
      <Clock className="h-3 w-3 shrink-0" />
      {limit.remaining} {label.toLowerCase()} upload
      {limit.remaining === 1 ? "" : "s"} remaining
    </span>
  );
}

export function UploadLimitInfo({
  permission,
}: Readonly<UploadLimitInfoProps>) {
  if (permission.isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking upload limits…
      </div>
    );
  }

  if (!permission.hasLimits) return null;

  return (
    <div className="space-y-1">
      {permission.daily && (
        <LimitLine
          label="Daily"
          limit={permission.daily}
          blocked={!permission.daily.canUpload}
        />
      )}
      {permission.monthly && (
        <LimitLine
          label="Monthly"
          limit={permission.monthly}
          blocked={!permission.monthly.canUpload}
        />
      )}
      {!permission.canUpload && (
        <p className="text-xs font-medium text-destructive mt-1">
          Upload limit reached.
        </p>
      )}
    </div>
  );
}
