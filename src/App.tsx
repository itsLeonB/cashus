import { lazy, Suspense } from "react";

import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import UnauthenticatedRoute from "./components/UnauthenticatedRoute";

import "./App.css";

const Register = lazy(() => import("./pages/Register"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));
const NewTransaction = lazy(() => import("./pages/NewTransaction"));
const FriendDetails = lazy(() => import("./pages/FriendDetails"));
const GroupExpenses = lazy(() => import("./pages/GroupExpenses"));
const NewGroupExpense = lazy(() => import("./pages/NewGroupExpense"));
const GroupExpenseDetails = lazy(() => import("./pages/GroupExpenseDetails"));
const UpdateExpenseItem = lazy(() => import("./pages/UpdateExpenseItem"));
const ExpenseBills = lazy(() => import("./pages/ExpenseBills"));
const ExpenseBillDetails = lazy(() => import("./pages/ExpenseBillDetails"));

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Suspense fallback={<div>Loading...</div>}>
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
          </Suspense>
          <Analytics />
          <SpeedInsights />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
