/*
 * iParkBayan — VehiclesPage (Supabase Connected & Real-time Alerts)
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { Car, Plus, Star, Trash2, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "../../supabaseClient";
import { toast } from "sonner";

export default function VehiclesPage() {
  const [, navigate] = useLocation();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ plate: "", model: "", color: "" });

  useEffect(() => {
    fetchVehicles();
  }, []);

  // 1. Fetch from Database
 // 1. Fetch from Database
  const fetchVehicles = async () => {
    try {
      // Kunin ang current logged-in user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error("Hindi naka-login o may error sa auth:", authError);
        setLoading(false);
        return; // Stop execution kung walang user
      }

      console.log("Naka-login si:", user.id); // Idinagdag para ma-check mo sa console

      // Kunin ang mga sasakyan ng user na ito
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error pagkuha ng sasakyan:", error);
        throw error;
      }

      console.log("Nakuha na data mula sa DB:", data); // Idinagdag para makita ang laman
      setVehicles(data || []);
      
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  };

  // 2. Add Vehicle to DB + Notification
  const addVehicle = async () => {
    if (!form.plate || !form.model || !form.color) {
      toast.error("Please fill all fields");
      return;
    }

    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("vehicles")
        .insert([{
          user_id: user.id,
          plate: form.plate.toUpperCase(), // 🔥 Binago ito mula plate_number papuntang plate
          model: form.model,
          color: form.color
        }]);

      if (error) throw error;

      // 🔥 TRIGGER NOTIFICATION
      await supabase.from("notifications").insert([{
        user_id: user.id,
        title: "Vehicle Registered 🚗",
        message: `Your ${form.model} (${form.plate.toUpperCase()}) has been added to your garage.`,
        type: "system",
        read: false
      }]);

      toast.success("Vehicle added!");
      setForm({ plate: "", model: "", color: "" });
      setOpen(false);
      fetchVehicles(); // Refresh list
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  // 3. Remove Vehicle from DB
  const removeVehicle = async (id: string, plate: string) => {
    const confirm = window.confirm(`Are you sure you want to remove ${plate}?`);
    if (!confirm) return;

    try {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;

      setVehicles((v) => v.filter((x) => x.id !== id));
      toast.success("Vehicle removed");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <MobileLayout title="My Vehicles" showBack onBack={() => navigate("/profile")}>
      <div className="page-enter px-4 py-4 space-y-4 pb-24">
        
        {/* Vehicles List */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300" /></div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <Car size={48} className="mx-auto text-slate-200 mb-2" />
            <p className="text-sm font-bold text-slate-400">No vehicles yet.</p>
          </div>
        ) : (
          vehicles.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                <Car size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                 <p className="text-sm font-black font-mono text-slate-800 uppercase tracking-tighter">{v.plate}</p>
                </div>
                <p className="text-[11px] font-bold text-slate-400 uppercase">{v.model} • {v.color}</p>
              </div>
              <button 
                onClick={() => removeVehicle(v.id, v.plate)} // 🔥 Binago ito mula v.plate_number
                className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"
                  >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}

        {/* Add Button Section */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-all">
              <Plus size={18} className="mr-2" />
              Register New Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] w-[92%] max-w-md mx-auto p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Add Vehicle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Plate Number</Label>
                <Input 
                  value={form.plate} 
                  onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))} 
                  placeholder="ABC 1234" 
                  className="h-12 rounded-xl font-mono font-black uppercase bg-slate-50 border-none" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vehicle Model</Label>
                <Input 
                  value={form.model} 
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} 
                  placeholder="Toyota Vios" 
                  className="h-12 rounded-xl font-bold bg-slate-50 border-none" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Color</Label>
                <Input 
                  value={form.color} 
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} 
                  placeholder="White" 
                  className="h-12 rounded-xl font-bold bg-slate-50 border-none" 
                />
              </div>
              <Button 
                onClick={addVehicle} 
                disabled={adding}
                className="w-full h-14 rounded-2xl font-black text-white shadow-xl mt-2" 
                style={{ background: "oklch(0.22 0.07 255)" }}
              >
                {adding ? <Loader2 className="animate-spin" /> : "REGISTER VEHICLE"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Small Tip */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl opacity-80">
          <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase">
            Registered vehicles will appear as options during your slot reservation process.
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}