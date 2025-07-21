import React, { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { apiClient } from '../services/api';
import type { FriendshipResponse, ProfileResponse } from '../types/api';

interface BillUploadFormProps {
  onUploadSuccess?: (payerProfileId: string) => void;
  onUploadError?: (error: string) => void;
}

const BillUploadForm: React.FC<BillUploadFormProps> = ({
  onUploadSuccess,
  onUploadError
}) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [preview, setPreview] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [friends, setFriends] = useState<FriendshipResponse[]>([]);
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [selectedPayerId, setSelectedPayerId] = useState<string>('');
  const [billImage, setBillImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoadingInitialData(true);
      const [
        profileData,
        friendsData,
      ] = await Promise.all([
        apiClient.getProfile(),
        apiClient.getFriendships().catch(() => []), // Fallback to empty array if fails
      ]);
      setFriends(friendsData);
      setProfile(profileData);
    } catch (err) {
      console.error('Error fetching initial data:', err);
      // Don't set error here as it's not critical for form functionality
    } finally {
      setLoadingInitialData(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (optional)
      const validTypes: string[] = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        setMessage('Please select a valid image file (JPEG, PNG, or GIF)');
        return;
      }

      // Check file size (optional - limit to 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        setMessage('File size must be less than 5MB');
        return;
      }

      setBillImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>): void => {
        if (e.target?.result) {
          setPreview(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);

      setMessage('');
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (selectedPayerId !== '' && !friends.find(f => f.profileId === selectedPayerId)) {
      setMessage('Selected payer is not valid. Please select a valid friend or "Me".');
      return;
    }

    if (!billImage) {
      setMessage('Please select a bill image');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      await apiClient.uploadBill(selectedPayerId, billImage);

      const successMessage = 'Bill uploaded successfully!';
      setMessage(successMessage);

      // Call success callback if provided
      onUploadSuccess?.(selectedPayerId);

      // Reset form
      setSelectedPayerId('');
      setBillImage(null);
      setPreview(null);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error
        ? `Upload failed: ${error.message}`
        : 'Upload failed: Unknown error occurred';

      setMessage(errorMessage);

      // Call error callback if provided
      onUploadError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Upload Bill</h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="payer" className="block text-sm font-medium text-gray-700 mb-2">
            Who paid for this expense?
          </label>
          <div className="relative">
            <select
              id="payer"
              value={selectedPayerId}
              onChange={(e) => setSelectedPayerId(e.target.value)}
              disabled={loadingInitialData}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white disabled:bg-gray-50 disabled:text-gray-500"
            >
              {loadingInitialData ? (
                <option value="me">Loading...</option>
              ) : (
                <>
                  <option value="">
                    {profile?.name ? `Me (${profile.name})` : 'Me'}
                  </option>
                  <option value="" disabled>
                    -- Select a friend --
                  </option>
                  {friends.length === 0 ? (
                    <option value="" disabled>
                      No friends available
                    </option>
                  ) : (
                    friends.map((friend) => (
                      <option key={friend.id} value={friend.profileId}>
                        {friend.profileName}
                        {friend.type === 'ANON' ? ' (Anonymous)' : ''}
                      </option>
                    ))
                  )}
                </>
              )}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              {loadingInitialData ? (
                <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </div>
          </div>
          <div className="flex items-start mt-2">
            <div className="flex items-center h-5">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-2">
              <p className="text-sm text-gray-500">
                Select who actually paid for this expense. This helps track who owes money to whom.
                {friends.length === 0 && (
                  <span className="block text-amber-600 mt-1">
                    💡 Add friends to select them as payers for shared expenses.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="billImage" className="block text-sm font-medium text-gray-700 mb-2">
            Bill Image
          </label>
          <input
            ref={fileInputRef}
            type="file"
            id="billImage"
            name="billImage"
            onChange={handleFileChange}
            accept="image/*"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSubmitting}
          />
        </div>

        {preview && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
            <img
              src={preview}
              alt="Bill preview"
              className="max-w-full h-32 object-cover rounded-md border"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
        >
          {isSubmitting ? 'Uploading...' : 'Upload Bill'}
        </button>
      </div>

      {message && (
        <div className={`mt-4 p-3 rounded-md ${message.includes('successfully')
          ? 'bg-green-100 text-green-700 border border-green-300'
          : 'bg-red-100 text-red-700 border border-red-300'
          }`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default BillUploadForm;
