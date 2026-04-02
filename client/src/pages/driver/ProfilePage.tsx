/*
 * iParkBayan — ProfilePage (Fully Database Connected)
 * * DESCRIPTION:
 * The profile section allows users to manage their registered vehicles 
 * and view their overall booking history at a glance. It also includes 
 * links to privacy settings where Row Level Security (RLS) ensures 
 * they only have access to their own sensitive data.
 */
import { cn } from "@/lib/utils"; 
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
  Loader2
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useLocation } from "wouter";
import { toast } from "sonner";

// Helper function para kunin ang initials: First letter ng First Name + First letter ng Last Name
const getInitials = (name?: string) => {
  if (!name) return "JD";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    // Kukunin ang unang letra ng unang salita at unang letra ng huling salita
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

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

      // 2. Kunin ang User Profile details (kasama ang phone_number)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setUserProfile({
        ...user,
        full_name: profileData?.full_name || user.user_metadata?.full_name || "Juan dela Cruz",
        phone_number: profileData?.phone_number || "09XX XXX XXXX", // Ginamit ang phone_number
        email: user.email || "juan@example.com"
      });

      // 3. COUNTER LOGIC
      const [resCount, completeCount, vehCount] = await Promise.all([
        supabase.from("reservations").select("*", { count: 'exact', head: true }).eq("user_id", user.id),
        supabase.from("reservations").select("*", { count: 'exact', head: true }).eq("user_id", user.id).eq("status", "completed"),
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
      <div className="bg-[#F8F9FB] min-h-screen px-4 py-6 space-y-4 pb-28">
        
        {/* Profile Card (Dark Blue Background) */}
        <div className="bg-[#0A1D37] rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="flex items-center gap-4 mb-6 relative z-10">
            {/* Initials Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-semibold border border-white/5">
              {getInitials(userProfile?.full_name)}
            </div>
            <div>
              <h2 className="text-[17px] font-bold tracking-tight leading-tight mb-1">
                {userProfile?.full_name}
              </h2>
              <p className="text-xs text-slate-300 opacity-90">{userProfile?.email}</p>
              {/* Ipapakita ang phone_number mula sa DB */}
              <p className="text-xs text-slate-300 opacity-90">{userProfile?.phone_number}</p>
              
              {/* Ibinabalik ang Verified Driver badge */}
              <div className="flex items-center gap-1.5 mt-2">
                 <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-widest border border-emerald-500/30">
                   Verified Driver
                 </span>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-3 border-t border-white/10 pt-4 relative z-10">
            <div className="text-center border-r border-white/10">
              <p className="text-lg font-bold">{stats.totalReservations}</p>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide">Total</p>
            </div>
            <div className="text-center border-r border-white/10">
              <p className="text-lg font-bold">{stats.completedReservations}</p>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{stats.totalVehicles}</p>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide">Vehicles</p>
            </div>
          </div>
        </div>

        {/* Action Menu List */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
          <ProfileMenuItem 
            icon={<Car size={20} />} 
            title="My Vehicles" 
            label="Manage registered vehicles"
            onClick={() => navigate("/vehicles")} 
          />
          <ProfileMenuItem 
            icon={<BookOpen size={20} />} 
            title="Reservation History" 
            label="View all bookings"
            onClick={() => navigate("/reservations")} 
          />
          <ProfileMenuItem 
            icon={<Bell size={20} />} 
            title="Notifications" 
            label="Manage alerts"
            onClick={() => navigate("/notifications")} 
          />
          <ProfileMenuItem 
            icon={<ShieldCheck size={20} />} 
            title="Privacy & Security" 
            label="Password and data settings"
            onClick={() => navigate("/update-password")}
          />
          {/* Help & Support Button */}
          <ProfileMenuItem 
            icon={<HelpCircle size={20} />} 
            title="Help & Support" 
            label="FAQs and contact"
            onClick={() => window.location.href = "mailto:support@iparkbayan.com?subject=iParkBayan Help & Support"}
            isLast
          />
        </div>

        {/* Sign Out Outline Button */}
        <button 
          onClick={handleLogout}
          className="w-full py-3.5 rounded-3xl bg-white border border-rose-200 text-rose-500 font-semibold text-[15px] active:bg-rose-50 transition-all flex items-center justify-center gap-2 mt-4"
        >
          <LogOut size={18} className="text-rose-500" />
          Sign Out
        </button>

        {/* Footer Text */}
        <div className="pt-4 text-center pb-8">
          <p className="text-[10px] text-slate-400 font-medium">
            ECPark v1.0.0 - De La Salle Lipa IT3C Group 9
          </p>
        </div>

      </div>
    </MobileLayout>
  );
}

// Menu Item Helper Component
function ProfileMenuItem({ icon, title, label, onClick, isLast }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-all active:bg-slate-100 text-left",
        !isLast && "border-b border-slate-100"
      )}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
          {icon}
        </div>
        <div>
          <h4 className="text-[15px] font-bold text-slate-800 leading-tight mb-0.5">{title}</h4>
          <p className="text-[12px] text-slate-400 font-medium">{label}</p>
        </div>
      </div>
      <ChevronRight size={18} className="text-slate-300" />
    </button>
  );
}