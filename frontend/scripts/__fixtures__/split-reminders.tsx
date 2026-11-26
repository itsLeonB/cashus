import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import FriendDetailPage from "@/pages/FriendDetailPage";

// Exercise the real query hooks and API client; only the HTTP boundary is fake.
Object.assign(window, { requests: [], fail: true, failureStatus: 500, hold: false, release: () => {} });
let reminders = [];
window.fetch = async (_url, init) => {
  if (init?.method === "POST") {
    const request = { data: JSON.parse(String(init.body)), headers: Object.fromEntries(new Headers(init.headers)) };
    window.requests.push(request);
    if (window.hold) await new Promise<void>((resolve) => { window.release = resolve; });
    if (window.fail) return Response.json({ detail: window.failureStatus === 409 ? "This meal already has an open reminder." : "Lost response" }, { status: window.failureStatus });
    reminders = [{ ...request.data, id: "sent", senderProfileId: "me", status: "OPEN" }];
    return Response.json(reminders[0]);
  }
  if (String(_url).endsWith('/friendships/friendship')) return Response.json({
    friend: { id: 'friendship', profileId: 'friend', name: 'Test Friend', type: 'REAL', createdAt: '2026-01-01T00:00:00Z' },
    balancesPerCurrency: {},
  });
  return Response.json(String(_url).includes('split-reminders') ? reminders : []);
};
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <AuthProvider><MemoryRouter initialEntries={["/friends/friendship"]}>
      <Routes><Route path="/friends/:friendId" element={<FriendDetailPage />} /></Routes>
    </MemoryRouter></AuthProvider>
  </QueryClientProvider>,
);

declare global {
  interface Window {
    requests: { data: { description: string; mealDate: string | null }; headers: Record<string, string> }[];
    fail: boolean;
    failureStatus: number;
    hold: boolean;
    release: () => void;
  }
}
