/*
 * iParkBayan — AdminPersonnel (System Manager Creation via Edge Function Invite)
 */
import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  UserPlus, 
  ShieldCheck, 
  Mail, 
  MapPin, 
  Database, 
  Users, 
  Building2, 
  UserMinus, 
  UserCheck 
} from "lucide-react";
import { supabase } from "@/supabaseClient"; 

export default function AdminPersonnel() {
  const [lots, setLots] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  
  const [adminEmail, setAdminEmail] = useState("");
  const [adminLotId, setAdminLotId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLots();
    fetchManagers();
  }, []);

  const fetchLots = async () => {
    const { data, error } = await supabase.from('parking_lots').select('id, name');
    if (!error && data) setLots(data);
  };

  const fetchManagers = async () => {
    const { data, error } = await supabase
      .from('admin_profiles')
      .select('id, role, status, parking_lots(name)')
      .eq('role', 'manager')
      .order('status', { ascending: true });
      
    if (!error && data) setManagers(data);
  };

  // Invite manager via Edge Function (no password needed)
  const handleInviteManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminLotId) {
      return toast.error("Please fill in email and select a parking lot.");
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("invite-manager", {
        body: { 
          email: adminEmail, 
          lot_id: adminLotId, 
          role: "manager" 
        }
      });

      if (error) throw error;

      toast.success(`Invitation sent to ${adminEmail}. They will receive an email to set their password.`);
      setAdminEmail("");
      setAdminLotId("");
      fetchManagers(); 
    } catch (error: any) {
      console.error(error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Suspend / Reactivate
  const handleToggleStatus = async (managerId: string, currentStatus: string) => {
    const safeStatus = currentStatus || 'Active';
    const newStatus = safeStatus === 'Suspended' ? 'Active' : 'Suspended';
    const actionText = newStatus === 'Suspended' ? 'i-suspend' : 'i-activate';
    
    if (!window.confirm(`Sigurado ka bang gusto mong ${actionText} ang manager na ito?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_profiles')
        .update({ status: newStatus })
        .eq('id', managerId);

      if (error) throw error;

      toast.success(`Manager account successfully ${newStatus.toLowerCase()}!`);
      fetchManagers();
    } catch (error: any) {
      console.error(error);
      toast.error(`Error: ${error.message}`);
    }
  };

  return (
    <AdminLayout title="Personnel Management">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: INVITE MANAGER FORM */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-[24px] shadow-sm border border-border overflow-hidden">
            <div className="bg-sidebar p-8 text-white relative overflow-hidden">
              <div className="relative z-10 space-y-2">
                <h2 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Invite Manager
                </h2>
                <div className="flex items-center gap-2">
                  <div className="h-[2px] w-8 bg-primary"></div>
                  <p className="text-primary text-[11px] font-black uppercase tracking-[0.2em]">Send Invitation</p>
                </div>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-10 rotate-[-15deg]">
                <ShieldCheck size={140} />
              </div>
            </div>

            <form onSubmit={handleInviteManager} className="p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground ml-1">Assign to Branch</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <select 
                    className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-background pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                    value={adminLotId} onChange={(e) => setAdminLotId(e.target.value)} required
                  >
                    <option value="">Select location...</option>
                    {lots.map((lot) => (<option key={lot.id} value={lot.id}>{lot.name}</option>))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground ml-1">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input 
                    className="h-12 rounded-xl pl-10 focus:ring-2 focus:ring-primary"
                    type="email" placeholder="manager@parkada.ph" 
                    value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required
                  />
                </div>
              </div>

              <Button 
                type="submit" disabled={isSubmitting} 
                className="w-full h-12 font-bold uppercase tracking-widest rounded-xl transition-all active:scale-95 mt-4"
              >
                {isSubmitting ? "Sending Invite..." : "Send Invitation"}
              </Button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE MANAGERS LIST */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-border p-6 h-full min-h-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2 rounded-lg text-foreground">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Active Personnel</h3>
                  <p className="text-xs text-muted-foreground">List of deployed branch managers</p>
                </div>
              </div>
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                {managers.length} Deployed
              </div>
            </div>

            {managers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground bg-slate-50 rounded-xl border border-dashed border-border">
                <Database size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No managers deployed yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {managers.map((manager, index) => {
                  const isActive = manager.status !== 'Suspended';
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
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                          isActive ? 'bg-sidebar text-white' : 'bg-rose-200 text-rose-700'
                        }`}>
                          M
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground">
                              Manager ID: <span className="text-xs font-normal text-muted-foreground">{manager.id.substring(0, 8)}</span>
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
                            {manager.parking_lots?.name || "Unassigned"}
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleToggleStatus(manager.id, manager.status)}
                        className={`p-2 rounded-lg transition-colors ${
                          isActive 
                            ? 'text-rose-500 hover:bg-rose-100'
                            : 'text-emerald-600 hover:bg-emerald-100'
                        }`}
                        title={isActive ? "Suspend Manager" : "Reactivate Manager"}
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