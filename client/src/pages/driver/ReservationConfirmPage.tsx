/*
 * iParkBayan — ReservationConfirmPage (Payment Gateway & Details)
 * Design: Civic Tech / Filipino Urban Identity
 */
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  ShieldCheck, 
  Wallet, 
  Loader2, 
  Info,
  MapPin,
  Clock,
  Car
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import { cn } from "@/lib/utils";

export default function ReservationConfirmPage() {
  const params = useParams<{ slotId: string }>();
  const [, navigate] = useLocation();
  
  const searchParams = new URLSearchParams(window.location.search);
  const lotId = searchParams.get("lot");
  const startTime = searchParams.get("start");
  const endTime = searchParams.get("end");
  const duration = searchParams.get("dur");
  const plateNumber = searchParams.get("plate");
  const paymentMethod = searchParams.get("pay"); 
  const totalAmount = searchParams.get("total");
  const statusFromUrl = searchParams.get("status"); // <--- Dagdag: kinuha ang status sa URL
  const slotId = params.slotId;

  const [lot, setLot] = useState<any>(null);
  const [slot, setSlot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [newReservationId, setNewReservationId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const [lotRes, slotRes] = await Promise.all([
          supabase.from("parking_lots").select("*").eq("id", lotId).single(),
          supabase.from("parking_slots").select("*").eq("id", slotId).single()
        ]);
        setLot(lotRes.data);
        setSlot(slotRes.data);
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [lotId, slotId]);

  // --- AUTO-RELEASE LOGIC ---
  // ⚠️ KINOMMENT-OUT PARA HINDI MAG-AUTO COMPLETED/AVAILABLE AGAD YUNG SLOT ⚠️
  /*
  useEffect(() => {
    if (!endTime || !slotId) return;

    const checkAndRelease = async () => {
      // Convert "14:30" (endTime) to a comparable Date object
      const now = new Date();
      const [hours, minutes] = endTime.split(':').map(Number);
      const endDateTime = new Date();
      endDateTime.setHours(hours, minutes, 0, 0);

      // Kung ang oras ngayon ay lumagpas na sa endDateTime
      if (now > endDateTime) {
        console.log("Reservation expired. Releasing slot...");
        await supabase
          .from("parking_slots")
          .update({ status: "available" })
          .eq("id", slotId);
      }
    };

    // Check every 1 minute
    const interval = setInterval(checkAndRelease, 60000);
    return () => clearInterval(interval);
  }, [endTime, slotId]);
  */

const triggerNotification = async (userId: string, slotLabel: string) => {
  console.log("Sending notif to user:", userId); // I-check ito sa console
  
  const { error } = await supabase.from("notifications").insert([
    {
      user_id: userId, // Siguraduhin na ito ay auth.uid()
      title: "Congratulations! 🎉",
      message: `Reservation confirmed for Slot ${slotLabel}.`,
      type: "reservation",
      read: false
    }
  ]);

  if (error) console.error("Notification trigger failed:", error.message);
};

// ... inside the handlePayment function:
const handlePayment = async () => {
  setIsProcessing(true);
  
  setTimeout(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      // 1. SAVE TO RESERVATIONS
      const { data: newRes, error: resError } = await supabase
        .from("reservations")
        .insert({
          user_id: user.id, 
          lot_id: lotId,
          slot_id: slotId,
          plate_number: plateNumber?.toUpperCase(),
          start_time: startTime,
          end_time: endTime,
          duration: parseInt(duration || "3"),
          total_amount: parseFloat(totalAmount || "40"),
          payment_method: paymentMethod,
          status: statusFromUrl || "booked" // <--- Binago: dynamic status na imbes na 'active'
        })
        .select()
        .single();

      if (resError) throw resError;

      // ==========================================
      // 🟢 BAGONG CODE PARA SA RECEIPTS TABLE 🟢
      // ==========================================
      // Gumawa ng random 6-character reference number (Hal. EZP-A1B2C3)
      const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
      const refNo = `EZP-${randomChars}`;

      const { error: receiptError } = await supabase
        .from("receipts")
        .insert({
          reservation_id: newRes.id,
          user_id: user.id,
          reference_no: refNo,
          amount_paid: parseFloat(totalAmount || "40"),
          payment_method: paymentMethod || "Unknown"
        });

      if (receiptError) throw receiptError;
      // ==========================================

      // 2. UPDATE PARKING_SLOTS STATUS
      const { error: updateError } = await supabase
        .from("parking_slots")
        .update({ status: "reserved" }) 
        .eq("id", slotId);

      if (updateError) throw updateError;

      // 3. 🔥 TRIGGER THE NOTIFICATION
      await triggerNotification(user.id, slot?.label || "");

      // Naka-base pa rin tayo sa Reservation ID para hindi masira yung redirect route mo
      setNewReservationId(newRes.id);
      setIsSuccess(true);
      toast.success("Reservation successful!");

    } catch (err: any) {
      console.error("Full Error:", err);
      toast.error("Process Failed: " + err.message);
      setIsProcessing(false);
    }
  }, 2500);
};

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="text-center font-bold animate-pulse text-primary">Verifying Payment Details...</div>
    </div>
  );

  if (isSuccess) {
    return (
      <div className="mobile-shell flex flex-col items-center justify-center h-screen bg-white px-8 space-y-6">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center animate-bounce-short">
          <CheckCircle2 size={48} className="text-emerald-600" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground">Payment Received</h2>
          <p className="text-sm text-muted-foreground mt-2 px-4">
            Your reservation for <strong>{plateNumber}</strong> is now {statusFromUrl === 'active' ? 'active' : 'confirmed'}.
          </p>
        </div>
        <div className="w-full bg-gray-50 rounded-3xl p-6 border border-gray-100 space-y-3">
           <div className="flex justify-between text-xs font-bold">
             <span className="text-muted-foreground uppercase">Reference No.</span>
             <span className="text-foreground uppercase tracking-tight">
               {newReservationId?.slice(0, 8) || "PROCESSING"}
             </span>
           </div>
           <div className="flex justify-between text-xs font-bold">
             <span className="text-muted-foreground uppercase">Method</span>
             <span className="text-foreground uppercase">{paymentMethod}</span>
           </div>
        </div>
        <Button 
          onClick={() => navigate(`/receipt/${newReservationId}`)} 
          className="w-full h-14 rounded-2xl bg-[oklch(0.22_0.07_255)] font-bold text-lg shadow-lg"
        >
          View Digital Receipt
        </Button>
      </div>
    );
  }

  return (
    <MobileLayout title="Payment" showBack onBack={() => navigate(`/reserve/${slotId}?lot=${lotId}`)} >
      <div className="page-enter p-4 space-y-4 pb-20">
        <div className="text-center py-4">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">Total Amount Due</p>
          <h1 className="text-4xl font-black text-primary">₱{totalAmount}.00</h1>
        </div>

        <div className={cn(
          "flex items-center justify-between p-4 rounded-2xl border-2 transition-all",
          paymentMethod === 'gcash' ? "bg-blue-50 border-blue-200" : "bg-emerald-50 border-emerald-200"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-black", paymentMethod === 'gcash' ? "bg-blue-600" : "bg-emerald-600")}>
              {paymentMethod === 'gcash' ? "G" : "M"}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-tight">Paying via {paymentMethod}</p>
              <p className="text-[10px] text-muted-foreground">Secure electronic payment</p>
            </div>
          </div>
          <ShieldCheck className={paymentMethod === 'gcash' ? "text-blue-600" : "text-emerald-600"} size={20} />
        </div>

        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
          <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest border-b pb-3">Booking Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-muted-foreground uppercase">Parking Lot</p>
              <p className="text-sm font-bold truncate">{lot?.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-muted-foreground uppercase">Slot Label</p>
              <p className="text-sm font-bold text-primary underline underline-offset-4">Slot {slot?.label}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-muted-foreground uppercase">Vehicle Plate</p>
              <p className="text-sm font-bold uppercase">{plateNumber}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-muted-foreground uppercase">Schedule</p>
              <p className="text-sm font-bold">{startTime} - {endTime}</p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 px-2 opacity-60">
           <Info size={14} className="shrink-0 mt-0.5" />
           <p className="text-[9px] font-medium leading-relaxed">
             By clicking "Pay Now", you authorize ParKada to deduct ₱{totalAmount} from your {paymentMethod} account. This transaction is encrypted and secured.
           </p>
        </div>

        <Button 
          onClick={handlePayment}
          disabled={isProcessing}
          className={cn(
            "w-full h-16 rounded-2xl text-lg font-black shadow-xl transition-all active:scale-95 mt-4",
            paymentMethod === 'gcash' ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
          )}
        >
          {isProcessing ? (
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin" size={20} />
              <span className="tracking-tight uppercase">Authenticating...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Wallet size={20} />
              <span>Pay Now with {paymentMethod === 'gcash' ? 'GCash' : 'Maya'}</span>
            </div>
          )}
        </Button>
      </div>
    </MobileLayout>
  );
}