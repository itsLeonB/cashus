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
    <div className="space-y-4">
      <div>
        <label htmlFor="payer" className="block text-sm font-medium text-gray-700 mb-2">
          Who paid for this expense?
        </label>
        <select
          id="payer"
          value={selectedPayerId}
          onChange={(e) => setSelectedPayerId(e.target.value)}
          disabled={loadingInitialData}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {loadingInitialData ? (
            <option value="">Loading...</option>
          ) : (
            <>
              <option value="">
                {profile?.name ? `Me (${profile.name})` : 'Me'}
              </option>
              {friends.map((friend) => (
                <option key={friend.id} value={friend.profileId}>
                  {friend.profileName}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      <div>
        <label htmlFor="billImage" className="block text-sm font-medium text-gray-700 mb-2">
          Bill Image
        </label>
        <input
          ref={fileInputRef}
          type="file"
          id="billImage"
          onChange={handleFileChange}
          accept="image/*"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isSubmitting}
        />
      </div>

      {preview && (
        <div>
          <img
            src={preview}
            alt="Preview"
            className="w-full h-32 object-cover rounded-md border"
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md disabled:opacity-50"
      >
        {isSubmitting ? 'Uploading...' : 'Upload Bill'}
      </button>

      {message && (
        <div className={`p-3 rounded-md text-sm ${message.includes('successfully')
          ? 'bg-green-50 text-green-700'
          : 'bg-red-50 text-red-700'
          }`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default BillUploadForm;
