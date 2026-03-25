/*
 * iParkBayan — MyReservationsPage (Connected to Supabase)
 * Design: Civic Tech / Filipino Urban Identity
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Car, ChevronRight, Calendar } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { cn } from "@/lib/utils";

export default function MyReservationsPage() {
  const [, navigate] = useLocation();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyReservations = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch reservations with joined lot details
        const { data, error } = await supabase
          .from("reservations")
          .select(`
            *,
            parking_lots (name, address),
            parking_slots (label)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setReservations(data || []);
      } catch (error) {
        console.error("Error fetching reservations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyReservations();
  }, []);

  if (loading) {
    return (
      <MobileLayout title="My Bookings">
        <div className="p-8 text-center space-y-4">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground animate-pulse text-xs">Loading your history...</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="My Bookings">
      <div className="page-enter p-4 space-y-4">
        <h2 className="text-lg font-black text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Active & Past Bookings
        </h2>

        {reservations.length === 0 ? (
          <div className="bg-muted/30 rounded-3xl p-12 text-center border border-dashed border-gray-200">
            <Calendar className="mx-auto text-muted-foreground/30 mb-3" size={40} />
            <p className="text-sm text-muted-foreground font-medium">No reservations found.</p>
            <button 
              onClick={() => navigate("/home")}
              className="text-xs text-primary font-bold mt-2 underline"
            >
              Book your first slot now
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((res) => (
              <div 
                key={res.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <Badge className={cn(
                      "text-[9px] font-bold uppercase tracking-wider mb-1",
                      res.status === "active" ? "bg-emerald-500" : "bg-gray-400"
                    )}>
                      {res.status}
                    </Badge>
                    <h3 className="text-sm font-bold text-foreground leading-tight">
                      {res.parking_lots?.name}
                    </h3>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                      <MapPin size={10} />
                      <span className="truncate max-w-[180px]">{res.parking_lots?.address}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-primary">Slot {res.parking_slots?.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">₱{res.total_amount}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 py-3 border-y border-gray-50">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-muted-foreground" />
                    <div>
                      <p className="text-[9px] uppercase font-bold text-muted-foreground leading-none">Time</p>
                      <p className="text-[11px] font-bold mt-1">{res.start_time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Car size={12} className="text-muted-foreground" />
                    <div>
                      <p className="text-[9px] uppercase font-bold text-muted-foreground leading-none">Duration</p>
                      <p className="text-[11px] font-bold mt-1">{res.duration} Hour{res.duration > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => navigate(`/receipt/${res.id}`)}
                  className="w-full mt-3 flex items-center justify-center gap-1 text-[11px] font-bold text-primary py-1"
                >
                  View Digital Receipt <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}