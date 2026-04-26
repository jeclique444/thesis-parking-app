/*
 * iParkBayan — ManageGuards (Manager Creation & Roster for Guards)
 */
import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  Users, 
  Building2, 
  UserMinus, 
  UserCheck, 
  User,
  ScanLine
} from "lucide-react";
import { supabase } from "@/supabaseClient"; 
import { createClient } from "@supabase/supabase-js";

// Secondary Client gamit ang ANON KEY para hindi ma-logout si Manager
const authSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false, 
      autoRefreshToken: false,
    }
  }
);

export default function ManageGuards() {
  const [managerLotId, setManagerLotId] = useState<string | null>(null);
  const [managerLotName, setManagerLotName] = useState<string>("");
  const [guards, setGuards] = useState<any[]>([]);
  
  const [guardName, setGuardName] = useState("");
  const [guardEmail, setGuardEmail] = useState("");
  const [guardPassword, setGuardPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchManagerDataAndGuards();
  }, []);

  const fetchManagerDataAndGuards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Kunin ang Lot ID at Lot Name ng Manager
      const { data: profile, error: profileError } = await supabase
        .from('admin_profiles')
        .select('lot_id, parking_lots(name)')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      if (profile && profile.lot_id) {
        setManagerLotId(profile.lot_id);
        
        // 🔥 FIX PARA SA TYPESCRIPT ERROR 🔥
        const lotData: any = profile.parking_lots;
        const lotName = Array.isArray(lotData) ? lotData[0]?.name : lotData?.name;
        setManagerLotName(lotName || "Assigned Lot");

        // 2. Fetch guards na kabilang lang sa Lot ng Manager
        const { data: guardsData, error } = await supabase
          .from('admin_profiles')
          .select('id, full_name, role, status') 
          .eq('role', 'guard')
          .eq('lot_id', profile.lot_id)
          .order('status', { ascending: true }); 
          
        if (!error && guardsData) setGuards(guardsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleAddGuard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardName || !guardEmail || !guardPassword) {
      return toast.error("Pakikumpleto ang lahat ng fields.");
    }
    if (guardPassword.length < 6) {
      return toast.error("Ang password ay dapat at least 6 characters.");
    }
    if (!managerLotId) {
      return toast.error("System Error: No lot assigned to your account.");
    }

    setIsSubmitting(true);
    try {
      // Create user sa Auth gamit ang Secondary Client
      const { data: authData, error: authError } = await authSupabase.auth.signUp({
        email: guardEmail,
        password: guardPassword,
        options: {
          data: {
            role: 'guard' // 👈 Importante ito! Ito ang binabasa ng SQL trigger natin.
          }
        }
      });

      if (authError) throw authError;

      const newUserId = authData.user?.id;
      if (!newUserId) throw new Error("Hindi nakuha ang User ID.");

      // Save sa admin_profiles table
      const { error: profileError } = await supabase.from('admin_profiles').insert([{
        id: newUserId,
        full_name: guardName,
        lot_id: managerLotId,
        role: 'guard',
        status: 'Active'
      }]);

      if (profileError) throw profileError;

      toast.success(`Guard account para kay ${guardName} nagawa na!`);
      setGuardName(""); setGuardEmail(""); setGuardPassword("");
      fetchManagerDataAndGuards(); 
    } catch (error: any) {
      console.error(error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Suspend / Reactivate
  const handleToggleStatus = async (guardId: string, currentStatus: string, name: string) => {
    const safeStatus = currentStatus || 'Active';
    const newStatus = safeStatus === 'Suspended' ? 'Active' : 'Suspended';
    const actionText = newStatus === 'Suspended' ? 'i-suspend' : 'i-activate';
    
    if (!window.confirm(`Sigurado ka bang gusto mong ${actionText} ang access ni ${name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_profiles')
        .update({ status: newStatus })
        .eq('id', guardId);

      if (error) throw error;

      toast.success(`Guard account successfully ${newStatus.toLowerCase()}!`);
      fetchManagerDataAndGuards();
    } catch (error: any) {
      console.error(error);
      toast.error(`Error: ${error.message}`);
    }
  };

  return (
    <AdminLayout title="Staff Management">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: CREATE GUARD FORM */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl shadow-sm border border-border overflow-hidden">
            
            {/* HEADER SECTION */}
            <div className="bg-sidebar p-8 text-white relative overflow-hidden">
              <div className="relative z-10 space-y-2">
                <h2 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}> 
                  New Guard 
                </h2>
                
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-8 bg-primary"></div>
                  <p className="text-primary text-[11px] font-black uppercase tracking-[0.2em]"> 
                    Scanner Access 
                  </p>
                </div>
              </div>

              {/* Decorative Icon */}
              <div className="absolute -right-5 -bottom-5 opacity-10 rotate-[-15deg]">
                <ShieldCheck size={140} />
              </div>
            </div>

            <form onSubmit={handleAddGuard} className="p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground ml-1">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input 
                    className="h-12 rounded-xl pl-10 focus:ring-2 focus:ring-primary"
                    type="text" placeholder="e.g. Cardo Dalisay" 
                    value={guardName} onChange={(e) => setGuardName(e.target.value)} required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground ml-1">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input 
                    className="h-12 rounded-xl pl-10 focus:ring-2 focus:ring-primary"
                    type="email" placeholder="guard1@ipark.ph" 
                    value={guardEmail} onChange={(e) => setGuardEmail(e.target.value)} required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground ml-1">Initial Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input 
                    className="h-12 rounded-xl pl-10 focus:ring-2 focus:ring-primary"
                    type="password" placeholder="Min. 6 characters" 
                    value={guardPassword} onChange={(e) => setGuardPassword(e.target.value)} required
                  />
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[11px] text-muted-foreground text-center mb-3">
                  This account will be permanently linked to <br/><strong className="text-foreground">{managerLotName}</strong>.
                </p>
                <Button 
                  type="submit" disabled={isSubmitting} 
                  className="w-full h-12 font-bold uppercase tracking-widest rounded-xl transition-all active:scale-95"
                >
                  {isSubmitting ? "Creating..." : "Create Account"}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE GUARDS LIST */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-border p-6 h-full min-h-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2 rounded-lg text-foreground">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">On-Ground Staff</h3>
                  <p className="text-xs text-muted-foreground">List of personnel with scanner access</p>
                </div>
              </div>
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                {guards.length} Registered
              </div>
            </div>

            {guards.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground bg-slate-50 rounded-xl border border-dashed border-border">
                <ScanLine size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No guards registered yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {guards.map((guard, index) => {
                  const isActive = guard.status !== 'Suspended';
                  
                  return (
                    <div 
                      key={index} 
                      className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                        isActive 
                          ? 'border-border bg-slate-50 hover:border-primary/50' 
                          : 'border-rose-200 bg-rose-50/50 opacity-80'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 uppercase ${
                          isActive ? 'bg-sidebar text-white' : 'bg-rose-200 text-rose-700'
                        }`}>
                          {guard.full_name ? guard.full_name.charAt(0) : 'G'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground">
                              {guard.full_name || "Unknown Guard"}
                            </p>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {isActive ? 'Active' : 'Suspended'}
                            </span>
                          </div>
                          <div className={`flex items-center gap-1.5 mt-1 text-xs font-medium ${
                            isActive ? 'text-primary' : 'text-rose-500'
                          }`}>
                            <Building2 size={12} />
                            {managerLotName}
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleToggleStatus(guard.id, guard.status, guard.full_name)}
                        className={`p-2 rounded-lg transition-colors ${
                          isActive 
                            ? 'text-rose-500 hover:bg-rose-100' 
                            : 'text-emerald-600 hover:bg-emerald-100'
                        }`}
                        title={isActive ? "Suspend Access" : "Reactivate Access"}
                      >
                        {isActive ? <UserMinus size={18} /> : <UserCheck size={18} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}