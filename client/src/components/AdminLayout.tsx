/*
 * iParkBayan — AdminLayout
 * Design: Civic Tech / Filipino Urban Identity
 * Left sidebar layout for admin dashboard
 */
import { useLocation } from "wouter";
import {
  LayoutDashboard, ParkingSquare, BookOpen,
  BarChart3, Settings, LogOut, Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const navItems = [
  { path: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/admin/slots", icon: ParkingSquare, label: "Parking Slots" },
  { path: "/admin/reservations", icon: BookOpen, label: "Reservations" },
  { path: "/admin/reports", icon: BarChart3, label: "Reports" },
  { path: "/admin/settings", icon: Settings, label: "Settings" },
];

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const [location, navigate] = useLocation();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-sidebar text-sidebar-foreground shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>iParkBayan</p>
            <p className="text-xs text-sidebar-foreground/60">Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-white">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">Admin User</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">admin@iparkbayan.ph</p>
            </div>
          </div>
          <button
            onClick={() => { toast.info("Logged out"); navigate("/admin"); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-border shrink-0">
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {title}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => toast.info("No new notifications")}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors relative"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
            </button>
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
              A
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
