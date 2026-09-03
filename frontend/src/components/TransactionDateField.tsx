import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import {
  formatTransactionDateValue,
  getTodayDateString,
  parseTransactionDateValue,
} from "@/lib/validations/transaction";

// transactionDate is a plain "YYYY-MM-DD" calendar date with no time
// component; format it in the viewer's own locale (no explicit locale
// argument) but parse it in UTC so the displayed day doesn't shift for
// viewers behind UTC — same UTC-anchored parsing as
// RecentTransactions/TransactionHistory's formatDate.
const formatTransactionDateLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

interface TransactionDateFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}

export function TransactionDateField({
  id,
  value,
  onChange,
}: Readonly<TransactionDateFieldProps>) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon className="h-4 w-4" />
          {formatTransactionDateLabel(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {/* timeZone="UTC" anchors every grid cell, the built-in "today"
            highlight, and the initial visible month to the backend's UTC
            calendar day (see getTodayDateString) — without it
            react-day-picker builds cells and "today" from the viewer's
            local timezone, which for any viewer not at UTC+0 disagrees
            with the UTC-based `disabled` cutoff below and can grey out —
            or mislabel as "today" — the wrong cell. */}
        <Calendar
          mode="single"
          timeZone="UTC"
          selected={parseTransactionDateValue(value)}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatTransactionDateValue(date));
            setOpen(false);
          }}
          disabled={(date) =>
            formatTransactionDateValue(date) > getTodayDateString()
          }
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
