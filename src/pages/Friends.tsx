import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiClient } from "../services/api";
import type { FriendshipResponse } from "../types/api";
import FriendItem from "../components/FriendItem";
import SearchFriendModal from "../components/SearchFriendModal";
import { CreateFriendModal } from "../components/CreateFriendModal";
import Modal from "../components/Modal";

export default function Friends() {
  const [friends, setFriends] = useState<FriendshipResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchFriends = async () => {
    try {
      const friendships = await apiClient.getFriendships();
      setFriends(friendships);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load friends");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const handleSendRequestSuccess = () => {
    toast.success("Friend request sent");
  };

  const handleCreateFriendSuccess = () => {
    toast.success("Anonymous friend created successfully");
    fetchFriends();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Friends</h1>
          <div className="text-center py-8">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Friends</h1>
          <div className="text-center py-8 text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
          <button
            onClick={() => setShowTypeModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Add Friend
          </button>
        </div>

        {friends.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-lg">No friends yet</p>
            <p className="text-sm">Add some friends to get started!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {friends.map((friend) => (
              <FriendItem key={friend.id} friend={friend} />
            ))}
          </div>
        )}

        <Modal
          isOpen={showTypeModal}
          onClose={() => setShowTypeModal(false)}
          title="Add Friend"
        >
          <div className="space-y-4">
            <p className="text-gray-600 mb-6">
              How would you like to add a friend?
            </p>

            <button
              onClick={() => {
                setShowTypeModal(false);
                setShowSearchModal(true);
              }}
              className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">Add Real Friend</div>
              <div className="text-sm text-gray-500 mt-1">
                Search for registered users by name or email
              </div>
            </button>

            <button
              onClick={() => {
                setShowTypeModal(false);
                setShowCreateModal(true);
              }}
              className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">
                Create Anonymous Friend
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Add someone who isn't registered yet
              </div>
            </button>
          </div>
        </Modal>

        <SearchFriendModal
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onSuccess={handleSendRequestSuccess}
        />

        <CreateFriendModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateFriendSuccess}
        />
      </div>
    </div>
  );
}
