import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FriendSplitReminders } from "./FriendSplitReminders";
import { queryKeys } from "@/lib/queryKeys";

test("friend detail reminder section shows sent and received open meals", () => {
  const client = new QueryClient();
  client.setQueryData(queryKeys.splitReminders.open("friendship"), [
    { id: "a", senderProfileId: "me", description: "Lunch", mealDate: null, status: "OPEN" },
    { id: "b", senderProfileId: "friend", description: "Dinner", mealDate: "2026-07-04T15:00:00.000Z", status: "OPEN" },
  ]);
  const html = renderToStaticMarkup(<QueryClientProvider client={client}>
    <FriendSplitReminders friendshipId="friendship" friendProfileId="friend" anonymous={false} />
  </QueryClientProvider>);
  expect(html).toContain('aria-label="Send split reminder"');
  expect(html).toContain("Sent");
  expect(html).toContain("Received");
  expect(html).toContain("Lunch");
  expect(html).toContain("Dinner");
  expect(html).toContain('dateTime="2026-07-04T15:00:00.000Z"');
  expect(html).toContain("OPEN");
  client.clear();
});

test("anonymous friend gets an explanation and no send controls", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(<QueryClientProvider client={client}>
    <FriendSplitReminders friendshipId="friendship" friendProfileId="friend" anonymous />
  </QueryClientProvider>);
  expect(html).toContain("Link this friend to a real profile first.");
  expect(html).not.toContain("<form");
  client.clear();
});
