/*
 * iParkBayan — MyBookingsPage
 * Features: Real-time Status colors, Navigation to Digital Receipt, & Detailed Info
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "../../supabaseClient";
import { Ticket, MapPin, Calendar, Clock, ChevronRight, CircleCheck, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MyBookingsPage() {
  const [, navigate] = useLocation();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("reservations")
          .select(`
            *, 
            parking_lots(name, address),
            parking_slots(label)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        if (data) setBookings(data);
      } catch (err) {
        console.error("Fetch bookings error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  return (
    <MobileLayout title="My Bookings" showBack onBack={() => navigate("/home")}>
      <div className="page-enter p-4 space-y-4 pb-20">
        
        <div className="mb-2">
          <h2 className="text-xl font-black text-slate-900">Your Tickets</h2>
          <p className="text-xs text-muted-foreground font-medium">History of your parking reservations</p>
        </div>

        {loading ? (
          <div className="space-y-4 pt-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 w-full bg-gray-100 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center pt-20 space-y-3">
             <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <Ticket className="text-gray-400" size={30} />
             </div>
             <p className="text-muted-foreground font-bold italic text-sm">Walang nahanap na booking.</p>
          </div>
        ) : (
          bookings.map((res) => (
            <div 
              key={res.id} 
              onClick={() => navigate(`/ticket/${res.id}`)}
              className="relative bg-white border border-gray-100 rounded-[2rem] p-5 shadow-sm active:scale-95 transition-transform cursor-pointer overflow-hidden group"
            >
              {/* Status Badge */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "p-2 rounded-xl",
                    res.status === 'active' ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"
                  )}>
                    {res.status === 'active' ? <Timer size={16} /> : <CircleCheck size={16} />}
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-800 line-clamp-1">{res.parking_lots?.name}</h3>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <MapPin size={10}/> {res.parking_lots?.address}
                    </p>
                  </div>
                </div>
                
                <span className={cn(
                  "text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm",
                  res.status === 'active' 
                    ? "bg-emerald-500 text-white animate-pulse" 
                    : "bg-slate-100 text-slate-500"
                )}>
                  {res.status}
                </span>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-3 gap-2 py-3 border-y border-dashed border-gray-100">
                <div className="text-center border-r border-gray-50">
                  <p className="text-[8px] font-black text-muted-foreground uppercase">Slot</p>
                  <p className="font-black text-primary text-sm">{res.parking_slots?.label || "---"}</p>
                </div>
                <div className="text-center border-r border-gray-50">
                  <p className="text-[8px] font-black text-muted-foreground uppercase">Plate</p>
                  <p className="font-black text-slate-700 text-sm uppercase">{res.plate_number}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-black text-muted-foreground uppercase">Amount</p>
                  <p className="font-black text-emerald-600 text-sm">₱{res.total_amount}</p>
                </div>
              </div>

              {/* Bottom Footer */}
              <div className="flex justify-between items-center mt-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} className="text-muted-foreground" />
                    <span className="text-[10px] font-bold text-slate-500">{res.date}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-muted-foreground" />
                    <span className="text-[10px] font-bold text-slate-500">{res.start_time}</span>
                  </div>
                </div>
                <div className="flex items-center text-primary font-black text-[10px] gap-1 group-hover:translate-x-1 transition-transform">
                  VIEW TICKET <ChevronRight size={14} />
                </div>
              </div>

              {/* Perforation Effect (Design only) */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-4 bg-slate-50 rounded-r-full border border-l-0 border-gray-100" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-4 bg-slate-50 rounded-l-full border border-r-0 border-gray-100" />
            </div>
          ))
        )}
      </div>
    </MobileLayout>
  );
}