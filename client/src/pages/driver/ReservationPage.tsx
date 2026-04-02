/*
 * iParkBayan — ReservationPage (Fixed with Local Data Cache for is_reservable)
 */
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
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

// Helper function para makuha ang Closing Time galing sa "8 AM - 10 PM" string format
const getLotClosingTime24 = (openHours: string) => {
  if (!openHours || openHours.toLowerCase().includes("24 hours")) return "23:59";
  
  const parts = openHours.split("-");
  if (parts.length === 2) {
    let closeStr = parts[1].trim().toUpperCase();
    let isPM = closeStr.includes("PM");
    let isAM = closeStr.includes("AM");
    let timePart = closeStr.replace("PM", "").replace("AM", "").trim();
    let [h, m] = timePart.split(":").map(Number);
    
    if (isNaN(h)) return "23:59";
    if (isNaN(m)) m = 0;
    
    if (isPM && h !== 12) h += 12;
    if (isAM && h === 12) h = 0;
    
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  return "23:59"; 
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

  // USER VEHICLES STATES
  const [userVehicles, setUserVehicles] = useState<any[]>([]);
  const [activePlates, setActivePlates] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lotRes, slotRes] = await Promise.all([
          supabase.from("parking_lots").select("*").eq("id", lotId).single(),
          supabase.from("parking_slots").select("*").eq("id", slotId).single(),
        ]);
        setLot(lotRes.data);
        setSlot(slotRes.data);

        const { data: slotResData } = await supabase
          .from("reservations")
          .select("*")
          .eq("status", "active")
          .eq("slot_id", slotId)
          .limit(1); 
        
        if (slotResData && slotResData.length > 0) {
          setActiveReservation(slotResData[0]);
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: vehiclesData } = await supabase
            .from("vehicles")
            .select("*")
            .eq("user_id", user.id);
          setUserVehicles(vehiclesData || []);

          const { data: activeResData } = await supabase
            .from("reservations")
            .select("*")
            .eq("status", "active")
            .eq("user_id", user.id);
            
          if (activeResData && activeResData.length > 0) {
            const platesInUse = activeResData.map(res => res.plate_number);
            setActivePlates(platesInUse);
            setUserActiveBooking(activeResData[0]); 
          }
        }

      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [lotId, slotId]);

  const calculateEndTime24 = (start: string, dur: number) => {
    if (!start) return "";
    const [hours, minutes] = start.split(":").map(Number);
    const endHours = (hours + dur) % 24;
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const format12Hour = (time24: string) => {
    if (!time24) return "--:--";
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 || 12;
    return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

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
        return false; // Time is in the past
      }
    }
    return true;
  };

  // MAX 3 HOURS ADVANCE BOOKING VALIDATION
  const checkAdvanceLimit = () => {
    if (!date || !startTime) return false;
    const now = new Date();
    const selectedDateTime = new Date(date);
    const [selH, selM] = startTime.split(":").map(Number);
    selectedDateTime.setHours(selH, selM, 0, 0);

    const diffMins = (selectedDateTime.getTime() - now.getTime()) / 60000;
    return diffMins > 180; // 180 minutes = 3 hours
  };

  const timeIsValid = isTimeValid();
  const isTooAdvance = checkAdvanceLimit();
  const endTime24 = calculateEndTime24(startTime, duration);

  // REALISTIC FEE COMPUTATIONS 
  const calculateAdvanceFee = () => {
    if (!startTime || !date || isTooAdvance) return 0;
    
    const now = new Date();
    const selectedDateTime = new Date(date);
    const [selH, selM] = startTime.split(":").map(Number);
    selectedDateTime.setHours(selH, selM, 0, 0);

    const diffMins = Math.floor((selectedDateTime.getTime() - now.getTime()) / 60000);

    if (diffMins <= 30) return 0; 

    const ADVANCE_FEE_RATE = 10;
    const advanceHours = Math.ceil((diffMins - 30) / 60); 

    return advanceHours > 0 ? advanceHours * ADVANCE_FEE_RATE : 0;
  };

  const advanceFee = calculateAdvanceFee();
  const baseRate = 30; // ₱30 for first 3 hours
  const extendedFee = duration > 3 ? (duration - 3) * 10 : 0; // ₱10 per extra hour
  const totalCost = baseRate + extendedFee + advanceFee; 
  
  const checkExceedsCloseTime = () => {
    if (!lot?.open_hours || lot.open_hours.toLowerCase().includes("24 hours")) return false;
    
    const closeTime24 = getLotClosingTime24(lot.open_hours);
    const [closeH, closeM] = closeTime24.split(":").map(Number);
    const [startH, startM] = startTime.split(":").map(Number);
    
    const endTotalMins = (startH * 60 + startM) + (duration * 60);
    let closeTotalMins = closeH * 60 + closeM;

    if (closeTotalMins <= 12 * 60 && startH >= 12) {
       closeTotalMins += 24 * 60;
    }

    return endTotalMins > closeTotalMins;
  };

  const isExceedingCloseTime = checkExceedsCloseTime();
  const availableVehicles = userVehicles.filter(v => !activePlates.includes(v.plate));
  
  // ==========================================
  // LOCAL DATA CACHE / OVERRIDE LOGIC
  // ==========================================
  const isWalkInOnly = 
    slot?.label === "C1" || 
    slot?.is_reservable === false || 
    String(slot?.is_reservable) === "false";
  // ==========================================

  const isBlocked = activeReservation !== null || availableVehicles.length === 0 || isWalkInOnly;

  const handleProceed = () => {
    if (isWalkInOnly) return alert("Ang slot na ito ay para sa mga walk-in customers lamang.");
    if (isBlocked) return alert("Hindi ka pwedeng mag-proceed dahil may active booking ka pa.");
    if (isExceedingCloseTime) return alert("Exceeds operating hours.");
    if (isTooAdvance) return alert("Advance booking cannot exceed 3 hours.");
    if (!plateNumber || !startTime || !date || !timeIsValid) return;
    
    const now = new Date();
    const [selH, selM] = startTime.split(":").map(Number);
    const selectedDateTime = new Date(date);
    selectedDateTime.setHours(selH, selM, 0, 0);

    const diffMins = (selectedDateTime.getTime() - now.getTime()) / 60000;
    const initialSlotStatus = diffMins > 30 ? "reserved" : "occupied"; 

    const [endH] = endTime24.split(":").map(Number);
    const isNextDay = endH < selH ? "true" : "false";
    const formattedDate = format(date, "yyyy-MM-dd");
    
    navigate(`/reserve/${slotId}/confirm?lot=${lotId}&date=${formattedDate}&start=${format12Hour(startTime)}&end=${format12Hour(endTime24)}&dur=${duration}&plate=${plateNumber}&pay=${paymentMethod}&total=${totalCost}&advanceFee=${advanceFee}&extendedFee=${extendedFee}&status=${initialSlotStatus}&nextDay=${isNextDay}&start24=${startTime}&end24=${endTime24}`);
  };

  if (loading) return <div className="p-20 text-center font-bold text-primary animate-pulse">Loading...</div>;

  return (
    <MobileLayout title="Reserve Slot" showBack onBack={() => window.history.back()}>
      <div className="page-enter p-4 space-y-4 pb-24">
        
        {availableVehicles.length === 0 && !activeReservation && !isWalkInOnly && (
          <div className="bg-red-500 text-white p-5 rounded-3xl shadow-lg border-2 border-red-400 flex flex-col justify-center animate-in slide-in-from-top duration-500">
            <p className="text-[10px] font-bold uppercase opacity-90 flex items-center gap-1 mb-1">
              <AlertCircle size={12}/> Action Not Allowed
            </p>
            <h3 className="font-black text-lg leading-tight">
              {userVehicles.length === 0 ? "No Registered Vehicles" : "All vehicles are currently booked"}
            </h3>
            <p className="text-xs opacity-90 mt-1">
              {userVehicles.length === 0 
                ? "Please register a vehicle in your profile first." 
                : "Wait for your current reservations to end before booking again."}
            </p>
            {userActiveBooking && (
              <Button 
                onClick={() => navigate(`/ticket/${userActiveBooking.id}`)}
                className="bg-white text-red-600 hover:bg-red-50 font-black rounded-xl text-xs h-10 px-4 mt-3 self-start"
              >
                View My Current Ticket
              </Button>
            )}
          </div>
        )}

        {!userActiveBooking && activeReservation && !isWalkInOnly && (
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

        {/* WALK-IN ONLY WARNING */}
        {isWalkInOnly && (
          <div className="bg-gray-500 text-white p-5 rounded-3xl shadow-lg border-2 border-gray-400 flex flex-col justify-center animate-in slide-in-from-top duration-500">
            <p className="text-[10px] font-bold uppercase opacity-90 flex items-center gap-1 mb-1">
              <AlertCircle size={12}/> Walk-in Only
            </p>
            <h3 className="font-black text-lg leading-tight">
              Hindi pwedeng i-reserve ang slot na ito.
            </h3>
            <p className="text-xs opacity-90 mt-1">
              Ang pwestong ito ay nakalaan lamang para sa mga walk-in customers. Mangyari po na bumalik sa map at pumili ng green (Available) slot.
            </p>
            <Button 
              onClick={() => window.history.back()}
              className="bg-white text-gray-800 hover:bg-gray-100 font-black rounded-xl text-xs h-10 px-4 mt-3 self-start"
            >
              Pumili ng ibang Slot
            </Button>
          </div>
        )}

        {/* SLOT INFO CARD */}
        <div className={cn("text-white rounded-3xl p-6 shadow-lg transition-colors", isBlocked ? "bg-gray-400" : "bg-[oklch(0.22_0.07_255)]")}>
          <div className="flex justify-between items-start">
            <div>
              <p className="opacity-70 text-[10px] font-bold uppercase tracking-widest">{lot?.name}</p>
              <h2 className="text-3xl font-black mt-1">Slot {slot?.label}</h2>
              <p className="text-[10px] opacity-80 mt-1 flex items-center gap-1"><Clock size={10}/> {lot?.open_hours}</p>
            </div>
            <div className="text-right flex flex-col items-end">
              <p className="text-[10px] font-bold opacity-80 uppercase">Base (3 hrs): ₱{baseRate}</p>
              {extendedFee > 0 && (
                <p className="text-[10px] font-bold text-orange-200 uppercase">Extra ({duration - 3} hrs): +₱{extendedFee}</p>
              )}
              {advanceFee > 0 && !isTooAdvance && (
                <p className="text-[10px] font-bold text-yellow-300 uppercase">Holding Fee: +₱{advanceFee}</p>
              )}
              <div className="mt-1 border-t border-white/20 pt-1 w-full text-right">
                <p className="text-[10px] font-bold opacity-70 uppercase">Total</p>
                <p className="text-xl font-black">₱{isTooAdvance || isWalkInOnly ? "--" : totalCost}</p>
              </div>
            </div>
          </div>
        </div>

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

        <div className={cn("bg-white rounded-2xl p-4 border shadow-sm", isBlocked ? "opacity-50 pointer-events-none" : "border-gray-100")}>
          <label className="text-[10px] font-black uppercase text-muted-foreground mb-2 block tracking-widest">Select Vehicle</label>
          <div className="relative">
            <select 
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              disabled={isBlocked}
              className="flex h-12 w-full rounded-xl border border-gray-200 bg-transparent px-3 py-1 text-sm font-bold shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary appearance-none cursor-pointer"            
            >
              <option value="" disabled>-- Choose a vehicle model and plate number --</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.plate}>
                  {v.plate} ({v.model})
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <ChevronRight size={20} className="text-gray-400 rotate-90" />
            </div>
          </div>
        </div>

        <div className={cn("grid grid-cols-2 gap-3", isBlocked ? "opacity-50 pointer-events-none" : "")}>
          <div className={cn("bg-white rounded-2xl p-4 border shadow-sm relative flex flex-col justify-center", (isTooAdvance || !timeIsValid) ? "border-red-300 bg-red-50" : "border-gray-100")}>
            <label className="text-[10px] font-black uppercase text-muted-foreground mb-1 block">Arrival Time</label>
            <input 
              type="time" 
              value={startTime} 
              onChange={(e) => setStartTime(e.target.value)}
              className={cn(
                "w-full bg-transparent font-black text-lg outline-none cursor-pointer",
                (!timeIsValid || isTooAdvance) && "text-red-600"
              )}
              required
              disabled={isBlocked}
            />
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

        {/* ERROR MESSAGES */}
        {!timeIsValid && (
          <div className="text-red-500 text-xs font-bold text-center animate-in fade-in">
            Cannot book a time in the past.
          </div>
        )}

        {isTooAdvance && (
          <div className="bg-red-50 text-red-700 p-4 rounded-2xl border border-red-200 flex items-start gap-3 animate-in slide-in-from-top duration-300">
            <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-black uppercase tracking-wider mb-0.5">Booking Too Advance</p>
              <p className="text-xs opacity-90">
                You can only book a slot up to <b>3 hours in advance</b> from the current time. Please select a closer arrival time.
              </p>
            </div>
          </div>
        )}

        {isExceedingCloseTime && (
          <div className="bg-orange-50 text-orange-700 p-4 rounded-2xl border border-orange-200 flex items-start gap-3 animate-in slide-in-from-top duration-300">
            <AlertCircle size={20} className="mt-0.5 shrink-0 text-orange-500" />
            <div>
              <p className="text-sm font-black uppercase tracking-wider mb-0.5">Exceeds Closing Time</p>
              <p className="text-xs opacity-90">
                You are exceeding the time limit. This lot closes at <b>{format12Hour(getLotClosingTime24(lot?.open_hours))}</b>.
              </p>
            </div>
          </div>
        )}

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
          disabled={isBlocked || !plateNumber || !startTime || !timeIsValid || isExceedingCloseTime || isTooAdvance} 
          className={cn(
            "w-full h-16 rounded-2xl text-lg font-black shadow-xl transition-all",
            isBlocked || !plateNumber || !startTime || !timeIsValid || isExceedingCloseTime || isTooAdvance
              ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
              : "bg-[oklch(0.22_0.07_255)] text-white" 
          )}
        >
          {isWalkInOnly
            ? "Walk-in Only Slot"
            : isBlocked 
              ? "Action Not Allowed" 
              : !timeIsValid 
                ? "Invalid Arrival Time" 
                : isTooAdvance
                  ? "Exceeds 3 Hours Limit"
                : isExceedingCloseTime
                  ? "Exceeds Closing Time"
                : !plateNumber
                  ? "Select a Vehicle"
                  : `Pay ₱${totalCost} to Reserve`}
        </Button>
      </div>
    </MobileLayout>
  );
}