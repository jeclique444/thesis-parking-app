/*
 * iParkBayan — MobileLayout
 * Design: Civic Tech / Filipino Urban Identity
 * Bottom navigation shell for driver app
 */
import { useLocation } from "wouter";
import { Home, Map, BookOpen, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  headerRight?: React.ReactNode;
  noPadding?: boolean;
}

const navItems = [
  { path: "/home", icon: Home, label: "Home" },
  { path: "/map", icon: Map, label: "Find" },
  { path: "/reservations", icon: BookOpen, label: "Bookings" },
  { path: "/notifications", icon: Bell, label: "Alerts" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function MobileLayout({
  children,
  title,
  showBack,
  onBack,
  headerRight,
  noPadding,
}: MobileLayoutProps) {
  const [location, navigate] = useLocation();

  return (
    <div className="mobile-shell flex flex-col bg-background">
      {/* Header */}
      {title && (
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-border sticky top-0 z-20">
          {showBack && (
            <button
              onClick={onBack ?? (() => window.history.back())}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {!showBack && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-navy flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
              <span className="font-bold text-base text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {title}
              </span>
            </div>
          )}
          {showBack && (
            <span className="font-bold text-base text-foreground flex-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {title}
            </span>
          )}
          {headerRight && <div className="ml-auto">{headerRight}</div>}
        </header>
      )}

      {/* Content */}
      <main className={cn("flex-1 overflow-y-auto", !noPadding && "pb-20")}>
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-border z-30">
        <div className="flex items-center justify-around px-2 py-1.5">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location === path || (path !== "/home" && location.startsWith(path));
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-xl transition-all",
                  isActive && "bg-primary/10"
                )}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
