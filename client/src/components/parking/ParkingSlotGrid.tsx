/*
 * iParkBayan — ParkingSlotGrid
 * Changes:
 *   1. Legend is now a vertical list (no sideways scroll)
 *   2. "Unmapped" is hidden from the legend and the grid for drivers/users
 *   3. Optional `isAdmin` prop — pass true to show unmapped slots (admin view)
 */

import { cn } from "@/lib/utils";
import type { ParkingSlot } from "@/lib/data";
import { Car, X, Accessibility } from "lucide-react";
import { toast } from "sonner";

interface ParkingSlotGridProps {
  slots: ParkingSlot[];
  selectedSlot?: string;
  onSelectSlot?: (slot: ParkingSlot) => void;
  interactive?: boolean;
  isAdmin?: boolean; // set true in admin views to show unmapped slots
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
  unmapped: {
    bg: "bg-slate-100 border-slate-400 border-dashed cursor-not-allowed opacity-80",
    text: "text-slate-500",
    label: "Unmapped",
    dot: "bg-slate-400",
  },
};

export default function ParkingSlotGrid({
  slots,
  selectedSlot,
  onSelectSlot,
  interactive = true,
  isAdmin = false,
}: ParkingSlotGridProps) {

  // Hide unmapped slots from drivers/users; admins see everything
  const visibleSlots = isAdmin
    ? slots
    : slots.filter((s) => {
        const status =
          s.status === "NULL / NOT DRAWN" || !s.status ? "unmapped" : s.status;
        return status !== "unmapped";
      });

  const totalSlots    = visibleSlots.length;
  const availableSlots = visibleSlots.filter((s) => s.status === "available").length;
  const occupiedSlots  = visibleSlots.filter((s) => s.status === "occupied").length;
  const reservedSlots  = visibleSlots.filter((s) => s.status === "reserved").length;
  const pwdSlots       = visibleSlots.filter(
    (s) => (s as any).is_pwd === true || String((s as any).is_pwd) === "true"
  ).length;

  const rows = visibleSlots.reduce<Record<string, ParkingSlot[]>>((acc, slot) => {
    const row = slot.row || (slot.label ? slot.label.charAt(0).toUpperCase() : "A");
    if (!acc[row]) acc[row] = [];
    acc[row].push(slot);
    return acc;
  }, {});

  return (
    <div className="space-y-4 w-full">

      {/* LEGEND — 2-column grid with grey title */}
<div className="w-full">
  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
    Legend
  </p>
  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-semibold text-slate-800">

    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-emerald-500" />
      <span>Available</span>
    </div>

    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-rose-500" />
      <span>Occupied</span>
    </div>

    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-amber-500" />
      <span>Reserved</span>
    </div>

    <div className="flex items-center gap-2 text-blue-600">
      <Accessibility size={14} className="shrink-0" />
      <span>PWD</span>
    </div>

    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-sm bg-primary/20 border border-primary shrink-0" />
      <span>Selected</span>
    </div>

    {isAdmin && (
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-slate-400 border border-dashed border-slate-400" />
        <span className="text-slate-500">Unmapped</span>
      </div>
    )}

  </div>
</div>

{/* STATS SUMMARY */}
      <div className="bg-white border rounded-xl py-2 mb-2 shadow-sm">
        <div className="flex flex-nowrap items-stretch text-center">
          <div className="flex-1 flex flex-col items-center">
            <span className="text-sm sm:text-base font-black text-slate-900">{totalSlots}</span>
            <span className="text-[8px] sm:text-[10px] uppercase text-slate-600 font-bold tracking-wider">Total</span>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <span className="text-sm sm:text-base font-black text-emerald-600">{availableSlots}</span>
            <span className="text-[8px] sm:text-[10px] uppercase text-slate-600 font-bold tracking-wider">Available</span>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <span className="text-sm sm:text-base font-black text-rose-600">{occupiedSlots}</span>
            <span className="text-[8px] sm:text-[10px] uppercase text-slate-600 font-bold tracking-wider">Occupied</span>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <span className="text-sm sm:text-base font-black text-amber-500">{reservedSlots}</span>
            <span className="text-[8px] sm:text-[10px] uppercase text-slate-600 font-bold tracking-wider">Reserved</span>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <span className="text-sm sm:text-base font-black text-blue-600">{pwdSlots}</span>
            <span className="text-[8px] sm:text-[10px] uppercase text-slate-600 font-bold tracking-wider">PWD</span>
          </div>
        </div>
      </div>

      {/* SLOT GRID */}
      <div className="w-full overflow-x-auto pb-4">
        <div className="min-w-max">
          <div className="flex items-center justify-center h-6 bg-slate-100 rounded mt-4 mb-6 relative">
            <div className="flex gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="w-4 h-0.5 bg-slate-400" />
              ))}
            </div>
            <span className="absolute text-[10px] text-slate-500 font-bold tracking-widest uppercase bg-slate-100 px-2">
              Driving Lane
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {Object.entries(rows).map(([row, rowSlots]) => (
              <div key={row} className="flex items-center">
                <span className="text-sm font-black text-slate-950 w-8 shrink-0 sticky left-0 bg-slate-50/80 backdrop-blur-sm py-2 z-10">
                  {row}
                </span>
                <div className="flex gap-2">
                  {rowSlots.map((slot) => {
                    const isWalkIn =
                      slot.label === "C1" ||
                      (slot as any).is_reservable === false ||
                      String((slot as any).is_reservable) === "false";
                    const isPwd =
                      (slot as any).is_pwd === true ||
                      String((slot as any).is_pwd) === "true";
                    const normalizedStatus =
                      slot.status === "NULL / NOT DRAWN" || !slot.status
                        ? "unmapped"
                        : slot.status;
                    const config =
                      statusConfig[normalizedStatus as keyof typeof statusConfig] ||
                      statusConfig.unmapped;
                    const isSelected = selectedSlot === slot.id;
                    const canSelect = interactive && slot.status === "available";

                    return (
                      <button
                        key={slot.id}
                        onClick={() => {
                          if (isWalkIn) toast.info(`Slot ${slot.label} is for walk‑in only.`);
                          if (canSelect) onSelectSlot?.(slot);
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
                          {(slot as any).physical_status === "occupied" ? (
                            <Car size={14} className="opacity-80" />
                          ) : isPwd ? (
                            <Accessibility
                              size={14}
                              className={cn(isSelected ? "text-primary" : "text-blue-600")}
                            />
                          ) : isWalkIn ? (
                            <X size={14} className="text-current stroke-[4px]" />
                          ) : (
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full",
                                isSelected ? "bg-primary" : config.dot
                              )}
                            />
                          )}
                        </div>
                        <span className="text-[11px] leading-none font-black mt-0.5">
                          {slot.label}
                        </span>
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