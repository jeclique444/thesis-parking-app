import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { parkingLots, type ParkingSlot, type SlotStatus } from "@/lib/data";
import ParkingSlotGrid from "@/components/parking/ParkingSlotGrid";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/supabaseClient"; // Make sure this path is correct!

export default function AdminParkingSlots() {
  // THESE ARE THE LINES THAT WERE MISSING/CAUSING YOUR ERROR:
  const [liveLots, setLiveLots] = useState(parkingLots);
  const [selectedLot, setSelectedLot] = useState(parkingLots[0].id);
  const [refreshing, setRefreshing] = useState(false);
  const lot = liveLots.find((l) => l.id === selectedLot)!;
  // ---------------------------------------------------------

  useEffect(() => {
    fetchLiveSlotData();
  }, []);

  const fetchLiveSlotData = async () => {
    setRefreshing(true);
    
    try {
      const { data, error } = await supabase
        .from('parking_slots')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        const updatedLots = liveLots.map(currentLot => {
          let availableCount = 0;

          const updatedSlots = currentLot.slots.map(slot => {
            const liveSlot = data.find((dbSlot: any) => dbSlot.label === slot.label);
            const currentStatus = liveSlot ? liveSlot.status : slot.status;
            
            if (currentStatus === 'available') availableCount++;

            return {
              ...slot,
              status: currentStatus as SlotStatus
            };
          });

          return {
            ...currentLot,
            slots: updatedSlots,
            availableSlots: availableCount
          };
        });

        setLiveLots(updatedLots);
        toast.success("Live parking data synced!");
      }
    } catch (error: any) {
      console.error("Supabase Error:", error.message);
      toast.error("Failed to fetch live data. Showing offline data.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await fetchLiveSlotData();
  };

  return (
    <AdminLayout title="Parking Slots">
      <div className="space-y-5">
        {/* Lot Selector */}
        <div className="flex gap-3 flex-wrap">
          {liveLots.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedLot(l.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold border transition-all",
                selectedLot === l.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-foreground border-border hover:border-primary/50"
              )}
            >
              {l.name}
            </button>
          ))}
        </div>

        {/* Lot Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total", value: lot.totalSlots, color: "text-foreground" },
            { label: "Available", value: lot.availableSlots, color: "text-emerald-600" },
            { label: "Occupied", value: lot.totalSlots - lot.availableSlots - 2, color: "text-rose-600" },
            { label: "Reserved", value: 2, color: "text-amber-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 card-elevated text-center">
              <p className={cn("text-3xl font-extrabold", color)} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Slot Grid */}
        <div className="bg-white rounded-2xl p-6 card-elevated">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {lot.name}
              </h3>
              <p className="text-xs text-muted-foreground">{lot.address}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn(
                "text-xs",
                lot.type === "private" ? "border-primary/30 text-primary" : "border-muted-foreground/30"
              )}>
                {lot.type}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded-xl text-xs"
              >
                <RefreshCw size={14} className={cn("mr-1.5", refreshing && "animate-spin")} />
                Refresh Live Data
              </Button>
            </div>
          </div>
          <ParkingSlotGrid
            slots={lot.slots}
            interactive={false}
          />
        </div>

        {/* Slot Table */}
        <div className="bg-white rounded-2xl p-5 card-elevated">
          <h3 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Live Slot Details
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left pb-2 font-semibold">Slot</th>
                  <th className="text-left pb-2 font-semibold">Row</th>
                  <th className="text-left pb-2 font-semibold">Floor</th>
                  <th className="text-left pb-2 font-semibold">Status</th>
                  <th className="text-left pb-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lot.slots.slice(0, 12).map((slot) => (
                  <tr key={slot.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 font-bold">{slot.label}</td>
                    <td className="py-2.5 text-muted-foreground">{slot.row}</td>
                    <td className="py-2.5 text-muted-foreground">{slot.floor}</td>
                    <td className="py-2.5">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize",
                        slot.status === "available" ? "bg-emerald-100 text-emerald-700" :
                        slot.status === "occupied" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {slot.status}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <button
                        onClick={() => toast.info(`Slot ${slot.label} details coming soon`)}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}