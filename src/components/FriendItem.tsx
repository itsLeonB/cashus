import { Link } from "react-router-dom";
import type { FriendshipResponse } from "../types/api";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { format } from "date-fns";

interface FriendItemProps {
  friend: FriendshipResponse;
}

export default function FriendItem({ friend }: FriendItemProps) {
  return (
    <div className="flex items-center p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow">
      <div className="flex-shrink-0 mr-4">
        <Avatar className="h-12 w-12 ring-2 ring-indigo-100">
          {friend.type === "REAL" && friend.profileAvatar && (
            <AvatarImage src={friend.profileAvatar} alt={friend.profileName} />
          )}
          <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 text-sm font-medium text-gray-600">
            {friend.type === "REAL"
              ? friend.profileName.charAt(0).toUpperCase()
              : "Anon"}
          </AvatarFallback>
        </Avatar>
      </div>
      <Link className="flex-1" to={`/friends/${friend.id}`}>
        <h3 className="font-semibold text-gray-900 text-lg">
          {friend.profileName}
        </h3>
        <div className="mt-1">
          <span className="text-xs text-gray-400">
            Friends since {format(new Date(friend.createdAt), "MMM d, yyyy")}
          </span>
        </div>
      </Link>
    </div>
  );
}
