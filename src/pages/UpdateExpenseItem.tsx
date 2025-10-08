import { toast } from "react-toastify";
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../services/api";
import type { ProfileResponse, FriendshipResponse } from "../types/api";
import { formatCurrency } from "../utils/currency";
import { handleApiError } from "../utils/api";
import { sanitizeString } from "../utils/form";
import type {
  ExpenseItemResponse,
  GroupExpenseResponse,
  ItemParticipantRequest,
  UpdateExpenseItemRequest,
} from "../types/groupExpense";
import { errToString } from "../utils";

const UpdateExpenseItem: React.FC = () => {
  const navigate = useNavigate();
  const { groupExpenseId, expenseItemId } = useParams<{
    groupExpenseId: string;
    expenseItemId: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [friends, setFriends] = useState<FriendshipResponse[]>([]);
  const [expenseItem, setExpenseItem] = useState<ExpenseItemResponse | null>(
    null
  );
  const [groupExpense, setGroupExpense] = useState<GroupExpenseResponse | null>(
    null
  );

  // Form state
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [participants, setParticipants] = useState<ItemParticipantRequest[]>(
    []
  );

  useEffect(() => {
    if (groupExpenseId && expenseItemId) {
      fetchInitialData();
    }
  }, [groupExpenseId, expenseItemId]);

  const fetchInitialData = async () => {
    if (!groupExpenseId || !expenseItemId) return;

    try {
      setLoadingInitialData(true);
      setError(null);

      const [profileData, friendsData, expenseItemData, groupExpenseData] =
        await Promise.all([
          apiClient.getProfile(),
          apiClient.getFriendships().catch(() => []),
          apiClient.getExpenseItemDetails(groupExpenseId, expenseItemId),
          apiClient.getGroupExpenseDetails(groupExpenseId),
        ]);

      setProfile(profileData);
      setFriends(friendsData);
      setExpenseItem(expenseItemData);
      setGroupExpense(groupExpenseData);

      // Populate form with existing data
      setName(expenseItemData.name);
      setAmount(expenseItemData.amount);
      setQuantity(expenseItemData.quantity);
      setParticipants(expenseItemData.participants || []);
    } catch (err) {
      toast.error(`Error fetching initial data: ${errToString(err)}`);
      setError(handleApiError(err));
    } finally {
      setLoadingInitialData(false);
    }
  };

  const canEditExpense = () => {
    return groupExpense && !groupExpense.participantsConfirmed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEditExpense()) {
      setError("Cannot edit expense - participants have been confirmed");
      return;
    }

    if (!groupExpenseId || !expenseItemId) {
      setError("Missing required parameters");
      return;
    }

    if (!name.trim()) {
      setError("Item name is required");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Amount must be greater than 0");
      return;
    }

    if (quantity <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }

    if (participants.length === 0) {
      setError("At least one participant is required");
      return;
    }

    // Validate that shares add up to 1 (100%)
    const totalShares = participants.reduce(
      (sum, p) => sum + parseFloat(p.share || "0"),
      0
    );
    if (Math.abs(totalShares - 1) > 0.01) {
      setError(
        `Total shares (${(totalShares * 100).toFixed(1)}%) must equal 100%`
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const updateRequest: UpdateExpenseItemRequest = {
        id: expenseItemId,
        groupExpenseId,
        name: sanitizeString(name),
        amount: amount.toString(),
        quantity,
        participants,
      };

      await apiClient.updateExpenseItem(updateRequest);

      // Navigate back to group expense details
      navigate(`/group-expenses/${groupExpenseId}`);
    } catch (err) {
      toast.error(`Error updating expense item: ${errToString(err)}`);
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleParticipantShareChange = (profileId: string, share: number) => {
    // Round to 2 decimal places and convert to string
    const roundedShare = Math.max(0, share);
    const shareString = (Math.round(roundedShare * 100) / 100).toFixed(2);
    setParticipants((prev) =>
      prev.map((p) =>
        p.profileId === profileId ? { ...p, share: shareString } : p
      )
    );
  };

  const addParticipant = (profileId: string) => {
    if (participants.some((p) => p.profileId === profileId)) {
      return; // Already added
    }

    setParticipants((prev) => [...prev, { profileId, share: "0.10" }]); // Default to 10%
  };

  const removeParticipant = (profileId: string) => {
    setParticipants((prev) => prev.filter((p) => p.profileId !== profileId));
  };

  const getParticipantName = (profileId: string) => {
    if (profileId === profile?.id) {
      return "You";
    }
    const friend = friends.find((f) => f.profileId === profileId);
    return friend?.profileName || "Unknown";
  };

  const getAllPossibleParticipants = () => {
    const allParticipants = [];

    if (profile) {
      allParticipants.push({
        id: profile.id,
        name: "You",
      });
    }

    friends.forEach((friend) => {
      allParticipants.push({
        id: friend.profileId,
        name: friend.profileName,
      });
    });

    return allParticipants;
  };

  const calculateTotalShares = () => {
    return participants.reduce((sum, p) => sum + parseFloat(p.share || "0"), 0);
  };

  const calculateTotalSharesPercentage = () => {
    return (calculateTotalShares() * 100).toFixed(1);
  };

  if (loadingInitialData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading expense item...</p>
        </div>
      </div>
    );
  }

  if (!expenseItem) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Expense item not found</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-gray-900">
                Update Expense Item
              </h1>
              <button
                onClick={() => navigate(-1)}
                className="text-gray-400 hover:text-gray-600"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {!canEditExpense() && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-amber-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-amber-800">
                      This expense item cannot be edited because the
                      participants have been confirmed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Item Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Item Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEditExpense()}
                className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                  !canEditExpense()
                    ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                    : ""
                }`}
                placeholder="Enter item name"
                required
              />
            </div>

            {/* Amount and Quantity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-gray-700"
                >
                  Individual Item Amount *
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">Rp</span>
                  </div>
                  <input
                    type="number"
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={!canEditExpense()}
                    className={`block w-full pl-12 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                      !canEditExpense()
                        ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                        : ""
                    }`}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Amount per individual item
                </p>
              </div>

              <div>
                <label
                  htmlFor="quantity"
                  className="block text-sm font-medium text-gray-700"
                >
                  Quantity *
                </label>
                <input
                  type="number"
                  id="quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  disabled={!canEditExpense()}
                  className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    !canEditExpense()
                      ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                      : ""
                  }`}
                  min="1"
                  required
                />
              </div>
            </div>

            {/* Participants */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Participants *
                  <span
                    className={`ml-2 text-sm ${
                      Math.abs(calculateTotalShares() - 1) < 0.01
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    (Total: {calculateTotalSharesPercentage()}%)
                  </span>
                </label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (participants.length > 0) {
                        const equalShare = 1 / participants.length;
                        const equalShareString = equalShare.toFixed(4);
                        setParticipants((prev) =>
                          prev.map((p) => ({ ...p, share: equalShareString }))
                        );
                      }
                    }}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Split Equally
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParticipants((prev) =>
                        prev.map((p) => ({ ...p, share: "0.00" }))
                      );
                    }}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Current Participants */}
              <div className="space-y-3 mb-4">
                {participants.map((participant) => (
                  <div
                    key={participant.profileId}
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md"
                  >
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">
                        {getParticipantName(participant.profileId)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-gray-600">
                        Share (%):
                      </label>
                      <input
                        type="number"
                        value={(
                          parseFloat(participant.share || "0") * 100
                        ).toFixed(2)}
                        onChange={(e) =>
                          handleParticipantShareChange(
                            participant.profileId,
                            (parseFloat(e.target.value) || 0) / 100
                          )
                        }
                        className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeParticipant(participant.profileId)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Participant */}
              <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
                <p className="text-sm text-gray-600 mb-3">Add participants:</p>
                <div className="flex flex-wrap gap-2">
                  {getAllPossibleParticipants()
                    .filter(
                      (person) =>
                        !participants.some((p) => p.profileId === person.id)
                    )
                    .map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => addParticipant(person.id)}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-full text-sm text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                          />
                        </svg>
                        {person.name}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Total calculation */}
            {quantity > 0 && amount && (
              <div className="bg-blue-50 p-4 rounded-md space-y-2">
                <p className="text-sm text-blue-800">
                  <strong>Individual item amount:</strong>{" "}
                  {formatCurrency(parseFloat(amount || "0"))}
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Total for {quantity} items:</strong>{" "}
                  {formatCurrency(parseFloat(amount || "0") * quantity)}
                </p>
                <div className="border-t border-blue-200 pt-2 mt-2">
                  <p className="text-sm text-blue-800 font-medium">
                    Participant costs:
                  </p>
                  {participants.map((participant) => (
                    <p
                      key={participant.profileId}
                      className="text-sm text-blue-700 ml-2"
                    >
                      • {getParticipantName(participant.profileId)}:{" "}
                      {formatCurrency(
                        parseFloat(amount || "0") *
                          quantity *
                          parseFloat(participant.share)
                      )}{" "}
                      ({(parseFloat(participant.share) * 100).toFixed(1)}%)
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !canEditExpense()}
                className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  canEditExpense()
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-400"
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? "Updating..." : "Update Item"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UpdateExpenseItem;
