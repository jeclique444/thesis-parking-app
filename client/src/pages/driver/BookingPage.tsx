/*
 * iParkBayan — MyBookingPage (Connected to Supabase)
 * Design: Civic Tech / Filipino Urban Identity
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { Clock, Car, Calendar, CheckCircle2, BookmarkCheck } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { cn } from "@/lib/utils";

export default function MyReservationsPage() {
  const [, navigate] = useLocation();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // TAB STATE
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    const fetchMyReservations = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch reservations and sort chronologically (recent to past)
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

  // FILTER LOGIC
  const filteredReservations = reservations.filter((res) => {
    if (activeTab === "all") return true;
    // Ang 'active' tab ay magpapakita na ngayon ng parehong 'active' at 'booked'
    if (activeTab === "active") return res.status === "active" || res.status === "booked";
    // Ang 'completed' ay lahat ng hindi active o booked (e.g., completed, cancelled)
    if (activeTab === "completed") return res.status !== "active" && res.status !== "booked"; 
    return true;
  });

  // DATE FORMATTER (Using created_at)
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  if (loading) {
    return (
      <MobileLayout title="My Bookings">
        <div className="p-8 text-center space-y-4 h-[60vh] flex flex-col justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground animate-pulse text-xs">Loading your history...</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="My Bookings">
      <div className="page-enter p-4 space-y-4 pb-24">
        
        {/* INTERACTIVE TABS NAVIGATION */}
        <div className="flex bg-gray-100 p-1 rounded-xl mb-1">
          {["all", "active", "completed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "flex-1 py-1.5 text-[11px] font-bold capitalize tracking-wide rounded-lg transition-all",
                activeTab === tab 
                  ? "bg-[#003366] text-white shadow-sm" 
                  : "text-gray-500 hover:bg-gray-200"
              )}
            >
              {tab === "active" ? "Active / Booked" : tab}
            </button>
          ))}
        </div>

        {/* RESERVATIONS LIST */}
        {filteredReservations.length === 0 ? (
          <div className="bg-muted/30 rounded-3xl p-10 text-center border border-dashed border-gray-200 mt-2">
            <Calendar className="mx-auto text-muted-foreground/30 mb-2" size={32} />
            <p className="text-xs text-muted-foreground font-medium">No {activeTab !== "all" ? activeTab : ""} reservations found.</p>
            {activeTab === "active" && (
              <button 
                onClick={() => navigate("/reservations")}
                className="text-[12px] text-[#003366] font-bold mt-2 hover:underline"
              >
                Book a slot now
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReservations.map((res) => {
              const isOngoing = res.status === "active";
              const isBooked = res.status === "booked";

              return (
                <div 
                  key={res.id}
                  className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
                >
                  {/* HEADER: Lot Name & Status */}
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="text-[15px] font-bold text-gray-900 leading-tight">
                      {res.parking_lots?.name || "Parking Lot"}
                    </h3>
                    <div className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-medium flex items-center gap-1",
                      isOngoing ? "bg-[#e6f8ef] text-[#00a85a]" : 
                      isBooked ? "bg-blue-50 text-blue-600" : 
                      "bg-[#f1f5f9] text-[#64748b]"
                    )}>
                      {isBooked ? <BookmarkCheck size={11} /> : <CheckCircle2 size={11} />}
                      {isOngoing ? "Active" : isBooked ? "Booked" : "Completed"}
                    </div>
                  </div>

                  {/* SUBTITLE: Slot & Plate */}
                  <p className="text-[12px] text-gray-500 mb-2.5">
                    Slot {res.parking_slots?.label || "--"} • {res.plate_number || "N/A"}
                  </p>

                  {/* DETAILS: Schedule (Left) & Duration (Right) */}
                  <div className="flex flex-row justify-between items-center w-full gap-2 text-[11px] text-gray-500 mb-3">
                    
                    {/* SCHEDULE (CLOCK ICON) */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock size={13} className="shrink-0" />
                      <span className="truncate">
                        {formatDate(res.created_at)} • {res.start_time}–{res.end_time || res.start_time}
                      </span>
                    </div>

                    {/* DURATION (CAR ICON) */}
                    <div className="flex items-center justify-end gap-1.5 shrink-0">
                      <Car size={13} className="text-gray-700" />
                      <span className="font-semibold text-gray-700">{res.duration} hr{res.duration > 1 ? 's' : ''}</span>
                    </div>

                  </div>

                  {/* DIVIDER */}
                  <div className="h-[1px] w-full bg-gray-100 mb-2.5"></div>

                  {/* FOOTER: Price & Action */}
                  <div className="flex justify-between items-center">
                    <p className="text-[15px] font-bold text-gray-900">
                      ₱{res.total_amount}
                    </p>
                    <button 
                      onClick={() => navigate(`/receipt/${res.id}`)}
                      className="bg-transparent text-primary text-[13px] font-bold tracking-wide hover:underline px-2 py-1"
                    >
                      View Ticket
                    </button>
                  </div>
                  
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}