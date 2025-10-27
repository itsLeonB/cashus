import React, { useEffect, useState } from "react";

import { format } from "date-fns";
import { Link, useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import apiClient from "../services/api";
import { formatCurrency } from "../utils/currency";
import { errToString } from "../utils/error";
import type { FriendDetailsResponse } from "../types/friend";
import type { FriendshipResponse } from "../types/api";
import Modal from "../components/Modal";
import { Button } from "../components/ui/button";

const FriendDetails: React.FC = () => {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();

  const [friendData, setFriendData] = useState<FriendDetailsResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "transactions" | "stats"
  >("overview");
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [friends, setFriends] = useState<FriendshipResponse[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const fetchFriendDetails = async () => {
      if (!friendId) {
        setError("Friend ID is required");
        setIsLoading(false);
        return;
      }

      try {
        const data = await apiClient.getFriendDetails(friendId);
        setFriendData(data);
      } catch (err: unknown) {
        setError(errToString(err) || "Failed to load friend details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFriendDetails();
  }, [friendId]);

  const handleSyncClick = async () => {
    try {
      const friendsList = await apiClient.getFriendships();
      const realFriends = friendsList.filter(
        (f) => f.type === "REAL" && f.profileId !== friendId
      );
      setFriends(realFriends);
      setShowSyncModal(true);
    } catch (err) {
      toast.error(`Failed to load friends list: ${errToString(err)}`);
    }
  };

  const handleFriendSelect = (profileId: string) => {
    setSelectedFriend(profileId);
    setShowConfirmation(true);
  };

  const handleSync = async () => {
    if (!selectedFriend || !friendId) return;

    setIsSyncing(true);
    try {
      await apiClient.syncFriendProfiles({
        anonymousProfileId: friendData!.friend.profileId,
        realProfileId: selectedFriend,
      });
      toast.success("Friend profiles synced successfully");
      navigate("/friends");
    } catch (err) {
      toast.error(`Failed to sync friend profiles: ${errToString(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const resetModal = () => {
    setShowSyncModal(false);
    setShowConfirmation(false);
    setSelectedFriend(null);
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return "text-green-600";
    if (balance < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getBalanceText = (balance: number) => {
    if (balance > 0) return "owes you";
    if (balance < 0) return "you owe";
    return "settled up";
  };

  const getTransactionIcon = (action: string) => {
    switch (action) {
      case "LEND":
        return "↗️"; // You gave money
      case "BORROW":
        return "↙️"; // You received money
      case "RECEIVE":
        return "💰"; // You got paid back
      case "RETURN":
        return "💸"; // You paid back
      default:
        return "💱";
    }
  };

  const getActionDescription = (action: string) => {
    switch (action) {
      case "LEND":
        return "You lent money";
      case "BORROW":
        return "You borrowed money";
      case "RECEIVE":
        return "You received payment";
      case "RETURN":
        return "You returned money";
      default:
        return "Transaction";
    }
  };

  const getStatusStyleClass = (status: string) => {
    const initial = "inline-flex px-2 py-1 text-xs font-semibold rounded-full";

    switch (status) {
      case "COMPLETED":
        return `${initial} bg-green-100 text-green-800`;
      case "PENDING":
        return `${initial} bg-yellow-100 text-yellow-800`;
      default:
        return `${initial} bg-red-100 text-red-800`;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading friend details...</div>
      </div>
    );
  }

  if (error || !friendData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">
            {error || "Friend not found"}
          </div>
          <Link
            to="/friends"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Back to Friends
          </Link>
        </div>
      </div>
    );
  }

  const { friend, balance, transactions, stats } = friendData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center">
              <Link
                to="/friends"
                className="mr-4 text-gray-600 hover:text-gray-800"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {friend.name}
                </h1>
                <p className="text-gray-600 capitalize">
                  {friend.type.toLowerCase()} friend
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link
                to={`/transactions/new?friendId=${friend.profileId}`}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                New Transaction
              </Link>
              {friend.type === "ANON" && (
                <>
                  <Button
                    onClick={handleSyncClick}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Sync to Real Profile
                  </Button>
                  <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                    Edit Friend
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Balance Summary Card */}
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <div className="text-center">
                <div
                  className={`text-4xl font-bold mb-2 ${getBalanceColor(balance.netBalance)}`}
                >
                  {formatCurrency(Math.abs(balance.netBalance))}
                </div>
                <p className="text-lg text-gray-600">
                  {friend.name} {getBalanceText(balance.netBalance)}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-500">They owe you</div>
                    <div className="text-lg font-semibold text-green-600">
                      {formatCurrency(balance.totalOwedToYou)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">You owe them</div>
                    <div className="text-lg font-semibold text-red-600">
                      {formatCurrency(balance.totalYouOwe)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white shadow rounded-lg">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`py-4 px-6 text-sm font-medium border-b-2 ${
                    activeTab === "overview"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("transactions")}
                  className={`py-4 px-6 text-sm font-medium border-b-2 ${
                    activeTab === "transactions"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Transactions ({transactions.length})
                </button>
                <button
                  onClick={() => setActiveTab("stats")}
                  className={`py-4 px-6 text-sm font-medium border-b-2 ${
                    activeTab === "stats"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Statistics
                </button>
              </nav>
            </div>

            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Friend Info */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Friend Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500">
                          Name
                        </label>
                        <p className="mt-1 text-sm text-gray-900">
                          {friend.name}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500">
                          Type
                        </label>
                        <p className="mt-1 text-sm text-gray-900 capitalize">
                          {friend.type.toLowerCase()}
                        </p>
                      </div>
                      {friend.email && (
                        <div>
                          <label className="block text-sm font-medium text-gray-500">
                            Email
                          </label>
                          <p className="mt-1 text-sm text-gray-900">
                            {friend.email}
                          </p>
                        </div>
                      )}
                      {friend.phone && (
                        <div>
                          <label className="block text-sm font-medium text-gray-500">
                            Phone
                          </label>
                          <p className="mt-1 text-sm text-gray-900">
                            {friend.phone}
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-500">
                          Friends since
                        </label>
                        <p className="mt-1 text-sm text-gray-900">
                          {format(new Date(friend.createdAt), "MMMM dd, yyyy")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recent Transactions */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Recent Transactions
                    </h3>
                    {transactions.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        No transactions yet
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {transactions.slice(0, 5).map((transaction) => (
                          <div
                            key={transaction.id}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center">
                              <div className="text-2xl mr-3">
                                {getTransactionIcon(transaction.action)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {getActionDescription(transaction.action)}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {transaction.description}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {transaction.transferMethod}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`font-semibold ${
                                  transaction.type === "CREDIT"
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {transaction.type === "CREDIT" ? "+" : "-"}
                                {formatCurrency(transaction.amount)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {format(
                                  new Date(transaction.createdAt),
                                  "MMM dd, HH:mm"
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Transactions Tab */}
              {activeTab === "transactions" && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      All Transactions
                    </h3>
                    <div className="flex space-x-2">
                      <select className="text-sm border border-gray-300 rounded-md px-3 py-1">
                        <option value="">All Types</option>
                        <option value="CREDIT">Money Owed to You</option>
                        <option value="DEBT">Money You Owe</option>
                      </select>
                      <select className="text-sm border border-gray-300 rounded-md px-3 py-1">
                        <option value="">All Actions</option>
                        <option value="LEND">Lent</option>
                        <option value="BORROW">Borrowed</option>
                        <option value="RECEIVE">Received</option>
                        <option value="RETURN">Returned</option>
                      </select>
                    </div>
                  </div>

                  {transactions.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      No transactions found
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-center">
                            <div className="text-2xl mr-3">
                              {getTransactionIcon(transaction.action)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {getActionDescription(transaction.action)}
                              </p>
                              <p className="text-sm text-gray-500">
                                {transaction.description}
                              </p>
                              <p className="text-xs text-gray-400">
                                {transaction.transferMethod} •{" "}
                                {format(
                                  new Date(transaction.createdAt),
                                  "MMM dd, yyyy HH:mm"
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`font-semibold ${
                                transaction.type === "CREDIT"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {transaction.type === "CREDIT" ? "+" : "-"}
                              {formatCurrency(transaction.amount)}
                            </div>
                            <span
                              className={getStatusStyleClass(
                                transaction.status
                              )}
                            >
                              {transaction.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Statistics Tab */}
              {activeTab === "stats" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    Statistics
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {stats.totalTransactions}
                      </div>
                      <div className="text-sm text-blue-800">
                        Total Transactions
                      </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(stats.averageTransactionAmount)}
                      </div>
                      <div className="text-sm text-green-800">
                        Average Amount
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {stats.mostUsedTransferMethod}
                      </div>
                      <div className="text-sm text-purple-800">
                        Most Used Method
                      </div>
                    </div>

                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {stats.firstTransactionDate
                          ? Math.ceil(
                              (new Date().getTime() -
                                new Date(
                                  stats.firstTransactionDate
                                ).getTime()) /
                                (1000 * 60 * 60 * 24)
                            )
                          : 0}
                      </div>
                      <div className="text-sm text-orange-800">
                        Days as Friends
                      </div>
                    </div>
                  </div>

                  {stats.firstTransactionDate && (
                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-2">
                        Timeline
                      </h4>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>
                          First transaction:{" "}
                          {format(
                            new Date(stats.firstTransactionDate),
                            "MMMM dd, yyyy"
                          )}
                        </p>
                        {stats.lastTransactionDate && (
                          <p>
                            Last transaction:{" "}
                            {format(
                              new Date(stats.lastTransactionDate),
                              "MMMM dd, yyyy"
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Sync Modal */}
      <Modal
        isOpen={showSyncModal}
        onClose={resetModal}
        title={showConfirmation ? "Confirm Sync" : "Select Real Profile"}
      >
        {!showConfirmation ? (
          <div className="space-y-3">
            {friends.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No real friends available to sync with
              </p>
            ) : (
              friends.map((friend) => (
                <button
                  key={friend.profileId}
                  onClick={() => handleFriendSelect(friend.profileId)}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="font-medium">{friend.profileName}</div>
                  <div className="text-sm text-gray-500">Real Profile</div>
                </button>
              ))
            )}
            <div className="mt-4">
              <Button
                onClick={resetModal}
                className="w-full bg-gray-300 hover:bg-gray-400 text-gray-700"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will move all transactions from{" "}
              <strong>{friendData?.friend.name}</strong> to{" "}
              <strong>
                {
                  friends.find((f) => f.profileId === selectedFriend)
                    ?.profileName
                }
              </strong>
              . The anonymous profile will be deleted upon success. Continue?
            </p>
            <div className="flex space-x-3">
              <Button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSyncing ? "Syncing..." : "Sync"}
              </Button>
              <Button
                onClick={resetModal}
                disabled={isSyncing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FriendDetails;
