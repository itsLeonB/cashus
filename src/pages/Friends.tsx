import { useEffect, useState } from "react";

import { toast } from "react-toastify";

import Modal from "../components/Modal";
import { apiClient } from "../services/api";
import FriendItem from "../components/FriendItem";
import ConfirmModal from "../components/ConfirmModal";
import FriendRequestItem from "../components/FriendRequestItem";
import SearchFriendModal from "../components/SearchFriendModal";
import { CreateFriendModal } from "../components/CreateFriendModal";

import type { FriendRequest } from "../types/friend";
import type { FriendshipResponse } from "../types/api";

export default function Friends() {
  const [friends, setFriends] = useState<FriendshipResponse[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isRequestsExpanded, setIsRequestsExpanded] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState<{
    show: boolean;
    requestId: string;
    name: string;
  }>({ show: false, requestId: "", name: "" });
  const [unblockConfirm, setUnblockConfirm] = useState<{
    show: boolean;
    requestId: string;
    name: string;
  }>({ show: false, requestId: "", name: "" });

  const fetchData = async () => {
    try {
      const [friendships, sent, received] = await Promise.all([
        apiClient.getFriendships(),
        apiClient.getSentFriendRequests(),
        apiClient.getReceivedFriendRequests(),
      ]);
      setFriends(friendships);
      setSentRequests(sent);
      setReceivedRequests(received);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendRequestSuccess = () => {
    toast.success("Friend request sent");
    fetchData();
  };

  const handleCreateFriendSuccess = () => {
    toast.success("Anonymous friend created successfully");
    fetchData();
  };

  const handleCancel = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await apiClient.cancelSentFriendRequest(requestId);
      toast.success("Friend request cancelled");
      fetchData();
    } catch {
      toast.error("Failed to cancel request");
    } finally {
      setActionLoading(null);
    }
  };

  const handleIgnore = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await apiClient.ignoreReceivedFriendRequest(requestId);
      toast.success("Friend request ignored");
      fetchData();
    } catch {
      toast.error("Failed to ignore request");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async (requestId: string) => {
    const request = receivedRequests.find((r) => r.id === requestId);
    const name = request?.isSentByUser
      ? request.recipientName
      : request?.senderName || "User";
    setBlockConfirm({ show: true, requestId, name });
  };

  const confirmBlock = async () => {
    setActionLoading(blockConfirm.requestId);
    try {
      await apiClient.blockReceivedFriendRequest(blockConfirm.requestId);
      toast.success("User blocked");
      fetchData();
    } catch {
      toast.error("Failed to block user");
    } finally {
      setActionLoading(null);
      setBlockConfirm({ show: false, requestId: "", name: "" });
    }
  };

  const handleUnblock = async (requestId: string) => {
    const request = receivedRequests.find((r) => r.id === requestId);
    const name = request?.isSentByUser
      ? request.recipientName
      : request?.senderName || "User";
    setUnblockConfirm({ show: true, requestId, name });
  };

  const confirmUnblock = async () => {
    setActionLoading(unblockConfirm.requestId);
    try {
      await apiClient.unblockReceivedFriendRequest(unblockConfirm.requestId);
      toast.success("User unblocked");
      fetchData();
    } catch {
      toast.error("Failed to unblock user");
    } finally {
      setActionLoading(null);
      setUnblockConfirm({ show: false, requestId: "", name: "" });
    }
  };

  const handleAccept = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await apiClient.acceptReceivedFriendRequest(requestId);
      toast.success("Friend request accepted");
      fetchData();
    } catch {
      toast.error("Failed to accept request");
    } finally {
      setActionLoading(null);
    }
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
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Friend Requests Section */}
        <div className="lg:col-span-1">
          <button
            onClick={() => setIsRequestsExpanded(!isRequestsExpanded)}
            className="flex items-center justify-between w-full mb-4 lg:cursor-default lg:pointer-events-none"
          >
            <h2 className="text-xl font-bold text-gray-900">Friend Requests</h2>
            <span className="lg:hidden p-2 text-gray-600">
              {isRequestsExpanded ? "−" : "+"}
            </span>
          </button>

          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              isRequestsExpanded
                ? "max-h-screen opacity-100"
                : "max-h-0 opacity-0 lg:max-h-screen lg:opacity-100"
            }`}
          >
            <div className="space-y-6">
              {/* Sent Requests */}
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-3">Sent</h3>
                {sentRequests.length === 0 ? (
                  <p className="text-sm text-gray-500">No sent requests</p>
                ) : (
                  <div className="space-y-2">
                    {sentRequests.map((request) => (
                      <FriendRequestItem
                        key={request.id}
                        request={request}
                        type="sent"
                        onCancel={handleCancel}
                        loading={actionLoading}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Received Requests */}
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-3">
                  Received
                </h3>
                {receivedRequests.filter((r) => !r.isBlocked).length === 0 ? (
                  <p className="text-sm text-gray-500">No received requests</p>
                ) : (
                  <div className="space-y-2">
                    {receivedRequests
                      .filter((r) => !r.isBlocked)
                      .map((request) => (
                        <FriendRequestItem
                          key={request.id}
                          request={request}
                          type="received"
                          onIgnore={handleIgnore}
                          onBlock={handleBlock}
                          onAccept={handleAccept}
                          loading={actionLoading}
                        />
                      ))}
                  </div>
                )}
              </div>

              {/* Blocked Requests */}
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-3">
                  Blocked
                </h3>
                {receivedRequests.filter((r) => r.isBlocked).length === 0 ? (
                  <p className="text-sm text-gray-500">No blocked users</p>
                ) : (
                  <div className="space-y-2">
                    {receivedRequests
                      .filter((r) => r.isBlocked)
                      .map((request) => (
                        <FriendRequestItem
                          key={request.id}
                          request={request}
                          type="blocked"
                          onUnblock={handleUnblock}
                          loading={actionLoading}
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Friends Section */}
        <div className="lg:col-span-2">
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
        </div>
      </div>

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
        onError={(error) => toast.error(error)}
      />

      <CreateFriendModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateFriendSuccess}
        onError={(error) => toast.error(error)}
      />

      <ConfirmModal
        isOpen={blockConfirm.show}
        onClose={() =>
          setBlockConfirm({ show: false, requestId: "", name: "" })
        }
        onConfirm={confirmBlock}
        title="Block User"
        message={`Are you sure you want to block ${blockConfirm.name}? They won't be able to send you friend requests.`}
      />

      <ConfirmModal
        isOpen={unblockConfirm.show}
        onClose={() =>
          setUnblockConfirm({ show: false, requestId: "", name: "" })
        }
        onConfirm={confirmUnblock}
        title="Unblock User"
        message={`Are you sure you want to unblock ${unblockConfirm.name}? They will be able to send you friend requests again.`}
      />
    </div>
  );
}
