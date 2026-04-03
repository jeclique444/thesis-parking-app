/*
 * iParkBayan — AdminLayout
 * Design: Civic Tech / Filipino Urban Identity
 * Left sidebar layout for admin dashboard
 */
import { useLocation } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { 
  LayoutDashboard, ParkingSquare, BookOpen, BarChart3, 
  Settings, LogOut, Bell, User, MapPin, Building2, 
  Shield, CheckCircle2, Users, QrCode, Clock 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/supabaseClient";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const allNavItems = [
  { path: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard", allowedRoles: ["superadmin", "manager"] },
  { path: "/admin/lots", icon: MapPin, label: "Parking Lots", allowedRoles: ["superadmin"] },
  { path: "/admin/personnel", icon: User, label: "Personnel", allowedRoles: ["superadmin"] }, 
  { path: "/admin/scanner", icon: QrCode, label: "QR Scanner", allowedRoles: ["manager"] }, 
  { path: "/admin/slots", icon: ParkingSquare, label: "Parking Slots", allowedRoles: ["superadmin", "manager"] },
  { path: "/admin/reservations", icon: BookOpen, label: "Reservations", allowedRoles: ["superadmin", "manager"] },
  { path: "/admin/reports", icon: BarChart3, label: "Reports", allowedRoles: ["superadmin", "manager"] },
  { path: "/admin/settings", icon: Settings, label: "Settings", allowedRoles: ["superadmin", "manager"] }, 
];

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const [adminEmail, setAdminEmail] = useState<string>("Loading...");
  const [initials, setInitials] = useState<string>("A");
  const [userId, setUserId] = useState<string | null>(null);
  
  // Notification States
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  const adminRole = localStorage.getItem("admin_role") || "manager"; 
  const adminLotId = localStorage.getItem("admin_lot_id");

  const closeDropdowns = () => {
    setShowNotifs(false);
    setShowProfile(false);
  };

  // 1. FETCH NOTIFICATIONS - Inayos para sa 'admin' role at 'read' column
  const fetchNotifications = useCallback(async () => {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('recipient_role', 'admin') // Sinisigurong para sa admin lang
      .order('created_at', { ascending: false });

    // Kung manager, i-filter base sa lot_id nila
    if (adminRole === "manager" && adminLotId) {
      query = query.or(`lot_id.eq.${adminLotId},lot_id.is.null`);
    }

    const { data } = await query.limit(15);
    if (data) setNotifications(data);
  }, [adminRole, adminLotId]);

  // 2. INITIAL LOAD & REAL-TIME LISTENER
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setAdminEmail(user.email);
        setInitials(user.email.charAt(0).toUpperCase());
        setUserId(user.id);
      }
    };

    fetchUser();
    fetchNotifications();

    // REAL-TIME LISTENER: Naka-filter na sa 'admin' role
    const notifChannel = supabase
      .channel('admin-notifs-stream')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `recipient_role=eq.admin` // Real-time filter para sa admin
        }, 
        (payload) => {
          const newN = payload.new;
          // Lot ID validation para sa managers
          if (adminRole === "superadmin" || !newN.lot_id || newN.lot_id === adminLotId) {
            setNotifications(prev => [newN, ...prev]);
            toast.info(`🔔 ${newN.title}`, { 
              description: newN.message,
              action: { label: "View", onClick: () => setShowNotifs(true) }
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(notifChannel); };
  }, [adminRole, adminLotId, fetchNotifications]);

  // 3. MARK ALL AS READ - Gamit ang 'read' column
  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true }) // Gamit ang tamang column name base sa DB
      .eq('recipient_role', 'admin')
      .eq('read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success("All notifications marked as read");
    }
  };

  // 4. SESSION KICKER (Original Maintenance)
  useEffect(() => {
    if (!userId) return;
    const subscription = supabase
      .channel('admin-status-kicker')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_profiles', filter: `id=eq.${userId}` },
        async (payload: any) => {
          if (payload.new.status === 'Suspended') {
            toast.error("⚠️ SYSTEM ALERT: Ang iyong account ay sinuspinde.", { duration: 8000 });
            await supabase.auth.signOut();
            localStorage.clear();
            setTimeout(() => { navigate("/admin"); }, 2000);
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [userId, navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      toast.success("Successfully logged out");
      navigate("/admin");
    } catch (error) {
      toast.error("Error logging out");
    }
  };

  const filteredNavItems = allNavItems.filter(item => item.allowedRoles.includes(adminRole));
  const unreadCount = notifications.filter(n => n.read === false).length;

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Sidebar - Hindi ginalaw ang design */}
      <aside className="w-64 flex flex-col bg-sidebar text-sidebar-foreground shrink-0 z-20">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>iParkBayan</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">
              {adminRole === 'superadmin' ? 'Super Admin' : 'Lot Manager'} Panel
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map(({ path, icon: Icon, label }) => {
            const isActive = location === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-white uppercase border border-sidebar-border/50">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white capitalize truncate">
                {adminRole === 'superadmin' ? 'Super Admin' : 'Manager'}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate" title={adminEmail}>
                {adminEmail}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-rose-400 transition-all"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-border shrink-0 relative z-40">
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {title}
          </h1>
          
          <div className="flex items-center gap-4">
            {/* NOTIFICATIONS DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors relative"
              >
                <Bell size={18} className="text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-white"></span>
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-3 w-80 bg-white border border-border rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="bg-slate-50 border-b border-border px-4 py-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800">Notifications</h4>
                    {unreadCount > 0 && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{unreadCount} New</span>}
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
                        <div key={n.id} className={cn("w-full text-left px-4 py-3 border-b border-border flex gap-3 transition-colors", n.read === false ? "bg-primary/5" : "hover:bg-slate-50 opacity-70")}>
                          <div className={cn("mt-0.5 p-1.5 rounded-full shrink-0", n.type === 'urgent' ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600")}>
                             {n.type === 'urgent' ? <Bell size={14} /> : <CheckCircle2 size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{n.title}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{n.message}</p>
                            <p className="text-[9px] text-slate-400 mt-1 uppercase font-medium flex items-center gap-1">
                               <Clock size={10} /> {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-slate-400 text-xs italic">No notifications yet.</div>
                    )}
                  </div>
                  <div className="bg-slate-50 border-t border-border p-2">
                    <button onClick={markAllAsRead} className="w-full text-center text-xs text-primary font-bold hover:underline py-1">
                      Mark all as read
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PROFILE DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); }}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground shadow-md border-2 border-white ring-2 ring-slate-100">
                  {initials}
                </div>
              </button>

              {showProfile && (
                <div className="absolute right-0 mt-3 w-56 bg-white border border-border rounded-2xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 p-1.5">
                  <div className="px-3 py-3 border-b border-border mb-1">
                    <p className="text-sm font-bold text-slate-800 capitalize truncate">
                      {adminRole === 'superadmin' ? 'Super Admin' : 'Manager'}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5" title={adminEmail}>
                      {adminEmail}
                    </p>
                  </div>
                  <button onClick={() => toast.info("Profile settings coming soon!")} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    <User size={16} className="text-slate-500" /> My Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 font-medium hover:bg-rose-50 rounded-lg transition-colors mt-1"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* OVERLAY */}
        {(showNotifs || showProfile) && (
          <div className="fixed inset-0 z-30" onClick={closeDropdowns} />
        )}

        <main className="flex-1 overflow-y-auto p-6 bg-background relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}