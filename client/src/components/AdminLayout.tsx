/*
 * iParkBayan — AdminLayout
 * Design: Civic Tech / Filipino Urban Identity
 * Left sidebar layout for admin dashboard
 */
import { useLocation } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { 
  LayoutDashboard, ParkingSquare, BookOpen, BarChart3, 
  Settings, LogOut, Bell, User, MapPin, 
  CheckCircle2, Users, QrCode, Clock,
  ShieldCheck 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/supabaseClient";

// IMPORTANT: Import the DarkVeil component
import DarkVeil from "@/components/ui/dark-veil"; 

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const allNavItems = [
  { path: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard", allowedRoles: ["superadmin", "manager"] },
  { path: "/admin/lots", icon: MapPin, label: "Parking Lots", allowedRoles: ["superadmin"] },
  { path: "/admin/scanner", icon: QrCode, label: "QR Scanner", allowedRoles: ["manager", "guard"] },
  { path: "/admin/slots", icon: ParkingSquare, label: "Parking Slots", allowedRoles: ["superadmin", "manager", "guard"] },
  { path: "/admin/personnel", icon: User, label: "Personnel", allowedRoles: ["superadmin"] }, 
  { path: "/admin/verifications", icon: ShieldCheck, label: "Verifications", allowedRoles: ["superadmin"] }, 
  { path: "/admin/reservations", icon: BookOpen, label: "Reservations", allowedRoles: ["superadmin", "manager"] },
  { path: "/admin/reports", icon: BarChart3, label: "Reports", allowedRoles: ["superadmin", "manager"] },
  { path: "/admin/staffmanagement", icon: Users, label: "Staff Management", allowedRoles: ["manager"] },
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

  const fetchNotifications = useCallback(async () => {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('recipient_role', 'admin') 
      .order('created_at', { ascending: false });

    if (adminRole === "manager" && adminLotId) {
      query = query.or(`lot_id.eq.${adminLotId},lot_id.is.null`);
    }

    const { data } = await query.limit(15);
    if (data) setNotifications(data);
  }, [adminRole, adminLotId]);

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

    const notifChannel = supabase
      .channel('admin-notifs-stream')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `recipient_role=eq.admin` 
        }, 
        (payload) => {
          const newN = payload.new;
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

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true }) 
      .eq('recipient_role', 'admin')
      .eq('read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success("All notifications marked as read");
    }
  };

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
      
      {/* ================================================= */}
      {/* SIDEBAR START */}
      {/* ================================================= */}
      <aside className="w-64 flex flex-col shrink-0 z-20 relative overflow-hidden bg-black text-white border-r border-border/50">
        
        {/* The Dark Veil Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <DarkVeil
            speed={1.5}
            noiseIntensity={0.06}
            scanlineIntensity={0.3}
            scanlineFrequency={800}
            hueShift={180}
            warpAmount={0.3}
            resolutionScale={1}
          />
          {/* A slight dark overlay so the text remains easy to read */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
        </div>

        {/* Sidebar Content Wrapper (Z-10 keeps it above the veil) */}
        <div className="relative z-10 flex flex-col h-full w-full">
          
          {/* Top: Branding */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
            {/* Replaced SVG with your new Logo */}
            <img 
              src="/ParKadav2.png" 
              alt="ParKada Logo" 
              className="w-10 h-10 object-contain drop-shadow-md" 
            />
            <div>
              <p className="font-extrabold text-lg text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                ParKada
              </p>
              <p className="text-xs text-white/70 capitalize">
                {adminRole === 'superadmin' ? 'Super Admin' : 'Lot Manager'} Panel
              </p>
            </div>
          </div>

          {/* Navigation Links */}
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
                      // Changed from Yellow to crisp White
                      ? "bg-white text-slate-900 shadow-md font-bold" 
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon size={18} />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Bottom Profile */}
          <div className="px-3 py-4 border-t border-white/10 space-y-1">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white uppercase border border-white/20">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white capitalize truncate">
                  {adminRole === 'superadmin' ? 'Super Admin' : 'Manager'}
                </p>
                <p className="text-[10px] text-white/50 truncate" title={adminEmail}>
                  {adminEmail}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-rose-400 transition-all"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
      {/* ================================================= */}
      {/* SIDEBAR END */}
      {/* ================================================= */}

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