/*
 * iParkBayan — SlotSelectionPage (Final Fix for Walk-in Visibility)
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { Car, Info, X, AlertCircle } from "lucide-react"; // Gagamit tayo ng X icon
import { cn } from "@/lib/utils";
import { supabase } from "../../supabaseClient";

export default function SlotSelectionPage({ lotId }: { lotId: string }) {
  const [, navigate] = useLocation();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const { data, error } = await supabase
          .from("parking_slots")
          .select("id, label, status, parking_lot_id, is_reservable")
          .eq("parking_lot_id", lotId)
          .order("label", { ascending: true });

        if (error) throw error;
        setSlots(data || []);
      } catch (err) {
        console.error("Error fetching slots:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();

    const channel = supabase
      .channel('slot-updates')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'parking_slots', filter: `parking_lot_id=eq.${lotId}` },
        (payload) => {
          setSlots((prev) => prev.map(s => s.id === payload.new.id ? payload.new : s));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lotId]);

  if (loading) return <div className="p-20 text-center font-bold text-primary animate-pulse">Loading Map...</div>;

  return (
    <MobileLayout title="Select a Slot" showBack onBack={() => window.history.back()}>
      <div className="page-enter p-4 space-y-6 pb-24">
        
        {/* LEGEND */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-4 justify-center text-[10px] font-black uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-2">
            <X size={12} className="text-gray-400" />
            <span>Walk-in Only</span>
          </div>
        </div>

        {/* PARKING LOT GRID */}
        <div className="bg-slate-50 rounded-4xl p-6 border-2 border-slate-200 shadow-inner">
          <div className="w-full text-center mb-8">
            <span className="bg-slate-200 text-slate-500 px-6 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em]">
              Driving Lane
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {slots.map((slot) => {
              const isOccupied = slot.status === "occupied" || slot.status === "reserved";
              
              // Double check para sa is_reservable galing DB
              const isWalkInOnly = slot.is_reservable === false || String(slot.is_reservable) === "false";
              
              const canBeSelected = !isWalkInOnly && !isOccupied;

              return (
                <button
                  key={slot.id}
                  disabled={!canBeSelected}
                  onClick={() => navigate(`/reserve/${slot.id}?lot=${lotId}`)}
                  className={cn(
                    "relative h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-300",
                    
                    // BASE COLOR: Green if available, Red if occupied (para sa detection)
                    isOccupied 
                      ? "bg-red-50 border-red-500 text-red-600" 
                      : "bg-green-50 border-green-500 text-green-700",

                    // UI OVERRIDE: Kung Walk-in Only (C1), gawing faded at dashed
                    isWalkInOnly && "opacity-40 grayscale-[0.5] border-dashed border-gray-400 cursor-not-allowed shadow-none",
                    
                    // Interaction para sa reservable slots
                    canBeSelected && "shadow-sm hover:bg-green-100 active:scale-95 cursor-pointer"
                  )}
                >
                  {/* SLOT LABEL */}
                  <span className={cn(
                    "text-lg font-black leading-tight",
                    isWalkInOnly ? "text-gray-500" : (isOccupied ? "text-red-600" : "text-green-700")
                  )}>
                    {slot.label}
                  </span>

                  {/* INDICATOR ICON */}
                  <div className="mt-1">
                    {isWalkInOnly ? (
                      // Letter X icon para sa Walk-in
                      <X size={16} className="text-gray-400 stroke-[3px]" />
                    ) : isOccupied ? (
                      <Car size={18} className="text-red-500" />
                    ) : (
                      // Dot icon para sa Reservable Available slots
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                    )}
                  </div>

                  {/* MINI LABEL PARA SA WALK-IN */}
                  {isWalkInOnly && (
                    <span className="absolute bottom-1 text-[6px] font-black text-gray-500 uppercase">
                      Walk-in
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* BOTTOM INFO */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <Info size={16} className="text-blue-500 mt-0.5" />
          <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
            Ang mga slots na may <b>X icon</b> ay para sa walk-in drivers lamang at hindi maaaring i-book sa app. Ang kulay ay nag-uupdate base sa actual sensor detection.
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}