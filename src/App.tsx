import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewTransaction from './pages/NewTransaction';
import FriendDetails from './pages/FriendDetails';
import GroupExpenses from './pages/GroupExpenses';
import NewGroupExpense from './pages/NewGroupExpense';
import GroupExpenseDetails from './pages/GroupExpenseDetails';
import UpdateExpenseItem from './pages/UpdateExpenseItem';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
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
