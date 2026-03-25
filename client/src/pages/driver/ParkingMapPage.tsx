/*
 * iParkBayan — ParkingMapPage
 * Design: Civic Tech / Filipino Urban Identity
 * Map view with parking lot markers and list
 */
import { useState } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { parkingLots } from "@/lib/data";
import { MapPin, List, Map, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const MAP_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/iparkbayan-lipa-map-bf9Bjp7jKhLR43sJchAZUD.webp";

export default function ParkingMapPage() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"map" | "list">("map");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "private" | "public">("all");

  const filtered = parkingLots.filter((lot) => {
    const matchSearch = lot.name.toLowerCase().includes(search.toLowerCase()) ||
      lot.address.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || lot.type === filter;
    return matchSearch && matchFilter;
  });

  return (
    <MobileLayout title="Find Parking" showBack onBack={() => navigate("/home")} noPadding>
      <div className="flex flex-col h-[calc(100dvh-56px)]">
        {/* Search Bar */}
        <div className="px-4 py-3 bg-white border-b border-border space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parking in Lipa City..."
              className="pl-9 h-10 rounded-xl bg-muted/40 text-sm"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "private", "public"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold transition-all capitalize",
                  filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {f}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 bg-muted rounded-full p-0.5">
              <button onClick={() => setView("map")} className={cn("p-1.5 rounded-full transition-all", view === "map" ? "bg-white shadow-sm" : "")}>
                <Map size={14} className={view === "map" ? "text-primary" : "text-muted-foreground"} />
              </button>
              <button onClick={() => setView("list")} className={cn("p-1.5 rounded-full transition-all", view === "list" ? "bg-white shadow-sm" : "")}>
                <List size={14} className={view === "list" ? "text-primary" : "text-muted-foreground"} />
              </button>
            </div>
          </div>
        </div>

        {view === "map" ? (
          <div className="flex-1 relative overflow-hidden">
            {/* Map Background */}
            <img src={MAP_IMG} alt="Lipa City Map" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-[oklch(0.18_0.06_255/0.15)]" />

            {/* Parking Markers */}
            {parkingLots.map((lot, i) => {
              const positions = [
                { top: "30%", left: "25%" },
                { top: "55%", left: "42%" },
                { top: "20%", left: "65%" },
                { top: "65%", left: "70%" },
              ];
              const pos = positions[i] || { top: "50%", left: "50%" };
              return (
                <button
                  key={lot.id}
                  onClick={() => navigate(`/parking/${lot.id}`)}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2"
                  style={pos}
                >
                  <div className={cn(
                    "flex flex-col items-center gap-0.5",
                  )}>
                    <div className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-bold shadow-lg whitespace-nowrap",
                      lot.availableSlots > 5 ? "bg-emerald-500 text-white" :
                      lot.availableSlots > 0 ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                    )}>
                      {lot.availableSlots > 0 ? `${lot.availableSlots} free` : "Full"}
                    </div>
                    <MapPin size={20} className={cn(
                      "drop-shadow-lg",
                      lot.availableSlots > 5 ? "text-emerald-500" :
                      lot.availableSlots > 0 ? "text-amber-500" : "text-rose-500"
                    )} fill="currentColor" />
                  </div>
                </button>
              );
            })}

            {/* Bottom Sheet Preview */}
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 shadow-2xl">
              <div className="w-8 h-1 bg-muted rounded-full mx-auto mb-3" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                {filtered.length} Parking Lots Nearby
              </p>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                {filtered.map((lot) => (
                  <div
                    key={lot.id}
                    onClick={() => navigate(`/parking/${lot.id}`)}
                    className="shrink-0 w-44 bg-muted/40 rounded-xl p-3 cursor-pointer"
                  >
                    <p className="text-xs font-bold text-foreground truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{lot.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{lot.distance} · {lot.ratePerHour === 0 ? "Free" : `₱${lot.ratePerHour}/hr`}</p>
                    <div className={cn(
                      "mt-1.5 text-[10px] font-bold",
                      lot.availableSlots > 5 ? "text-emerald-600" : lot.availableSlots > 0 ? "text-amber-600" : "text-rose-600"
                    )}>
                      {lot.availableSlots > 0 ? `${lot.availableSlots} available` : "Full"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-20">
            {filtered.map((lot) => (
              <div
                key={lot.id}
                onClick={() => navigate(`/parking/${lot.id}`)}
                className="bg-white rounded-2xl p-4 card-elevated cursor-pointer flex items-center gap-3"
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  lot.availableSlots > 5 ? "bg-emerald-100" : lot.availableSlots > 0 ? "bg-amber-100" : "bg-rose-100"
                )}>
                  <MapPin size={22} className={
                    lot.availableSlots > 5 ? "text-emerald-600" : lot.availableSlots > 0 ? "text-amber-600" : "text-rose-600"
                  } />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-foreground truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{lot.name}</p>
                    <Badge variant="outline" className="text-[9px] shrink-0">{lot.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{lot.address}</p>
                  <p className={cn("text-xs font-semibold mt-0.5",
                    lot.availableSlots > 5 ? "text-emerald-600" : lot.availableSlots > 0 ? "text-amber-600" : "text-rose-600"
                  )}>
                    {lot.availableSlots > 0 ? `${lot.availableSlots}/${lot.totalSlots} available` : "Full"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold">{lot.ratePerHour === 0 ? "Free" : `₱${lot.ratePerHour}/hr`}</p>
                  <p className="text-[10px] text-muted-foreground">{lot.distance}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
