/*
 * iParkBayan — ProfilePage (GCash-style Verification Logic)
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
  Loader2,
  CheckCircle2,
  ShieldAlert
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useLocation } from "wouter";
import { toast } from "sonner";

const getInitials = (name?: string) => {
  if (!name) return "JD";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalReservations: 0,
    completedReservations: 0,
    totalVehicles: 0
  });

  const MAX_VEHICLES = 3;

  useEffect(() => {
    fetchRealData();
  }, []);

  const fetchRealData = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        navigate("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setUserProfile({
        ...user,
        full_name: profileData?.full_name || user.user_metadata?.full_name || "Juan dela Cruz",
        email: user.email || "juan@example.com",
        phone_number: profileData?.phone_number || "No phone number added",
        verification_status: profileData?.verification_status?.toString().replace(/['"]/g, '').trim().toLowerCase() || "unverified", 
        user_type: profileData?.user_type?.toString().replace(/['"]/g, '').trim() || "Regular"
      });

      const [resCount, completeCount, vehCount] = await Promise.all([
        supabase.from("reservations").select("*", { count: 'exact', head: true }).eq("user_id", user.id),
        supabase.from("reservations").select("*", { count: 'exact', head: true }).eq("user_id", user.id).eq("status", "completed"),
        supabase.from("vehicles").select("*", { count: 'exact', head: true }).eq("user_id", user.id).eq("is_active", true)
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

  // Helper variables for logic
  const isVerified = userProfile?.verification_status === 'verified';
  const isUnverified = userProfile?.verification_status === 'unverified';
  const isPending = userProfile?.verification_status === 'pending';

  return (
    <MobileLayout title="Profile">
      <div className="bg-[#F8F9FB] min-h-screen px-4 py-6 space-y-4 pb-28">
        
        {/* Profile Card */}
        <div className="bg-[#0A1D37] rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-semibold border border-white/5 shrink-0">
              {getInitials(userProfile?.full_name)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-[17px] font-bold tracking-tight leading-tight">
                  {userProfile?.full_name}
                </h2>
                {/* GCash-style Verification Check */}
                {isVerified && <CheckCircle2 size={16} className="text-blue-400 fill-blue-400/20" />}
              </div>
              {/* Phone number and Email details */}
              <p className="text-xs text-slate-300 opacity-90 mt-0.5">{userProfile?.phone_number}</p>
              <p className="text-[11px] text-slate-400 opacity-80">{userProfile?.email}</p>
              
              {/* Fully Verified & Benefits Logic */}
              <div className="mt-2">
                {isVerified ? (
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                      Fully Verified
                    </span>
                    <button 
                      onClick={() => toast.info("Your Benefits: 20% Discount for Senior/PWD slots and priority customer support.")}
                      className="text-[10px] text-slate-400 underline underline-offset-2 mt-0.5"
                    >
                      View Benefits
                    </button>
                  </div>
                ) : (
                  <span className={cn(
                    "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border",
                    isPending ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                  )}>
                    {isPending ? "Verification Pending" : "Basic Account"}
                  </span>
                )}
              </div>
            </div>
          </div>

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
              <p className="text-lg font-bold">
                {stats.totalVehicles} <span className="text-xs font-normal text-slate-400">/ {MAX_VEHICLES}</span>
              </p>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide">Vehicles</p>
            </div>
          </div>
        </div>

        {/* GCash-style "Get Verified Now" Banner Logic */}
        {isUnverified && (
          <div 
            onClick={() => navigate("/driver/verification")}
            className="bg-blue-600 rounded-2xl p-4 flex items-center justify-between shadow-md active:scale-[0.98] transition-all cursor-pointer border border-blue-500"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <ShieldAlert size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white font-black text-sm leading-tight">Get Verified Now</p>
                <p className="text-blue-100 text-[10px]">Secure your account & unlock benefits</p>
              </div>
            </div>
            <div className="bg-white text-blue-600 text-[10px] font-black px-3 py-1.5 rounded-full shadow-sm">
              GO
            </div>
          </div>
        )}

        {/* Action Menu List */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
          <ProfileMenuItem 
            icon={<Car size={20} />} 
            title="My Vehicles" 
            label={stats.totalVehicles >= MAX_VEHICLES ? "Max limit reached (3/3)" : "Manage registered vehicles"}
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
          <ProfileMenuItem 
            icon={<HelpCircle size={20} />} 
            title="Help & Support" 
            label="FAQs and contact"
            onClick={() => window.location.href = "mailto:support@iparkbayan.com"}
            isLast
          />
        </div>

        <button 
          onClick={handleLogout}
          className="w-full py-3.5 rounded-3xl bg-white border border-rose-200 text-rose-500 font-semibold text-[15px] active:bg-rose-50 transition-all flex items-center justify-center gap-2 mt-4"
        >
          <LogOut size={18} className="text-rose-500" />
          Sign Out
        </button>

        <div className="pt-4 text-center pb-8">
          <p className="text-[10px] text-slate-400 font-medium">
            iParkBayan v1.0.0 - De La Salle Lipa IT3C Group 9
          </p>
        </div>

      </div>
    </MobileLayout>
  );
}

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
          <p className={cn(
            "text-[12px] font-medium",
            label.includes("Max limit") || label.includes("Upload ID") ? "text-amber-500" : "text-slate-400"
          )}>
            {label}
          </p>
        </div>
      </div>
      <ChevronRight size={18} className="text-slate-300" />
    </button>
  );
}