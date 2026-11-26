import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { SendSplitReminder } from "@/lib/api/split-reminders";

export function SplitReminderForm({ onSend }: Readonly<{
  onSend: (data: SendSplitReminder, key: string) => Promise<void>;
}>) {
  const [description, setDescription] = useState("");
  const [mealDate, setMealDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const submission = useRef<{ payload: string; key: string } | null>(null);
  const busy = useRef(false);
  return <form aria-label="Send split reminder" className="space-y-3" onSubmit={async (event) => {
    event.preventDefault();
    if (busy.current) return;
    const normalized = description.replace(/\p{White_Space}+/gu, " ").trim();
    if (!normalized || [...normalized].length > 200) {
      setError("Enter a description of 1–200 characters.");
      return;
    }
    const data = { description: normalized, mealDate: mealDate || null };
    const payload = JSON.stringify(data);
    if (submission.current?.payload !== payload) submission.current = { payload, key: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    setError("");
    setSuccess(false);
    try {
      await onSend(data, submission.current.key);
      submission.current = null;
      setDescription("");
      setMealDate("");
      setSuccess(true);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Could not send split reminder. Try again."));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }}>
    <fieldset disabled={pending} className="space-y-3">
      <div><Label htmlFor="split-description">Meal description</Label>
        <Input id="split-description" name="description" required value={description}
          aria-describedby="split-error" onChange={(event) => setDescription(event.target.value)} /></div>
      <div><Label htmlFor="split-meal-date">Meal date (optional)</Label>
        <Input id="split-meal-date" name="mealDate" type="date" min="0001-01-01" max="9999-12-31"
          aria-describedby="split-error" value={mealDate} onChange={(event) => setMealDate(event.target.value)} /></div>
      <Button type="submit">{pending ? "Sending…" : "Send split reminder"}</Button>
    </fieldset>
    <p id="split-error" role="alert">{error}</p>
    <p role="status">{success ? "Split reminder sent." : ""}</p>
  </form>;
}
