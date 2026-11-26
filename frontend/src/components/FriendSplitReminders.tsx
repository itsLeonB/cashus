import { useSendSplitReminder, useSplitReminders } from "@/hooks/useApi";
import { SplitReminderForm } from "@/components/SplitReminderForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api/errors";

export function FriendSplitReminders({ friendshipId, friendProfileId, anonymous }: Readonly<{
  friendshipId: string; friendProfileId: string; anonymous: boolean;
}>) {
  const reminders = useSplitReminders(friendshipId, !anonymous);
  const send = useSendSplitReminder(friendshipId);
  return <Card>
    <CardHeader><CardTitle>Split reminders</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p>Ask the friend who paid to record and split a shared expense. This does not create a debt.</p>
      {anonymous ? <p>Split reminders need a real profile. Link this friend to a real profile first.</p> : <>
        <SplitReminderForm onSend={async (data, key) => { await send.mutateAsync({ data, key }); }} />
        <h3 className="font-semibold">Open reminders</h3>
        {reminders.isPending && <p role="status">Loading reminders…</p>}
        {reminders.isError ? <div role="alert">
          <p>{getApiErrorMessage(reminders.error, "Could not load reminders.")}</p>
          <Button variant="outline" onClick={() => void reminders.refetch()}>Retry loading reminders</Button>
        </div> : reminders.data?.length === 0 ? <p>No open reminders.</p> : <ul className="space-y-3">
          {reminders.data?.map((reminder) => <li key={reminder.id} className="rounded-md border p-3">
            <p>{reminder.senderProfileId === friendProfileId ? "Received" : "Sent"} · {reminder.status}</p>
            <p>{reminder.description}</p>
            {reminder.mealDate && <p>Meal date: <time dateTime={reminder.mealDate}>{new Date(reminder.mealDate).toLocaleDateString()}</time></p>}
          </li>)}
        </ul>}
      </>}
    </CardContent>
  </Card>;
}
