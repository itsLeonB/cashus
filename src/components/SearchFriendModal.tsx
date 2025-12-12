import { useState, useEffect } from "react";
import { apiClient } from "../services/api";
import type { ProfileResponse } from "../types/api";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import Modal from "./Modal";

interface SearchFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function SearchFriendModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
}: Readonly<SearchFriendModalProps>) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const profiles = await apiClient.searchProfiles(query);
        setResults(profiles);
      } catch (error) {
        onError(error instanceof Error ? error.message : "Search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSendRequest = async (profileId: string) => {
    setSendingRequest(profileId);
    try {
      await apiClient.sendFriendRequest(profileId);
      onSuccess();
      onClose();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Failed to send friend request"
      );
    } finally {
      setSendingRequest(null);
    }
  };

  const handleClose = () => {
    setQuery("");
    setResults([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Search Friends">
      <div className="space-y-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, or by email"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
        />

        {loading && (
          <div className="text-center py-4 text-gray-500">Searching...</div>
        )}

        {query.length >= 3 && !loading && results.length === 0 && (
          <div className="text-center py-4 text-gray-500">No users found</div>
        )}

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {results.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center">
                <Avatar className="h-10 w-10 mr-3">
                  <AvatarImage
                    referrerPolicy="no-referrer"
                    src={profile.avatar || undefined}
                    alt={profile.name}
                  />
                  <AvatarFallback>
                    {profile.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-gray-900">{profile.name}</h3>
                  {profile.email && (
                    <p className="text-sm text-gray-500">{profile.email}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleSendRequest(profile.id)}
                disabled={sendingRequest === profile.id}
                className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {sendingRequest === profile.id ? "Sending..." : "Send Request"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
