/*
 * iParkBayan — VehiclesPage (Supabase Connected & Real-time Alerts)
 * Updated: Added car brand dropdown (same as registration) and LTO plate validation.
 * Removed back arrow button.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { Car, Plus, Trash2, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "../../supabaseClient";
import { toast } from "sonner";

// Allowed 4-Wheel Car Brands (same as RegisterPage)
const ALLOWED_CAR_BRANDS = [
  "Audi", "BMW", "BYD", "Changan", "Chery", "Chevrolet", "Dodge", "Dongfeng", "Ford", "Foton", "GAC Motor", "Geely", "GWM", 
  "Honda", "Hyundai", "Isuzu", "Jaecoo", "Jaguar", "Jeep", "Jetour", "Kia", "Land Rover", "Lexus", "Mahindra", "Mazda", "Mercedes-Benz", 
  "MG", "Mini", "Mitsubishi", "Nissan", "Omoda", "Peugeot", "Porsche", "Subaru", "Suzuki", "Tata", "Toyota", "Volkswagen", "Volvo", "Wuling"
];

export default function VehiclesPage() {
  const [, navigate] = useLocation();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ plate: "", brand: "", model: "", color: "" });

  const MAX_VEHICLES = 3; 
  const isMaxReached = vehicles.length >= MAX_VEHICLES;

  useEffect(() => {
    fetchVehicles();
  }, []);

  // Fetch only active vehicles
  const fetchVehicles = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setLoading(false);
        return; 
      }

      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true) 
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  };

  // LTO Plate Number Validation (strict)
  const validateLTOPlate = (plate: string): boolean => {
    const plateRegex = /^[A-Z]{3}[\s-]?[0-9]{3,4}$/i;
    return plateRegex.test(plate.trim());
  };

  // Add Vehicle
  const addVehicle = async () => {
    if (!form.plate || !form.brand || !form.model || !form.color) {
      toast.error("Please fill all fields");
      return;
    }

    if (!validateLTOPlate(form.plate)) {
      toast.error("Invalid Plate Number. Must be LTO standard (e.g., ABC 123 or ABC 1234).");
      return;
    }

    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAdding(false);
        return;
      }

      // Sanitize plate: remove spaces/dashes, keep only A-Z0-9
      const sanitizedPlate = form.plate.toUpperCase().replace(/[^A-Z0-9]/g, "");

      // Check duplicate plate (even inactive is considered duplicate)
      const { data: existingVehicle, error: checkError } = await supabase
        .from("vehicles")
        .select("id")
        .eq("plate", sanitizedPlate)
        .maybeSingle(); 

      if (checkError) throw checkError;
      if (existingVehicle) {
        toast.error(`Plate number ${sanitizedPlate} is already registered!`);
        setAdding(false);
        return; 
      }

      // Count active vehicles for limit check
      const { count, error: countError } = await supabase
        .from("vehicles")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (countError) throw countError;
      if ((count || 0) >= MAX_VEHICLES) {
        toast.error(`You can only register up to ${MAX_VEHICLES} vehicles. Please delete an existing one first.`);
        setOpen(false); 
        setForm({ plate: "", brand: "", model: "", color: "" }); 
        setAdding(false); 
        return; 
      }

      // Combine brand and model as full model name (e.g., "Toyota Vios")
      const fullModel = `${form.brand} ${form.model.trim()}`;

      // Insert new vehicle
      const { error: insertError } = await supabase
        .from("vehicles")
        .insert([{
          user_id: user.id,
          plate: sanitizedPlate,
          model: fullModel,
          color: form.color.trim(),
          is_active: true
        }]);

      if (insertError?.code === '23505') { 
        toast.error(`Plate number ${sanitizedPlate} is already in the system!`);
        setAdding(false);
        return;
      } else if (insertError) {
        throw insertError;
      }

      // Create notification
      await supabase.from("notifications").insert([{
        user_id: user.id,
        title: "Vehicle Registered 🚗",
        message: `Your ${fullModel} (${sanitizedPlate}) has been added to your garage.`,
        type: "system",
        read: false
      }]);

      toast.success("Vehicle added!");
      setForm({ plate: "", brand: "", model: "", color: "" });
      setOpen(false);
      fetchVehicles(); 
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setAdding(false);
    }
  };

  // Soft delete vehicle
  const removeVehicle = async (id: string, plate: string) => {
    const confirm = window.confirm(`Are you sure you want to remove ${plate}?`);
    if (!confirm) return;

    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;

      setVehicles((v) => v.filter((x) => x.id !== id));
      toast.success("Vehicle removed");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <MobileLayout title="My Vehicles">
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
                onClick={() => removeVehicle(v.id, v.plate)} 
                className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}

        {/* Add Button Section */}
        <Dialog open={open} onOpenChange={(isOpen) => {
          if (isOpen && isMaxReached) return;
          setOpen(isOpen);
        }}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              disabled={isMaxReached}
              className={`w-full h-14 rounded-2xl border-2 border-dashed font-bold transition-all ${
                isMaxReached 
                  ? "border-slate-100 bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed" 
                  : "border-slate-200 text-slate-500 hover:bg-slate-50" 
              }`}
            >
              <Plus size={18} className="mr-2" />
              {isMaxReached ? "Max Limit Reached (3/3)" : "Register New Vehicle"}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] w-[92%] max-w-md mx-auto p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Add Vehicle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* Plate Number */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Plate Number</Label>
                <Input 
                  value={form.plate} 
                  onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))} 
                  placeholder="ABC 1234" 
                  className="h-12 rounded-xl font-mono font-black uppercase bg-slate-50 border-none" 
                />
                <p className="text-[9px] text-slate-400 ml-1">LTO format: 3 letters + 3-4 numbers (e.g., ABC 123)</p>
              </div>

              {/* Car Brand Dropdown */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Car Brand</Label>
                <select
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  className="w-full h-12 rounded-xl bg-slate-50 border-none px-4 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select brand</option>
                  {ALLOWED_CAR_BRANDS.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Model</Label>
                <Input 
                  value={form.model} 
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} 
                  placeholder="e.g., Vios" 
                  className="h-12 rounded-xl font-bold bg-slate-50 border-none" 
                  disabled={!form.brand}
                />
              </div>

              {/* Color */}
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
                disabled={adding || !form.brand || !form.model || !form.color || !validateLTOPlate(form.plate)}
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