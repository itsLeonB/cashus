import { TransferMethod } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Check,
  ChevronsUpDown,
  Banknote,
  CreditCard,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TransferMethodSelectProps {
  transferMethodOpen: boolean;
  setTransferMethodOpen: (open: boolean) => void;
  isLoadingMethods: boolean;
  selectedMethod?: TransferMethod;
  setSelectedMethod: (method: TransferMethod) => void;
  transferMethods?: TransferMethod[];
}

const TransferMethodSelect = ({
  transferMethodOpen,
  setTransferMethodOpen,
  isLoadingMethods,
  selectedMethod,
  setSelectedMethod,
  transferMethods,
}: TransferMethodSelectProps) => {
  const getTransferIcon = (method: TransferMethod) => {
    if (method.iconUrl)
      return (
        <img
          src={method.iconUrl}
          alt={method.name}
          className="h-5 w-5 rounded object-contain"
        />
      );

    const lower = method.name.toLowerCase();
    if (lower.includes("cash")) return <Banknote />;
    if (lower.includes("card") || lower.includes("credit"))
      return <CreditCard />;
    return <Wallet />;
  };

  const transferMethodInput = () => {
    if (isLoadingMethods)
      return <span className="text-muted-foreground">Loading...</span>;

    if (selectedMethod)
      return (
        <div className="flex items-center gap-2">
          {getTransferIcon(selectedMethod)}
          <span>{selectedMethod.display}</span>
        </div>
      );

    return (
      <span className="text-muted-foreground">Select transfer method...</span>
    );
  };

  return (
    <div className="space-y-2">
      <Label>Transfer Method</Label>
      <Popover open={transferMethodOpen} onOpenChange={setTransferMethodOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={transferMethodOpen}
            className="w-full justify-between"
            disabled={isLoadingMethods}
          >
            {transferMethodInput()}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 z-50" align="start">
          <Command>
            <CommandInput placeholder="Search transfer method..." />
            <CommandList>
              <CommandEmpty>No transfer method found.</CommandEmpty>
              <CommandGroup>
                {transferMethods?.map((method) => (
                  <CommandItem
                    key={method.id}
                    value={method.display}
                    onSelect={() => {
                      setSelectedMethod(method);
                      setTransferMethodOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {getTransferIcon(method)}
                      <span>{method.display}</span>
                    </div>
                    <Check
                      className={cn(
                        "h-4 w-4",
                        selectedMethod?.id === method.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default TransferMethodSelect;
