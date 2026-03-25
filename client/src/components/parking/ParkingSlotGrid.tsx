/*
 * iParkBayan — ParkingSlotGrid
 * Visual floor-plan grid of parking slots with color-coded status
 */
import { cn } from "@/lib/utils";
import type { ParkingSlot } from "@/lib/data";
import { Car } from "lucide-react";

interface ParkingSlotGridProps {
  slots: ParkingSlot[];
  selectedSlot?: string;
  onSelectSlot?: (slot: ParkingSlot) => void;
  interactive?: boolean;
}

const statusConfig = {
  available: {
    bg: "bg-emerald-50 border-emerald-400 hover:bg-emerald-100",
    text: "text-emerald-700",
    label: "Available",
    dot: "bg-emerald-500",
  },
  occupied: {
    bg: "bg-rose-50 border-rose-400 cursor-not-allowed",
    text: "text-rose-600",
    label: "Occupied",
    dot: "bg-rose-500",
  },
  reserved: {
    bg: "bg-amber-50 border-amber-400 cursor-not-allowed",
    text: "text-amber-700",
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
  // Group by row
  const rows = slots.reduce<Record<string, ParkingSlot[]>>((acc, slot) => {
    const row = slot.row ?? "A";
    if (!acc[row]) acc[row] = [];
    acc[row].push(slot);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {Object.entries(statusConfig).map(([status, config]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn("w-2.5 h-2.5 rounded-sm", config.dot)} />
            <span>{config.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-primary/20 border border-primary" />
          <span>Selected</span>
        </div>
      </div>

      {/* Driving lane indicator */}
      <div className="relative">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-6 bg-slate-100 rounded flex items-center justify-center">
          <div className="flex gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-4 h-0.5 bg-slate-300" />
            ))}
          </div>
          <span className="absolute text-[9px] text-slate-400 font-medium tracking-widest uppercase">Driving Lane</span>
        </div>
      </div>

      {/* Slot rows */}
      <div className="space-y-2 pt-4">
        {Object.entries(rows).map(([row, rowSlots]) => (
          <div key={row} className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{row}</span>
            <div className="flex gap-1.5 flex-wrap">
              {rowSlots.map((slot) => {
                const config = statusConfig[slot.status];
                const isSelected = selectedSlot === slot.id;
                const canSelect = interactive && slot.status === "available";

                return (
                  <button
                    key={slot.id}
                    onClick={() => canSelect && onSelectSlot?.(slot)}
                    disabled={!canSelect}
                    className={cn(
                      "w-12 h-14 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 transition-all text-xs font-bold",
                      isSelected
                        ? "bg-primary/15 border-primary text-primary scale-105 shadow-md"
                        : config.bg,
                      !isSelected && config.text,
                      canSelect && "hover:scale-105 hover:shadow-sm active:scale-95"
                    )}
                  >
                    {slot.status === "occupied" ? (
                      <Car size={14} className="opacity-60" />
                    ) : (
                      <div className={cn("w-2 h-2 rounded-full", isSelected ? "bg-primary" : config.dot)} />
                    )}
                    <span className="text-[10px] leading-none">{slot.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
