import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { apiClient } from "../services/api";
import type { ExpenseBillResponse } from "../types/expenseBill";
import BillUploadForm from "../components/BillUploadForm";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";

export default function ExpenseBills() {
  const navigate = useNavigate();
  const [bills, setBills] = useState<ExpenseBillResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBillUploadModalOpen, setIsBillUploadModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await apiClient.getAllCreatedBills();
      setBills(data);
    } catch (err) {
      setError("Failed to fetch bills");
      console.error("Failed to fetch bills:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBillUploadSuccess = (payerProfileId: string) => {
    console.log(`Bill uploaded successfully for payer: ${payerProfileId}`);
    setIsBillUploadModalOpen(false);
    fetchBills(); // Refresh the bills list
  };

  const handleBillUploadError = (error: string) => {
    console.error("Bill upload error:", error);
  };

  const handleDeleteClick = (e: React.MouseEvent, billId: string) => {
    e.stopPropagation();
    setBillToDelete(billId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (billToDelete) {
      try {
        await apiClient.deleteBill(billToDelete);
        fetchBills();
      } catch (err) {
        console.error("Failed to delete bill:", err);
      }
    }
    setDeleteConfirmOpen(false);
    setBillToDelete(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading expense bills...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Expense Bills
              </h1>
              <p className="text-gray-600">Manage your uploaded bills</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setIsBillUploadModalOpen(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Upload Bill
              </button>
              <Link
                to="/dashboard"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {bills.length === 0 ? (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6 text-center">
                <p className="text-gray-500 mb-4">No expense bills found</p>
                <Link
                  to="/dashboard"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Go back to dashboard to upload bills
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-3">
                  {bills.map((bill) => (
                    <div
                      key={bill.id}
                      onClick={() => navigate(`/expense-bills/${bill.id}`)}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              Creator:{" "}
                              {bill.isCreatedByUser
                                ? "You"
                                : bill.creatorProfileName}
                            </p>
                            <p className="text-sm text-gray-600">
                              Payer:{" "}
                              {bill.isPaidByUser
                                ? "You"
                                : bill.payerProfileName}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            {format(new Date(bill.createdAt), "MMM dd, yyyy")}
                          </p>
                          <p className="text-xs text-gray-400">
                            {format(new Date(bill.createdAt), "HH:mm")}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDeleteClick(e, bill.id)}
                          className="text-red-600 hover:text-red-800 p-1"
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
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Modal
        isOpen={isBillUploadModalOpen}
        onClose={() => setIsBillUploadModalOpen(false)}
        title="Upload Bill"
      >
        <BillUploadForm
          onUploadSuccess={handleBillUploadSuccess}
          onUploadError={handleBillUploadError}
        />
      </Modal>

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
