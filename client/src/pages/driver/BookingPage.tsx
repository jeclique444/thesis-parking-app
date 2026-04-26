/*
 * iParkBayan — MyBookingPage (Connected to Supabase)
 * Design: Civic Tech / Filipino Urban Identity
 * UPDATED: One rating per transaction (added reservation_id to parking_reviews)
 * MODIFIED: Entire card is clickable to view receipt (instead of separate "View Ticket" button)
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { Clock, Car, Calendar, CheckCircle2, BookmarkCheck, Star, X, Loader2 } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Helper functions (unchanged)
const formatTimeFromISO = (isoString: string) => {
  if (!isoString) return "--:--";
  const date = new Date(isoString);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

function RatingStars({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1 justify-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            size={28}
            className={cn(
              "transition-all",
              (hover || value) >= star
                ? "fill-amber-400 text-amber-400"
                : "text-gray-300"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export default function MyReservationsPage() {
  const [, navigate] = useLocation();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("all");

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchMyReservations = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("reservations")
          .select(`
            *,
            parking_lots (id, name, address),
            parking_slots (label),
            review:parking_reviews!parking_reviews_reservation_id_fkey (id)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const enriched = (data || []).map((res: any) => ({
          ...res,
          hasRated: res.review && res.review.length > 0
        }));
        setReservations(enriched);
      } catch (error) {
        console.error("Error fetching reservations:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMyReservations();
  }, []);

  const filteredReservations = reservations.filter((res) => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return res.status === "active" || res.status === "booked";
    if (activeTab === "completed") return res.status !== "active" && res.status !== "booked";
    return true;
  });

  const openRatingModal = (reservation: any) => {
    setSelectedReservation(reservation);
    setRating(0);
    setReviewText("");
    setShowRatingModal(true);
  };

  const submitRating = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { error } = await supabase
        .from("parking_reviews")
        .insert({
          lot_id: selectedReservation.lot_id,
          user_id: user.id,
          reservation_id: selectedReservation.id,
          rating,
          review: reviewText.trim() || null
        });
      if (error) throw error;

      toast.success("Thank you for your review!");
      setShowRatingModal(false);

      setReservations(prev => prev.map(r =>
        r.id === selectedReservation.id ? { ...r, hasRated: true } : r
      ));
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
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
        {/* Tabs */}
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

        {filteredReservations.length === 0 ? (
          <div className="bg-muted/30 rounded-3xl p-10 text-center border border-dashed border-gray-200 mt-2">
            <Calendar className="mx-auto text-muted-foreground/30 mb-2" size={32} />
            <p className="text-xs text-muted-foreground font-medium">No {activeTab !== "all" ? activeTab : ""} reservations found.</p>
            {activeTab === "active" && (
              <button onClick={() => navigate("/map")} className="text-[12px] text-[#003366] font-bold mt-2 hover:underline">
                Find Parking
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReservations.map((res) => {
              const isOngoing = res.status === "active";
              const isBooked = res.status === "booked";
              const isCompleted = !isOngoing && !isBooked;
              const startTimeFormatted = formatTimeFromISO(res.start_time);
              const endTimeFormatted = formatTimeFromISO(res.end_time);
              const bookingDate = formatDate(res.created_at);

              return (
                <div
                  key={res.id}
                  onClick={() => navigate(`/receipt/${res.id}`)}
                  className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform cursor-pointer"
                >
                  {/* Header */}
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

                  <p className="text-[12px] text-gray-500 mb-2.5">
                    Slot {res.parking_slots?.label || "--"} • {res.plate_number || "N/A"}
                  </p>

                  <div className="flex flex-row justify-between items-center w-full gap-2 text-[11px] text-gray-500 mb-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock size={13} className="shrink-0" />
                      <span className="truncate">
                        {bookingDate} • {startTimeFormatted} – {endTimeFormatted}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 shrink-0">
                      <Car size={13} className="text-gray-700" />
                      <span className="font-semibold text-gray-700">{res.duration} hr{res.duration > 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div className="h-px w-full bg-gray-100 mb-2.5"></div>

                  <div className="flex justify-between items-center">
                    <p className="text-[15px] font-bold text-gray-900">₱{res.total_amount}</p>
                    <div className="flex gap-2">
                      {/* Rate button only – no View Ticket button anymore */}
                      {isCompleted && !res.hasRated && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openRatingModal(res); }}
                          className="bg-amber-50 text-amber-600 text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1"
                        >
                          <Star size={12} /> Rate
                        </button>
                      )}
                      {isCompleted && res.hasRated && (
                        <button
                          onClick={(e) => e.stopPropagation()}
                          disabled
                          className="text-gray-400 text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1"
                        >
                          <Star size={12} /> Rated
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rating Modal */}
      {showRatingModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black">Rate Your Experience</h3>
              <button onClick={() => setShowRatingModal(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <div className="text-center mb-4">
              <p className="text-sm font-medium">{selectedReservation.parking_lots?.name}</p>
              <p className="text-xs text-gray-500">Slot {selectedReservation.parking_slots?.label} • {selectedReservation.plate_number}</p>
            </div>
            <RatingStars value={rating} onChange={setRating} />
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience (optional)"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none mt-4 focus:outline-none focus:ring-1 focus:ring-primary"
              rows={3}
            />
            <Button
              onClick={submitRating}
              disabled={submitting || rating === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl mt-4"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : "Submit Rating"}
            </Button>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}