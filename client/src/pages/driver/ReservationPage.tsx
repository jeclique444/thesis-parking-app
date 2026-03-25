/*
 * iParkBayan — ReservationPage (With Exact Real-Time Arrival Input, Time Validation & One-Booking Policy)
 */
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, ChevronRight, Check, Clock, Ticket, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "../../supabaseClient";

// Components
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isToday } from "date-fns";

// Function para makuha ang current time (Format: HH:mm)
const getCurrentTime = () => {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

export default function ReservationPage() {
  const params = useParams<{ slotId: string }>();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const lotId = searchParams.get("lot");
  const slotId = params.slotId;

  const [lot, setLot] = useState<any>(null);
  const [slot, setSlot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // ACTIVE RESERVATION STATES
  const [activeReservation, setActiveReservation] = useState<any>(null); 
  const [userActiveBooking, setUserActiveBooking] = useState<any>(null); 

  // USER INPUTS
  const [plateNumber, setPlateNumber] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date()); 
  const [startTime, setStartTime] = useState(getCurrentTime());
  const [duration, setDuration] = useState(3);
  const [paymentMethod, setPaymentMethod] = useState<"gcash" | "maya">("gcash");

  // 1. FETCH INITIAL DATA & CHECK ACTIVE RESERVATIONS
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lotRes, slotRes] = await Promise.all([
          supabase.from("parking_lots").select("*").eq("id", lotId).single(),
          supabase.from("parking_slots").select("*").eq("id", slotId).single(),
        ]);
        setLot(lotRes.data);
        setSlot(slotRes.data);

        // A. CHECK KUNG MAY LAMAN YUNG SLOT NA PINILI
        const { data: slotResData } = await supabase
          .from("reservations")
          .select("*")
          .eq("status", "active")
          .eq("slot_id", slotId)
          .limit(1); 
        
        if (slotResData && slotResData.length > 0) {
          setActiveReservation(slotResData[0]);
        }

        // B. CHECK KUNG YUNG CURRENT USER AY MAY ACTIVE BOOKING PA
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userResData, error: userError } = await supabase
            .from("reservations")
            .select("*")
            .eq("status", "active")
            .eq("user_id", user.id)
            .limit(1); 
            
          if (userError) console.error("Error fetching user bookings:", userError);
            
          if (userResData && userResData.length > 0) {
            setUserActiveBooking(userResData[0]);
          }
        }

      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [lotId, slotId]);

  // 2. TIME COMPUTATIONS 
  const calculateEndTime24 = (start: string, dur: number) => {
    if (!start) return "";
    const [hours, minutes] = start.split(":").map(Number);
    const endHours = (hours + dur) % 24;
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // 3. UI FORMATTER 
  const format12Hour = (time24: string) => {
    if (!time24) return "--:--";
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 || 12;
    return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  // 4. TIME VALIDATION
  const isTimeValid = () => {
    if (!date || !startTime) return true;
    if (isToday(date)) {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const [selectedHours, selectedMinutes] = startTime.split(":").map(Number);

      if (
        selectedHours < currentHours || 
        (selectedHours === currentHours && selectedMinutes < currentMinutes)
      ) {
        return false;
      }
    }
    return true;
  };

  const timeIsValid = isTimeValid();
  const endTime24 = calculateEndTime24(startTime, duration);
  const totalCost = duration <= 3 ? 40 : 40 + (duration - 3) * 10;
  
  const isBlocked = userActiveBooking !== null || activeReservation !== null;

  const handleProceed = () => {
    if (isBlocked) {
      alert("Hindi ka pwedeng mag-proceed dahil may active booking ka pa.");
      return; 
    }
    if (!plateNumber || !startTime || !date || !timeIsValid) return;
    
    // 🔥 DYNAMIC STATUS LOGIC (Reserved vs Occupied)
    const now = new Date();
    const [selH, selM] = startTime.split(":").map(Number);
    const selectedDateTime = new Date(date);
    selectedDateTime.setHours(selH, selM, 0, 0);

    // Kukunin natin yung difference in minutes (Selected Time vs Current Time)
    const diffMins = (selectedDateTime.getTime() - now.getTime()) / 60000;
    
    // Kapag lagpas 5 minutes pa ang dating niya, "reserved" (Yellow). Kapag malapit na or ngayon na, "occupied" (Red).
    const initialSlotStatus = diffMins > 5 ? "reserved" : "occupied";

    // 🔥 MIDNIGHT BUG FIX (Tatawid ba ng 12 AM?)
    const [endH] = endTime24.split(":").map(Number);
    const isNextDay = endH < selH ? "true" : "false";

    const formattedDate = format(date, "yyyy-MM-dd");
    
    // Pinasa natin sa URL yung status at nextDay para mabasa ng Confirm Page
    navigate(`/reserve/${slotId}/confirm?lot=${lotId}&date=${formattedDate}&start=${format12Hour(startTime)}&end=${format12Hour(endTime24)}&dur=${duration}&plate=${plateNumber}&pay=${paymentMethod}&total=${totalCost}&status=${initialSlotStatus}&nextDay=${isNextDay}&start24=${startTime}&end24=${endTime24}`);
  };

  if (loading) return <div className="p-20 text-center font-bold text-primary animate-pulse">Loading...</div>;

  return (
    <MobileLayout title="Reserve Slot" showBack onBack={() => window.history.back()}>
      <div className="page-enter p-4 space-y-4 pb-24">
        
        {/* WARNINGS */}
        {userActiveBooking && (
          <div className="bg-red-500 text-white p-5 rounded-3xl shadow-lg border-2 border-red-400 flex flex-col justify-center animate-in slide-in-from-top duration-500">
            <p className="text-[10px] font-bold uppercase opacity-90 flex items-center gap-1 mb-1">
              <AlertCircle size={12}/> Action Not Allowed
            </p>
            <h3 className="font-black text-lg leading-tight">You already have an active booking</h3>
            <p className="text-xs opacity-90 mt-1">Please finish or wait for your current reservation to end before booking another slot.</p>
            <Button 
              onClick={() => navigate(`/ticket/${userActiveBooking.id}`)}
              className="bg-white text-red-600 hover:bg-red-50 font-black rounded-xl text-xs h-10 px-4 mt-3 self-start"
            >
              View My Current Ticket
            </Button>
          </div>
        )}

        {!userActiveBooking && activeReservation && (
          <div className="bg-emerald-500 text-white p-5 rounded-3xl shadow-lg border-2 border-emerald-400 flex justify-between items-center animate-in slide-in-from-top duration-500">
            <div>
              <p className="text-[10px] font-bold uppercase opacity-80 flex items-center gap-1">
                <Ticket size={10}/> Slot Currently Taken
              </p>
              <h3 className="font-black text-lg leading-tight">Slot {slot?.label}</h3>
              <p className="text-[10px] font-bold">Plate: {activeReservation.plate_number}</p>
            </div>
            <Button disabled className="bg-white/50 text-white font-black rounded-xl text-xs h-10 px-4 cursor-not-allowed">
              Unavailable
            </Button>
          </div>
        )}

        {/* Slot Info Card */}
        <div className={cn("text-white rounded-3xl p-6 shadow-lg transition-colors", isBlocked ? "bg-gray-400" : "bg-[oklch(0.22_0.07_255)]")}>
          <div className="flex justify-between items-start">
            <div>
              <p className="opacity-70 text-[10px] font-bold uppercase tracking-widest">{lot?.name}</p>
              <h2 className="text-3xl font-black mt-1">Slot {slot?.label}</h2>
              <p className="text-[10px] opacity-80 mt-1 flex items-center gap-1"><Clock size={10}/> {lot?.open_hours}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold opacity-70 uppercase">Total</p>
              <p className="text-xl font-black">₱{totalCost}</p>
            </div>
          </div>
        </div>

        {/* Date Picker */}
        <div className={cn("bg-white rounded-2xl p-4 border shadow-sm", isBlocked ? "opacity-50 pointer-events-none" : "border-gray-100")}>
          <label className="text-[10px] font-black uppercase text-muted-foreground mb-2 block tracking-widest">Arrival Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="w-full h-12 justify-start text-left font-bold rounded-xl border-gray-200">
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                {date ? format(date, "MMMM d, yyyy") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
                disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))} 
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Plate Number */}
        <div className={cn("bg-white rounded-2xl p-4 border shadow-sm", isBlocked ? "opacity-50 pointer-events-none" : "border-gray-100")}>
          <label className="text-[10px] font-black uppercase text-muted-foreground mb-2 block tracking-widest">Plate Number</label>
          <Input 
            placeholder="ABC 1234"
            className="h-12 rounded-xl font-bold uppercase text-lg border-gray-200"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            disabled={isBlocked}
          />
        </div>

        {/* Exact Time & Duration Selection */}
        <div className={cn("grid grid-cols-2 gap-3", isBlocked ? "opacity-50 pointer-events-none" : "")}>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm relative flex flex-col justify-center">
            <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">Arrival Time</label>
            <input 
              type="time" 
              value={startTime} 
              onChange={(e) => setStartTime(e.target.value)}
              className={cn(
                "w-full bg-transparent font-black text-lg outline-none cursor-pointer",
                !timeIsValid && "text-red-500"
              )}
              required
              disabled={isBlocked}
            />
            {!timeIsValid && (
              <p className="text-[9px] text-red-500 font-bold absolute bottom-1 left-4">
                Past time invalid.
              </p>
            )}
          </div>
          
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm relative flex flex-col justify-center">
            <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">Duration</label>
            <select 
              value={duration} 
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full bg-transparent font-black text-lg outline-none cursor-pointer appearance-none"
              disabled={isBlocked}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 12].map(h => <option key={h} value={h}>{h} Hour{h>1?'s':''}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 translate-y-1 pointer-events-none">
              <ChevronRight size={16} className="text-gray-400 rotate-90" />
            </div>
          </div>
        </div>

        {/* Time Range Summary */}
        <div className={cn("bg-gray-50 rounded-2xl p-4 border border-dashed border-gray-300 flex justify-between items-center", isBlocked ? "opacity-50" : "")}>
            <div className="text-center flex-1">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">From</p>
              <p className="font-black text-primary">{format12Hour(startTime)}</p>
            </div>
            <div className="px-4"><ChevronRight className="text-gray-300" size={16}/></div>
            <div className="text-center flex-1">
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Until</p>
              <p className="font-black text-primary">{format12Hour(endTime24)}</p>
            </div>
        </div>

        {/* Payment Integration */}
        <div className={cn("space-y-3", isBlocked ? "opacity-50 pointer-events-none" : "")}>
          <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest ml-1">Payment Method</h3>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setPaymentMethod("gcash")} className={cn("h-16 rounded-2xl border-2 flex flex-col items-center justify-center transition-all relative", paymentMethod === "gcash" ? "border-blue-500 bg-blue-50/50" : "border-gray-100 bg-white")}>
              <span className="text-blue-600 font-black text-lg">GCash</span>
              {paymentMethod === "gcash" && <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5"><Check size={10} className="text-white"/></div>}
            </button>
            <button onClick={() => setPaymentMethod("maya")} className={cn("h-16 rounded-2xl border-2 flex flex-col items-center justify-center transition-all relative", paymentMethod === "maya" ? "border-emerald-500 bg-emerald-50/50" : "border-gray-100 bg-white")}>
              <span className="text-emerald-600 font-black text-lg">Maya</span>
              {paymentMethod === "maya" && <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5"><Check size={10} className="text-white"/></div>}
            </button>
          </div>
        </div>

        <Button 
          onClick={handleProceed} 
          disabled={isBlocked || !plateNumber || !startTime || !timeIsValid} 
          className={cn(
            "w-full h-16 rounded-2xl text-lg font-black shadow-xl transition-all",
            isBlocked || !plateNumber || !startTime || !timeIsValid
              ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
              : "bg-[oklch(0.22_0.07_255)] text-white" 
          )}
        >
          {isBlocked 
            ? "You have an active booking" 
            : !timeIsValid 
              ? "Invalid Arrival Time" 
              : `Pay ₱${totalCost} to Reserve`}
        </Button>
      </div>
    </MobileLayout>
  );
}