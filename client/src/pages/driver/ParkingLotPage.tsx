/*
 * iParkBayan — ParkingLotPage (With Status Protection + Rating Summary)
 */
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import ParkingSlotGrid from "@/components/parking/ParkingSlotGrid";
import { MapPin, Clock, Car, ChevronRight, Info, AlertTriangle, Ban, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";

// Helper: static star rendering (for average rating)
const renderStaticStars = (rating: number) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(fullStars)].map((_, i) => <Star key={i} size={14} className="fill-amber-400 text-amber-400" />)}
      {hasHalf && <Star size={14} className="fill-amber-400 text-amber-400" style={{ clipPath: 'inset(0 50% 0 0)' }} />}
      {[...Array(emptyStars)].map((_, i) => <Star key={i} size={14} className="text-gray-300" />)}
    </div>
  );
};

export default function ParkingLotPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  
  const [lot, setLot] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLotDetails = async () => {
    try {
      if (!params?.id) return;

      const { data: lotData, error: lotError } = await supabase
        .from("parking_lots")
        .select("*")
        .eq("id", params.id)
        .single();

      if (lotError) throw lotError;
      setLot(lotData);

      // Fetch slots
      const { data: slotsData, error: slotsError } = await supabase
        .from("parking_slots")
        .select("*")
        .eq("lot_id", params.id)
        .order("label", { ascending: true });

      if (slotsError) throw slotsError;

      // Override for C1
      const updatedSlots = (slotsData || []).map(slot => {
        if (slot.label === "C1") {
          return { ...slot, is_reservable: false };
        }
        return slot;
      });
      setSlots(updatedSlots);

    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLotDetails();

    const channel = supabase
      .channel(`lot-slots-${params.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parking_slots', filter: `lot_id=eq.${params.id}` },
        () => fetchLotDetails()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params?.id]);

  const handleReserve = () => {
    if (lot?.status === 'suspended') {
      toast.error("This location is currently unavailable.");
      return;
    }
    if (!selectedSlot) {
      toast.error("Please select an available slot first");
      return;
    }
    navigate(`/reserve/${selectedSlot.id}?lot=${lot.id}`);
  };

  if (loading) {
    return (
      <MobileLayout title="Loading..." showBack onBack={() => navigate("/home")}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground animate-pulse font-medium">Fetching lot details...</p>
        </div>
      </MobileLayout>
    );
  }

  if (!lot) return null;

  const isSuspended = lot.status === 'suspended';
  const availableCount = slots.filter(s => s.status === 'available').length;
  const averageRating = lot.average_rating || 0;
  const totalReviews = lot.total_reviews || 0;

  return (
    <MobileLayout title={lot.name} showBack onBack={() => navigate("/home")}>
      <div className="page-enter">
        
        {/* Suspension notice */}
        {isSuspended && (
          <div className="mx-4 mt-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-start gap-3 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-amber-100 p-2 rounded-full text-amber-600">
              <Ban size={20} />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 leading-none">Temporarily Unavailable</h4>
              <p className="text-[11px] text-amber-700 mt-1.5 font-medium leading-relaxed">
                This parking establishment is currently suspended. Reservations are disabled until further notice.
              </p>
            </div>
          </div>
        )}

        {/* Lot Info Card */}
        <div className={cn(
          "mx-4 mt-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 transition-opacity",
          isSuspended && "opacity-60 grayscale-[0.5]"
        )}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={cn(
                  "text-[10px] font-bold uppercase",
                  lot.type === "private" ? "border-blue-200 text-blue-700 bg-blue-50" : "border-gray-200 text-gray-600 bg-gray-50"
                )}>
                  {lot.type}
                </Badge>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full",
                  isSuspended ? "bg-gray-200 text-gray-600" : (availableCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")
                )}>
                  {isSuspended ? "Inactive" : (availableCount > 0 ? `${availableCount} Available` : "Full")}
                </span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin size={12} />
                <span className="text-xs">{lot.address}</span>
              </div>
              {/* Rating summary (stars + count) */}
              {averageRating > 0 && (
                <div className="flex items-center gap-2 mt-2 pt-1">
                  <div className="flex items-center gap-1">
                    {renderStaticStars(averageRating)}
                    <span className="text-xs font-bold ml-1">{averageRating.toFixed(1)}</span>
                  </div>
                  <span className="text-xs text-gray-400">({totalReviews} reviews)</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold text-navy-900">
                {lot.rate_per_hour === 0 ? "Free" : `₱${lot.rate_per_hour}`}
              </p>
              {lot.rate_per_hour > 0 && <p className="text-[10px] text-muted-foreground font-medium">per hour</p>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-gray-50 text-xs text-muted-foreground font-medium">
            <Clock size={12} />
            <span>Open: {lot.open_hours || "24/7"}</span>
          </div>
        </div>

        {/* Slot Grid Section */}
        <div className={cn(
          "mx-4 mt-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 pb-6 transition-all",
          isSuspended && "pointer-events-none opacity-40"
        )}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground">Select a Slot</h3>
            {!isSuspended && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                <Info size={12} />
                <span>Tap green slot to select</span>
              </div>
            )}
          </div>

          <ParkingSlotGrid
            slots={slots}
            selectedSlot={selectedSlot?.id}
            onSelectSlot={setSelectedSlot}
            interactive={!isSuspended && lot.type !== "public"}
          />
        </div>

        {/* Floating Selected Slot Info */}
        {selectedSlot && !isSuspended && (
          <div className="mx-4 mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
              <Car size={18} className="text-navy-900" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-navy-900">
                Slot {selectedSlot.label} Selected
              </p>
              <p className="text-xs text-muted-foreground font-medium">₱{lot.rate_per_hour}/hr · {lot.name}</p>
            </div>
            <button onClick={() => setSelectedSlot(null)} className="text-muted-foreground px-2 text-xl">×</button>
          </div>
        )}

        {/* Bottom Button Area */}
        <div className="mx-4 mt-6 mb-8">
          <Button
            onClick={handleReserve}
            disabled={isSuspended || !selectedSlot || lot.type === "public"}
            className="w-full h-14 text-base font-bold rounded-xl shadow-lg transition-all"
            style={{ 
              background: isSuspended ? "#cbd5e1" : (selectedSlot ? "oklch(0.22 0.07 255)" : "oklch(0.8 0.02 255)"), 
              color: isSuspended ? "#94a3b8" : (selectedSlot ? "white" : "gray"),
            }}
          >
            {isSuspended ? "Location Suspended" : (selectedSlot ? `Reserve Slot ${selectedSlot.label}` : "Select a Slot to Reserve")}
            {!isSuspended && selectedSlot && <ChevronRight size={18} className="ml-1" />}
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
} 