import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { apiClient } from "../services/api";
import type { ExpenseBillResponse } from "../types/expenseBill";
import AsyncImage from "../components/AsyncImage";
import ConfirmModal from "../components/ConfirmModal";

export default function ExpenseBillDetails() {
  const { billId } = useParams<{ billId: string }>();
  const navigate = useNavigate();
  const [bill, setBill] = useState<ExpenseBillResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (billId) {
      fetchBill();
    }
  }, [billId]);

  const fetchBill = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getBillDetails(billId!);
      setBill(data);
    } catch (err) {
      setError("Failed to fetch bill details");
      console.error("Failed to fetch bill details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await apiClient.deleteBill(billId!);
      navigate("/expense-bills");
    } catch (err) {
      console.error("Failed to delete bill:", err);
    }
    setDeleteConfirmOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bill details...</p>
        </div>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <h1 className="text-3xl font-bold text-gray-900">Bill Details</h1>
              <Link
                to="/expense-bills"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Back to Bills
              </Link>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error || "Bill not found"}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Bill Details</h1>
              <p className="text-gray-600">View bill information</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Delete Bill
              </button>
              <Link
                to="/expense-bills"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Back to Bills
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Bill Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <span className="font-medium text-gray-700">
                          Creator:
                        </span>{" "}
                        <span className="text-gray-900">
                          {bill.isCreatedByUser
                            ? "You"
                            : bill.creatorProfileName}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Payer:
                        </span>{" "}
                        <span className="text-gray-900">
                          {bill.isPaidByUser ? "You" : bill.payerProfileName}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          Created:
                        </span>{" "}
                        <span className="text-gray-900">
                          {format(
                            new Date(bill.createdAt),
                            "MMM dd, yyyy HH:mm"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {bill.imageUrl ? (
                  <AsyncImage src={bill.imageUrl} alt="Bill" className="h-64" />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Bill"
        message="Are you sure you want to delete this bill? This action cannot be undone."
      />
    </div>
  );
}
