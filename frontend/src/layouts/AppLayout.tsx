import { Outlet, Navigate, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { AvatarCircle } from "@/components/AvatarCircle";
import { Button } from "@/components/ui/button";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import {
  LayoutDashboard,
  Users,
  Receipt,
  User,
  LogOut,
  Menu,
  X,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { NotificationHandler } from "@/components/NotificationHandler";
import { Seo } from "@/components/Seo";
import { Separator } from "@/components/ui/separator";
import { subscriptionPurchaseEnabled } from "@/lib/flags";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Expenses", href: "/expenses", icon: Receipt },
  { name: "Friends", href: "/friends", icon: Users },
  ...(subscriptionPurchaseEnabled
    ? [{ name: "Your Plan", href: "/subscription", icon: CreditCard }]
    : []),
];

export function AppLayout() {
  const { isAuthenticated, isLoading, isRefreshFailed, user, logout } =
    useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [sidebarOpen]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <Logo size="lg" />
        </div>
      </div>
    );
  }

  if (isRefreshFailed) {
    return (
      <Navigate
        to="/login?expired=true"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-dvh bg-background">
      <Seo noindex />
      <NotificationHandler />
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 w-64 h-dvh bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border flex-shrink-0">
            <Logo />
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div className="space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </NavLink>
                );
              })}
            </div>
            <Separator />
            <div className="border-sidebar-border/50">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-10 px-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                onClick={() => {
                  globalThis.uj?.showWidget();
                  globalThis.history.pushState({ ujWidget: true }, "");
                  setSidebarOpen(false);
                }}
              >
                <MessageSquare className="h-5 w-5" />
                Give Feedback
              </Button>
            </div>
          </nav>

          {/* User section - ensure enough bottom padding for external widgets */}
          <div className="p-4 pb-8 border-t border-sidebar-border bg-sidebar relative z-[60]">
            <div className="flex items-center gap-3 mb-3">
              <AvatarCircle
                name={user?.name || "User"}
                imageUrl={user?.avatar}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1" asChild>
                <NavLink to="/profile" onClick={() => setSidebarOpen(false)}>
                  <User className="h-4 w-4 mr-1" />
                  Profile
                </NavLink>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogoutDialogOpen(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-lg border-b border-border lg:hidden">
          <div className="flex items-center justify-between h-full px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Logo />
            <NotificationDropdown />
          </div>
        </header>

        {/* Desktop header with notifications */}
        <header className="hidden lg:flex sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-lg border-b border-border items-center justify-end px-8">
          <NotificationDropdown />
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Logout confirmation */}
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={logout}
      />
    </div>
  );
}
