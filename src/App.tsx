import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ExpenseBills from "./pages/ExpenseBills";
import OAuthCallback from "./pages/OAuthCallback";
import FriendDetails from "./pages/FriendDetails";
import GroupExpenses from "./pages/GroupExpenses";
import NewTransaction from "./pages/NewTransaction";
import { AuthProvider } from "./contexts/AuthContext";
import NewGroupExpense from "./pages/NewGroupExpense";
import ProtectedRoute from "./components/ProtectedRoute";
import UpdateExpenseItem from "./pages/UpdateExpenseItem";
import ExpenseBillDetails from "./pages/ExpenseBillDetails";
import GroupExpenseDetails from "./pages/GroupExpenseDetails";
import UnauthenticatedRoute from "./components/UnauthenticatedRoute";

import "./App.css";

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route
              path="/login"
              element={
                <UnauthenticatedRoute>
                  <Login />
                </UnauthenticatedRoute>
              }
            />
            <Route
              path="/register"
              element={
                <UnauthenticatedRoute>
                  <Register />
                </UnauthenticatedRoute>
              }
            />
            <Route path="/auth/google/callback" element={<OAuthCallback />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transactions/new"
              element={
                <ProtectedRoute>
                  <NewTransaction />
                </ProtectedRoute>
              }
            />
            <Route
              path="/friends/:friendId"
              element={
                <ProtectedRoute>
                  <FriendDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/group-expenses"
              element={
                <ProtectedRoute>
                  <GroupExpenses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/group-expenses/new"
              element={
                <ProtectedRoute>
                  <NewGroupExpense />
                </ProtectedRoute>
              }
            />
            <Route
              path="/group-expenses/:expenseId"
              element={
                <ProtectedRoute>
                  <GroupExpenseDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/group-expenses/:groupExpenseId/items/:expenseItemId/edit"
              element={
                <ProtectedRoute>
                  <UpdateExpenseItem />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expense-bills"
              element={
                <ProtectedRoute>
                  <ExpenseBills />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expense-bills/:billId"
              element={
                <ProtectedRoute>
                  <ExpenseBillDetails />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          <Analytics />
          <SpeedInsights />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
