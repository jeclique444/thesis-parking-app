/*
 * iParkBayan — AdminSettings
 * Design: Civic Tech / Filipino Urban Identity
 */
import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PlusCircle, Database } from "lucide-react";
import { supabase } from "@/supabaseClient"; // Siguraduhin na tama ang path

export default function AdminSettings() {
  const [slotName, setSlotName] = useState("");
  const [lotName, setLotName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // DITO NILAGAY ANG HANDLE SAVE MO
  const handleAddSlot = async () => {
    if (!slotName || !lotName) {
      toast.error("Please fill in both Slot Name and Location");
      return;
    }

    setIsSubmitting(true);
    
    const { data, error } = await supabase
      .from('parking_slots') 
      .insert([{ 
        slot_name: slotName, 
        lot_name: lotName, 
        status: 'available' 
      }]);

    setIsSubmitting(false);

    if (error) {
      console.error("Error saving data:", error.message);
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success(`Slot ${slotName} added to Supabase!`);
      setSlotName(""); // Clear field after success
      setLotName("");  // Clear field after success
    }
  };

  return (
    <AdminLayout title="System Settings">
      <div className="max-w-2xl space-y-6">
        
        {/* Quick Add Slot Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-6">
            <PlusCircle className="text-primary" size={20} />
            <h3 className="font-bold text-lg">Add New Parking Slot</h3>
          </div>
          
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="slot">Slot Name (e.g. A1, B5)</Label>
              <Input 
                id="slot" 
                placeholder="Ex: A1"
                value={slotName}
                onChange={(e) => setSlotName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lot">Location (e.g. Lipa Plaza)</Label>
              <Input 
                id="lot" 
                placeholder="Ex: SM Lipa Area"
                value={lotName}
                onChange={(e) => setLotName(e.target.value)}
              />
            </div>

            <Button 
              onClick={handleAddSlot} 
              disabled={isSubmitting}
              className="mt-2 w-full font-bold bg-primary text-white py-6 rounded-xl"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 text-blue-700 p-4 rounded-xl flex items-start gap-3">
          <Database size={18} className="mt-0.5" />
          <p className="text-xs leading-relaxed">
            <strong>Note:</strong> Kapag ni-click mo ang save, direktang papasok ang data sa 
            <code> parking_slots</code> table mo sa Supabase. Siguraduhin na naka-disable ang RLS 
            o may policy na para sa INSERT.
          </p>
        </div>

      </div>
    </AdminLayout>
  );
}