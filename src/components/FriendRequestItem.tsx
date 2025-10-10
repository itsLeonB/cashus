import type { FriendRequest } from "../types/friend";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";

interface FriendRequestItemProps {
  request: FriendRequest;
  type: "sent" | "received" | "blocked";
  onCancel?: (id: string) => void;
  onIgnore?: (id: string) => void;
  onBlock?: (id: string) => void;
  onUnblock?: (id: string) => void;
  onAccept?: (id: string) => void;
  loading?: string | null;
}

export default function FriendRequestItem({
  request,
  type,
  onCancel,
  onIgnore,
  onBlock,
  onUnblock,
  onAccept,
  loading,
}: FriendRequestItemProps) {
  const displayName = request.isSentByUser
    ? request.recipientName
    : request.senderName;
  const displayAvatar = request.isSentByUser
    ? request.recipientAvatar
    : request.senderAvatar;

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
      <div className="flex items-center">
        <Avatar className="h-10 w-10 mr-3">
          {displayAvatar && (
            <AvatarImage src={displayAvatar} alt={displayName} />
          )}
          <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-medium text-gray-900">{displayName}</h3>
        </div>
      </div>

      <div className="flex gap-2">
        {type === "sent" && (
          <button
            onClick={() => onCancel?.(request.id)}
            disabled={loading === request.id}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 cursor-pointer"
          >
            {loading === request.id ? "..." : "Cancel"}
          </button>
        )}

        {type === "received" && (
          <>
            <button
              onClick={() => onIgnore?.(request.id)}
              disabled={loading === request.id}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 cursor-pointer"
            >
              {loading === request.id ? "..." : "Ignore"}
            </button>
            <button
              onClick={() => onBlock?.(request.id)}
              disabled={loading === request.id}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 cursor-pointer"
            >
              {loading === request.id ? "..." : "Block"}
            </button>
            <button
              onClick={() => onAccept?.(request.id)}
              disabled={loading === request.id}
              className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 cursor-pointer"
            >
              {loading === request.id ? "..." : "Accept"}
            </button>
          </>
        )}

        {type === "blocked" && (
          <button
            onClick={() => onUnblock?.(request.id)}
            disabled={loading === request.id}
            className="px-3 py-1 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:opacity-50 cursor-pointer"
          >
            {loading === request.id ? "..." : "Unblock"}
          </button>
        )}
      </div>
    </div>
  );
}
