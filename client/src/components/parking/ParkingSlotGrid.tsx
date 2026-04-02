/*
 * iParkBayan — ParkingSlotGrid (Final Clean Up: Mobile Responsive + PWD Icon + Stats)
 */
import { cn } from "@/lib/utils";
import type { ParkingSlot } from "@/lib/data";
import { Car, X, Accessibility } from "lucide-react"; // 🔥 Idinagdag ang Accessibility icon para sa PWD
import { toast } from "sonner";

interface ParkingSlotGridProps {
  slots: ParkingSlot[];
  selectedSlot?: string;
  onSelectSlot?: (slot: ParkingSlot) => void;
  interactive?: boolean;
}

const statusConfig = {
  available: {
    bg: "bg-emerald-50 border-emerald-500 hover:bg-emerald-100", 
    text: "text-emerald-800", 
    label: "Available",
    dot: "bg-emerald-500",
  },
  occupied: {
    bg: "bg-rose-50 border-rose-500 cursor-not-allowed",
    text: "text-rose-700", 
    label: "Occupied",
    dot: "bg-rose-500",
  },
  reserved: {
    bg: "bg-amber-50 border-amber-500 cursor-not-allowed",
    text: "text-amber-800", 
    label: "Reserved",
    dot: "bg-amber-500",
  },
};

export default function ParkingSlotGrid({
  slots,
  selectedSlot,
  onSelectSlot,
  interactive = true,
}: ParkingSlotGridProps) {
  
  // Bilangin ang total at bawat status para sa Stats Summary
  const totalSlots = slots.length;
  const availableSlots = slots.filter((s) => s.status === "available").length;
  const occupiedSlots = slots.filter((s) => s.status === "occupied").length;
  const reservedSlots = slots.filter((s) => s.status === "reserved").length;

  // Kung walang slot.row sa database, kukunin niya ang unang letter ng slot.label
  const rows = slots.reduce<Record<string, ParkingSlot[]>>((acc, slot) => {
    const row = slot.row || (slot.label ? slot.label.charAt(0).toUpperCase() : "A");
    if (!acc[row]) acc[row] = [];
    acc[row].push(slot);
    return acc;
  }, {});

  return (
    <div className="space-y-4 w-full">
      
      {/* 🔥 STATS SUMMARY */}
      <div className="flex items-center justify-between bg-white border rounded-xl py-4 mb-2 shadow-sm">
        <div className="flex flex-col items-center flex-1 border-r">
          <span className="text-xl font-black text-slate-900">{totalSlots}</span>
          <span className="text-[10px] uppercase text-slate-600 font-bold tracking-wider mt-1">Total</span>
        </div>
        <div className="flex flex-col items-center flex-1 border-r">
          <span className="text-xl font-black text-emerald-600">{availableSlots}</span>
          <span className="text-[10px] uppercase text-slate-600 font-bold tracking-wider mt-1">Available</span>
        </div>
        <div className="flex flex-col items-center flex-1 border-r">
          <span className="text-xl font-black text-rose-600">{occupiedSlots}</span>
          <span className="text-[10px] uppercase text-slate-600 font-bold tracking-wider mt-1">Occupied</span>
        </div>
        <div className="flex flex-col items-center flex-1">
          <span className="text-xl font-black text-amber-500">{reservedSlots}</span>
          <span className="text-[10px] uppercase text-slate-600 font-bold tracking-wider mt-1">Reserved</span>
        </div>
      </div>

      {/* 🔥 Legend: Pinagkasya sa isang linya at inayos ang order (PWD muna bago Selected) */}
      <div className="flex items-center justify-center md:justify-start gap-2.5 sm:gap-4 text-[11px] sm:text-xs font-semibold text-slate-800 whitespace-nowrap overflow-x-auto pb-1">
        {Object.entries(statusConfig).map(([status, config]) => (
          <div key={status} className="flex items-center gap-1 sm:gap-1.5">
            <span className={cn("w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm shrink-0", config.dot)} />
            <span>{config.label}</span>
          </div>
        ))}
        {/* PWD Legend */}
        <div className="flex items-center gap-1 sm:gap-1.5 text-amber-600">
          <Accessibility size={14} className="shrink-0" />
          <span>PWD</span>
        </div>
        {/* Selected Legend */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm bg-primary/20 border border-primary shrink-0" />
          <span>Selected</span>
        </div>
      </div>

      {/* 🔥 SCROLLABLE CONTAINER PARA SA MOBILE LANDSCAPE VIEW */}
      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-max">
          
          {/* 🔥 Driving lane indicator: Inayos para hindi mag-overlap (Inalis yung pure absolute na nagpapa-collapse ng height) */}
          <div className="flex items-center justify-center h-6 bg-slate-100 rounded mt-4 mb-6 relative">
            <div className="flex gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="w-4 h-0.5 bg-slate-400" />
              ))}
            </div>
            <span className="absolute text-[10px] text-slate-500 font-bold tracking-widest uppercase bg-slate-100 px-2">Driving Lane</span>
          </div>

          {/* Slot rows */}
          <div className="space-y-4 pt-2">
            {Object.entries(rows).map(([row, rowSlots]) => (
              <div key={row} className="flex items-center">
                {/* Letter sa gilid (Naka-sticky para di mawala pag nag-scroll) */}
                <span className="text-sm font-black text-slate-950 w-8 shrink-0 sticky left-0 bg-slate-50/80 backdrop-blur-sm py-2 z-10">{row}</span>
                
                <div className="flex gap-2">
                  {rowSlots.map((slot) => {
                    const isOccupied = slot.status === "occupied" || slot.status === "reserved";
                    const isWalkIn = slot.label === "C1" || (slot as any).is_reservable === false || String((slot as any).is_reservable) === "false";
                    const isPwd = (slot as any).is_pwd === true || String((slot as any).is_pwd) === "true"; // Kunin kung PWD
                    
                    const config = statusConfig[slot.status as keyof typeof statusConfig] || statusConfig.available;
                    const isSelected = selectedSlot === slot.id;
                    const canSelect = interactive && slot.status === "available";

                    return (
                      <button
                        key={slot.id}
                        onClick={() => {
                          if (isWalkIn) {
                            toast.info(`Note: Slot ${slot.label} is for Walk-in only.`);
                          }
                          canSelect && onSelectSlot?.(slot);
                        }}
                        disabled={!canSelect}
                        className={cn(
                          "w-12 h-14 rounded-lg border-2 flex flex-col items-center justify-center transition-all text-xs font-bold shrink-0",
                          isSelected
                            ? "bg-primary/20 border-primary text-primary scale-105 shadow-md"
                            : config.bg,
                          !isSelected && config.text,
                          canSelect && "hover:scale-105 hover:shadow-sm active:scale-95 cursor-pointer"
                        )}
                      >
                        <div className="h-4 flex items-center justify-center mb-0.5">
                          {/* 🔥 LOGIC PARA SA ICONS: Inuna natin i-check kung PWD o Occupied */}
                          {slot.status === "occupied" ? (
                            <Car size={14} className="opacity-80" /> 
                          ) : isPwd ? (
                            <Accessibility size={14} className={cn(isSelected ? "text-primary" : "text-amber-600")} /> // PWD Icon
                          ) : isWalkIn ? (
                            <X size={14} className="text-current stroke-[4px]" />
                          ) : (
                            <div className={cn("w-2 h-2 rounded-full", isSelected ? "bg-primary" : config.dot)} />
                          )}
                        </div>
                        <span className="text-[11px] leading-none font-black mt-0.5">{slot.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          
        </div>
      </div>
    </div>
  );
} 