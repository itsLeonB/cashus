import { useRef, useState, DragEvent, ChangeEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, ImageIcon, X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useGetUploadUrl, useTriggerBillParsing } from "@/hooks/useApi";
import { ApiError } from "@/lib/api/types";
import { useUploadPermission } from "@/hooks/useUploadPermission";
import { UploadLimitInfo } from "@/components/UploadLimitInfo";
import { compressImageForOCR } from "@/utils/compressImageForOCR";

interface ImageUploadAreaProps {
  expenseId?: string;
  onUploadSuccess?: () => void;
  className?: string;
}

export function ImageUploadArea({
  expenseId,
  onUploadSuccess,
  className,
}: Readonly<ImageUploadAreaProps>) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const uploadPermission = useUploadPermission();
  const getUploadUrl = useGetUploadUrl(expenseId);
  const notifyPresignedUploaded = useTriggerBillParsing(expenseId);
  const [isUploadingPresigned, setIsUploadingPresigned] = useState(false);

  const isUploading =
    getUploadUrl.isPending ||
    notifyPresignedUploaded.isPending ||
    isUploadingPresigned;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please select an image file",
      });
      return;
    }

    // Apply compression before upload
    let fileToUpload = file;
    try {
      fileToUpload = await compressImageForOCR(file);
    } catch (error) {
      console.error("Compression component error:", error);
      // Fallback to original file is handled by initialization
    }

    setSelectedFile(fileToUpload);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(URL.createObjectURL(fileToUpload));

    if (expenseId && uploadPermission.canUpload) {
      const handleUploadError = (error: unknown) => {
        const err = error as ApiError;

        if (err.statusCode === 422) {
          setUploadError(
            err.message ||
              "This image couldn't be processed. Please try another photo.",
          );
          if (err.errors) {
            console.error("Backend validation failed:", err.errors);
          }
        } else {
          toast({
            variant: "destructive",
            title: "Upload failed",
            description: err.message || "Something went wrong",
          });
          clearInputs();
        }
      };

      const handleSuccess = () => {
        toast({ title: "Bill uploaded successfully" });
        onUploadSuccess?.();
      };

      getUploadUrl.mutate(
        { file: fileToUpload },
        {
          onSuccess: (response) => {
            const runUpload = async () => {
              setIsUploadingPresigned(true);
              try {
                const res = await fetch(response.uploadUrl, {
                  method: "PUT",
                  body: fileToUpload,
                  headers: {
                    "Content-Type": fileToUpload.type,
                  },
                });

                if (!res.ok) {
                  throw new Error("Failed to upload image to storage");
                }

                notifyPresignedUploaded.mutate(response.billId, {
                  onSuccess: handleSuccess,
                  onError: handleUploadError,
                });
              } catch (error) {
                toast({
                  variant: "destructive",
                  title: "Upload failed",
                  description:
                    error instanceof Error
                      ? error.message
                      : "Failed to upload image directly",
                });
                clearInputs();
              } finally {
                setIsUploadingPresigned(false);
              }
            };

            runUpload();
          },
          onError: handleUploadError,
        },
      );
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const clearInputs = () => {
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
  };

  if (selectedFile && previewUrl) {
    return (
      <div
        className={cn(
          "relative rounded-lg border border-border overflow-hidden",
          className,
        )}
      >
        <img
          src={previewUrl}
          alt="Preview"
          className="w-full max-h-64 object-contain bg-muted/30"
        />
        {isUploading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="absolute top-2 right-2 h-8 w-8"
          onClick={clearInputs}
          disabled={isUploading}
        >
          <X className="h-4 w-4" />
        </Button>
        {uploadError && (
          <div className="absolute inset-x-0 bottom-0 bg-destructive/90 text-destructive-foreground p-2 text-xs flex items-center gap-2">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span className="flex-1">{uploadError}</span>
          </div>
        )}
      </div>
    );
  }

  const isDisabled = uploadPermission.isLoading || !uploadPermission.canUpload;

  const uploadHelpMsg = () => {
    if (uploadPermission.isLoading) return "Checking upload permissions…";
    if (uploadPermission.canUpload)
      return "Drag and drop an image, or choose an option below";
    return "Uploads are currently unavailable";
  };

  return (
    <div className={className}>
      <div
        onDrop={isDisabled ? undefined : handleDrop}
        onDragOver={isDisabled ? undefined : handleDragOver}
        onDragLeave={isDisabled ? undefined : handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border",
          isDisabled && "opacity-60 cursor-not-allowed",
        )}
      >
        <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-3">{uploadHelpMsg()}</p>
        <UploadLimitInfo permission={uploadPermission} />
        <div className="flex gap-3 justify-center mt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-2"
            disabled={isDisabled}
          >
            <Camera className="h-4 w-4" />
            Take Photo
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center gap-2"
            disabled={isDisabled}
          >
            <ImageIcon className="h-4 w-4" />
            Gallery
          </Button>
        </div>
      </div>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
