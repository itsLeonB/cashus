import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TransferMethodsList } from "@/components/TransferMethodsList";
import { useProfileTransferMethods } from "@/hooks/useApi";
import { CreditCard } from "lucide-react";

interface TransferMethodsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  profileName: string;
}

export function TransferMethodsModal({
  open,
  onOpenChange,
  profileId,
  profileName,
}: Readonly<TransferMethodsModalProps>) {
  const { data: methods, isLoading } = useProfileTransferMethods(
    profileId,
    open
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {profileName}'s Transfer Methods
          </DialogTitle>
        </DialogHeader>
        <TransferMethodsList
          methods={methods}
          isLoading={isLoading}
          emptyMessage="No transfer methods available"
          emptyDescription={`${profileName} hasn't added any payment methods yet`}
        />
      </DialogContent>
    </Dialog>
  );
}
