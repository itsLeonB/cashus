import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { User, Mail, Edit, ArrowLeft } from "lucide-react";
import Modal from "../components/Modal";
import apiClient from "../services/api";
import { toast } from "react-toastify";
import { errToString } from "../utils";

const Profile: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [name, setName] = useState(profile?.name || "");
  const [isLoading, setIsLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiClient.updateName(name);
      await refreshProfile();
      setIsEditModalOpen(false);
    } catch (error) {
      toast.error(`Failed to update name: ${errToString(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!profile?.email) return;

    setResetLoading(true);
    try {
      await apiClient.sendPasswordReset(profile.email);
      toast.success("Password reset link sent to your email");
    } catch (error) {
      toast.error(`Failed to send reset email: ${errToString(error)}`);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-32"></div>
          <div className="relative px-6 pb-6">
            <div className="flex justify-center -mt-16 mb-4">
              <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                {profile?.avatar && (
                  <AvatarImage src={profile.avatar} alt={profile.name} />
                )}
                <AvatarFallback className="bg-gray-100 text-gray-600">
                  <User className="h-16 w-16" />
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900">
                  {profile?.name}
                </h1>
                <button
                  onClick={() => {
                    setName(profile?.name || "");
                    setIsEditModalOpen(true);
                  }}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Edit className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center justify-center text-gray-600 bg-gray-50 rounded-lg py-3 px-4">
                <Mail className="h-5 w-5 mr-2" />
                <span className="text-sm">{profile?.email}</span>
              </div>

              <button
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="w-full py-2 px-4 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              >
                {resetLoading ? "Sending..." : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile"
      >
        <form onSubmit={handleSaveName}>
          <div className="mb-4">
            <label
              className="block text-sm font-medium text-gray-700 mb-2"
              htmlFor="name"
            >
              Name
            </label>
            <input
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Profile;
