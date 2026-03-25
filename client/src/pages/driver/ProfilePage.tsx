/*
 * iParkBayan — ProfilePage (Fully Database Connected)
 */
import { cn } from "@/lib/utils"; // O kung nasaan man ang utils file mo
import { useEffect, useState } from "react";
import MobileLayout from "@/components/MobileLayout";
import { 
  Car, 
  BookOpen, 
  Bell, 
  ShieldCheck, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  Loader2,
  User as UserIcon
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  
  // States para sa Real Data
  const [userProfile, setUserProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalReservations: 0,
    completedReservations: 0,
    totalVehicles: 0
  });

  useEffect(() => {
    fetchRealData();
  }, []);

  const fetchRealData = async () => {
    try {
      setLoading(true);
      
      // 1. Kunin ang Authenticated User
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        navigate("/login");
        return;
      }

      // 2. Kunin ang User Profile details (mula sa 'profiles' table mo)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setUserProfile({
        ...user,
        full_name: profileData?.full_name || user.user_metadata?.full_name || "iParkBayan User",
        phone: profileData?.phone || "No phone added"
      });

      // 3. COUNTER LOGIC: Bilangin ang totoo mong records sa DB
      // Gagamit tayo ng { count: 'exact', head: true } para hindi mabigat sa data
      const [resCount, completeCount, vehCount] = await Promise.all([
        // Bilang ng lahat ng reservations ng user
        supabase.from("reservations").select("*", { count: 'exact', head: true }).eq("user_id", user.id),
        // Bilang ng completed reservations lang
        supabase.from("reservations").select("*", { count: 'exact', head: true }).eq("user_id", user.id).eq("status", "completed"),
        // Bilang ng nakarehistrong sasakyan
        supabase.from("vehicles").select("*", { count: 'exact', head: true }).eq("user_id", user.id)
      ]);

      setStats({
        totalReservations: resCount.count || 0,
        completedReservations: completeCount.count || 0,
        totalVehicles: vehCount.count || 0
      });

    } catch (err) {
      console.error("Connection Error:", err);
      toast.error("Failed to sync with database");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate("/login");
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-white">
      <Loader2 className="animate-spin text-slate-900" size={32} />
    </div>
  );

  return (
    <MobileLayout title="Profile">
      <div className="bg-[#F8F9FB] min-h-screen px-4 py-6 space-y-6 pb-28">
        
        {/* Profile Card - Authentic Data */}
        <div className="bg-[#0A1D37] rounded-[2.5rem] p-6 text-white shadow-2xl relative overflow-hidden">
          {/* Subtle Background Pattern */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          
          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-2xl font-black border border-white/10 shadow-inner">
              {userProfile?.full_name?.substring(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight leading-tight">
                {userProfile?.full_name}
              </h2>
              <p className="text-xs text-slate-400 font-bold opacity-80">{userProfile?.email}</p>
              <div className="flex items-center gap-1.5 mt-2">
                 <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-widest border border-emerald-500/30">
                   Verified Driver
                 </span>
              </div>
            </div>
          </div>

          {/* Stats Section - Directly from Database counts */}
          <div className="grid grid-cols-3 border-t border-white/10 pt-6 relative z-10">
            <div className="text-center border-r border-white/10">
              <p className="text-xl font-black">{stats.totalReservations}</p>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">Total</p>
            </div>
            <div className="text-center border-r border-white/10">
              <p className="text-xl font-black">{stats.completedReservations}</p>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black">{stats.totalVehicles}</p>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">Vehicles</p>
            </div>
          </div>
        </div>

        {/* Action Menu */}
        <div className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm">
          <ProfileMenuItem 
            icon={<Car size={18} />} 
            title="My Vehicles" 
            label={stats.totalVehicles > 0 ? `${stats.totalVehicles} registered` : "Add vehicle"}
            onClick={() => navigate("/vehicles")} 
          />
          <ProfileMenuItem 
            icon={<BookOpen size={18} />} 
            title="Reservation History" 
            label="View all logs"
            onClick={() => navigate("/bookings")} 
          />
          <ProfileMenuItem 
            icon={<Bell size={18} />} 
            title="Notifications" 
            label="Recent alerts"
            onClick={() => navigate("/alerts")} 
          />
          <ProfileMenuItem 
            icon={<ShieldCheck size={18} />} 
            title="Security Settings" 
            label="Password & Privacy"
            isLast
          />
        </div>

        {/* Sign Out */}
        <button 
          onClick={handleLogout}
          className="w-full py-5 rounded-2xl bg-white border border-rose-50 text-rose-500 font-black text-sm shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <LogOut size={18} />
          Sign Out
        </button>

      </div>
    </MobileLayout>
  );
}

// Menu Item Helper Component
function ProfileMenuItem({ icon, title, label, onClick, isLast }: any) {
  return (
    <button 
      onClick={onClick}
     className={`w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors ${
  !isLast ? "border-b border-slate-50" : ""
}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-black text-slate-800 tracking-tight leading-none">{title}</h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{label}</p>
        </div>
      </div>
      <ChevronRight size={16} className="text-slate-200" />
    </button>
  );
}