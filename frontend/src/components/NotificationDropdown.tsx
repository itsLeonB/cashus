import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useUnreadNotifications,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
} from "@/hooks/useApi";
import { Notification } from "@/lib/api/notifications";
import { resolveNotificationRoute } from "@/lib/notificationResolvers";
import { clearNotificationContext } from "@/lib/notificationPersistence";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface NotificationItemProps {
  notification: Notification;
  onNavigate: () => void;
}

function NotificationItem({
  notification,
  onNavigate,
}: Readonly<NotificationItemProps>) {
  const navigate = useNavigate();
  const markAsReadMutation = useMarkNotificationAsRead(notification.id);

  const handleClick = () => {
    markAsReadMutation.mutate();
    const route = resolveNotificationRoute(notification);
    // Clear persistence context as we are now consuming it
    clearNotificationContext();
    navigate(route);
    onNavigate();
  };

  return (
    <button
      onClick={handleClick}
      className={
        "w-full text-left p-3 rounded-lg transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring bg-accent/30"
      }
    >
      <div className="flex items-start gap-3">
        <div className={"mt-1 h-2 w-2 rounded-full flex-shrink-0 bg-primary"} />
        <div className="flex-1 min-w-0">
          <p className={"text-sm font-medium"}>
            {notification.title || "Notification"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatRelativeTime(notification.createdAt)}
          </p>
        </div>
        {markAsReadMutation.isPending && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
    </button>
  );
}

function NotificationSkeleton() {
  return (
    <div className="p-3 space-y-2">
      <div className="flex items-start gap-3">
        <Skeleton className="h-2 w-2 rounded-full mt-1" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
    </div>
  );
}

interface NotificationDropdownProps {
  className?: string;
}

export function NotificationDropdown({
  className,
}: Readonly<NotificationDropdownProps>) {
  const [open, setOpen] = useState(false);
  const { data: notifications, isLoading, isError } = useUnreadNotifications();
  const markAllAsReadMutation = useMarkAllNotificationsAsRead();
  const unreadCount = notifications?.length || 0;

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const content = () => {
    if (isLoading)
      return (
        <div className="space-y-1">
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
        </div>
      );

    if (isError)
      return (
        <div className="p-6 text-center text-muted-foreground">
          <p className="text-sm">Failed to load notifications</p>
        </div>
      );

    if ((notifications?.length || 0) === 0)
      return (
        <div className="p-6 text-center text-muted-foreground">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No new notifications</p>
        </div>
      );

    return (
      <div className="p-1 space-y-1">
        {notifications?.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onNavigate={() => setOpen(false)}
          />
        ))}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-xs"
              variant="destructive"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 max-h-[70vh] flex flex-col"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
              className="text-xs h-8"
            >
              {markAllAsReadMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <CheckCheck className="h-3 w-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 scrollbar-thin">{content()}</div>
      </PopoverContent>
    </Popover>
  );
}
