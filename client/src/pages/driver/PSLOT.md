/*
 * iParkBayan — ReservationPage (With Verification Check + Park Now Logic)
 * Unverified users: Walk-in only, view map, navigate, save favorites
 * Verified users: Full reservation capabilities with online payment
 * "Park Now" system: Start time is always current time when booking
 * Duration limit: Based on remaining operating hours (max 6 hrs)
 * UI: Clean, modern card-based layout
 */
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { ChevronRight, Check, Clock, Ticket, AlertCircle, Accessibility, Shield, Play, Timer, Car, Calendar, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "../../supabaseClient";
import { useVerification } from "@/hooks/useVerification";

// Helper function para makuha ang Closing Time (24h format)
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

// Helper: Get remaining minutes until closing time
const getRemainingMinutesUntilClose = (openHours: string): number => {
  if (!openHours || openHours.toLowerCase().includes("24 hours")) return 24 * 60;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTotalMins = currentHour * 60 + currentMinute;
  
  const closeTime24 = getLotClosingTime24(openHours);
  const [closeH, closeM] = closeTime24.split(":").map(Number);
  let closeTotalMins = closeH * 60 + closeM;
  
  if (closeTotalMins <= currentTotalMins) {
    return 0;
  }
  
  return closeTotalMins - currentTotalMins;
};

// Helper: Get maximum allowed duration based on remaining hours (capped at 6 hours)
const getMaxDuration = (openHours: string): number => {
  const remainingMins = getRemainingMinutesUntilClose(openHours);
  const remainingHours = Math.floor(remainingMins / 60);
  const MAX_DURATION = 6;
  
  return Math.min(remainingHours, MAX_DURATION);
};

// Helper: Format minutes to readable time
const formatMinutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
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
  const [userId, setUserId] = useState<string | null>(null);
  
  // ACTIVE RESERVATION STATES
  const [activeReservation, setActiveReservation] = useState<any>(null); 
  const [userActiveBooking, setUserActiveBooking] = useState<any>(null); 

  // USER INPUTS
  const [plateNumber, setPlateNumber] = useState("");
  const [duration, setDuration] = useState(3);
  const [paymentMethod, setPaymentMethod] = useState<"gcash" | "maya">("gcash");

  // USER VEHICLES STATES
  const [userVehicles, setUserVehicles] = useState<any[]>([]);
  const [activePlates, setActivePlates] = useState<string[]>([]);
  
  // VERIFICATION HOOK
  const { isVerified, verificationStatus, isLoading: verificationLoading } = useVerification();

  // PARK NOW LOGIC: Start time is ALWAYS current time
  const getCurrentTime24 = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const startTime = getCurrentTime24();
  const maxDuration = lot ? getMaxDuration(lot.open_hours) : 6;
  const remainingMins = lot ? getRemainingMinutesUntilClose(lot.open_hours) : 360;

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
          .in("status", ["active", "booked", "reserved"])
          .eq("slot_id", slotId)
          .limit(1); 
        
        if (slotResData && slotResData.length > 0) {
          setActiveReservation(slotResData[0]);
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const { data: vehiclesData } = await supabase
            .from("vehicles")
            .select("*")
            .eq("user_id", user.id);
          setUserVehicles(vehiclesData || []);

          const { data: activeResData } = await supabase
            .from("reservations")
            .select("*")
            .in("status", ["active", "booked", "reserved"])
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

  useEffect(() => {
    if (duration > maxDuration) {
      setDuration(maxDuration);
    }
  }, [maxDuration, duration]);

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

  const endTime24 = calculateEndTime24(startTime, duration);
  const startTimeFormatted = format12Hour(startTime);
  const endTimeFormatted = format12Hour(endTime24);

  const calculateAdvanceFee = () => 0;
  const advanceFee = calculateAdvanceFee();
  const baseRate = 30; 
  const extendedFee = duration > 3 ? (duration - 3) * 10 : 0; 
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
  const isParkingClosed = remainingMins <= 0;
  
  const isWalkInOnly = 
    slot?.label === "C1" || 
    slot?.is_reservable === false || 
    String(slot?.is_reservable) === "false" ||
    !isVerified;

  const isBlocked = 
    activeReservation !== null || 
    availableVehicles.length === 0 || 
    isWalkInOnly ||
    !isVerified ||
    isParkingClosed ||
    isExceedingCloseTime;

  const isMyBooking = activeReservation?.user_id === userId;

  const handleProceed = () => {
    if (!isVerified) {
      navigate('/driver/verification');
      return;
    }

    if (isParkingClosed) {
      return alert("Parking lot is currently closed. Please check operating hours.");
    }

    if (isWalkInOnly) {
      const msg = (slot?.is_pwd === true || String(slot?.is_pwd) === "true")
        ? "Ang PWD slot ay para sa walk-in lamang."
        : "Ang slot na ito ay para sa mga walk-in customers lamang.";
      return alert(msg);
    }
    if (isBlocked) return alert("Hindi ka pwedeng mag-proceed dahil may active booking ka pa.");
    if (isExceedingCloseTime) return alert("Exceeds operating hours.");
    if (!plateNumber) return;
    
    const initialSlotStatus = "active"; 
    const [endH] = endTime24.split(":").map(Number);
    const [selH] = startTime.split(":").map(Number);
    const isNextDay = endH < selH ? "true" : "false";
    const formattedDate = new Date().toISOString().split('T')[0];
    
    navigate(`/reserve/${slotId}/confirm?lot=${lotId}&date=${formattedDate}&start=${startTimeFormatted}&end=${endTimeFormatted}&dur=${duration}&plate=${plateNumber}&pay=${paymentMethod}&total=${totalCost}&advanceFee=${advanceFee}&extendedFee=${extendedFee}&status=${initialSlotStatus}&nextDay=${isNextDay}&start24=${startTime}&end24=${endTime24}`);
  };

  if (loading || verificationLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[oklch(0.22_0.07_255)] mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Loading reservation details...</p>
        </div>
      </div>
    );
  }

  const durationOptions = [1, 2, 3, 4, 5, 6].filter(h => h <= maxDuration);

  return (
    <MobileLayout title="Reservation" showBack onBack={() => navigate(`/parking/${lotId}`)}>
      <div className="page-enter p-4 space-y-3 pb-24 bg-gray-50">
        
        {/* ========== UNVERIFIED USER NOTICE ========== */}
        {!isVerified && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-4 shadow-md">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-black text-blue-900 text-base">Unverified Account</h3>
                <p className="text-xs text-blue-700">Walk-in access only • Verify to unlock full features</p>
              </div>
            </div>
            
            <div className="bg-white/60 rounded-xl p-3 mb-4">
              <p className="text-[10px] font-bold uppercase text-blue-800 mb-2">Available for you:</p>
              <div className="space-y-2">
                {["View availability", "Navigate to location", "Check rates & hours"].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={() => navigate('/driver/verification')}
              className="w-full h-12 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              <Shield className="w-4 h-4 mr-2" />
              Verify Now (2 mins)
            </Button>
            
            <p className="text-[9px] text-center text-blue-600 mt-3">
              Verification unlocks: Online reservations • GCash/Maya • Multiple vehicles
            </p>
          </div>
        )}

        {/* ========== VERIFIED BADGE ========== */}
        {isVerified && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 flex items-center gap-2">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-bold text-green-800">Verified Account • Full Access</span>
          </div>
        )}

        {/* ========== PARKING CLOSED NOTICE ========== */}
        {isParkingClosed && (
          <div className="bg-red-500 text-white p-5 rounded-2xl shadow-lg border-2 border-red-400">
            <p className="text-[10px] font-bold uppercase opacity-90 flex items-center gap-1 mb-1">
              <AlertCircle size={12}/> Parking Closed
            </p>
            <h3 className="font-black text-lg leading-tight">Outside Operating Hours</h3>
            <p className="text-xs opacity-90 mt-1">Operating hours: {lot?.open_hours}</p>
            <Button 
              onClick={() => window.history.back()}
              className="bg-white text-red-600 hover:bg-red-50 font-black rounded-xl text-xs h-10 px-4 mt-3"
            >
              Go Back
            </Button>
          </div>
        )}

        {/* ========== NO VEHICLES WARNING ========== */}
        {availableVehicles.length === 0 && !activeReservation && !isWalkInOnly && isVerified && (
          <div className="bg-red-500 text-white p-5 rounded-2xl shadow-lg border-2 border-red-400">
            <p className="text-[10px] font-bold uppercase opacity-90 flex items-center gap-1 mb-1">
              <AlertCircle size={12}/> Action Not Allowed
            </p>
            <h3 className="font-black text-lg leading-tight">
              {userVehicles.length === 0 ? "No Registered Vehicles" : "All vehicles are currently booked"}
            </h3>
            <p className="text-xs opacity-90 mt-1 mb-2">
              {userVehicles.length === 0 
                ? "Please register a vehicle in your profile first." 
                : "Wait for your current reservations to end before booking again."}
            </p>
            {userActiveBooking && (
              <Button 
                onClick={() => navigate(`/receipt/${userActiveBooking.id}?from=reservations`)}
                className="bg-white text-red-600 hover:bg-red-50 font-black rounded-xl text-xs h-10 px-4"
              >
                View My Current Ticket
              </Button>
            )}
          </div>
        )}

        {/* ========== ACTIVE RESERVATION ========== */}
        {activeReservation && !isWalkInOnly && (
          <div className={cn(
            "text-white p-5 rounded-2xl shadow-lg border-2 flex justify-between items-center",
            isMyBooking ? "bg-blue-500 border-blue-400" : "bg-emerald-500 border-emerald-400"
          )}>
            <div>
              <p className="text-[10px] font-bold uppercase opacity-90 flex items-center gap-1">
                <Ticket size={10}/> {isMyBooking ? "Your Active Booking" : "Slot Currently Taken"}
              </p>
              <h3 className="font-black text-lg leading-tight">Slot {slot?.label}</h3>
              <p className="text-[10px] font-bold">Plate: {activeReservation.plate_number}</p>
            </div>
            
            {isMyBooking ? (
              <Button 
                onClick={() => navigate(`/receipt/${activeReservation.id}?from=reservations`)}
                className="bg-white text-blue-600 hover:bg-blue-50 font-black rounded-xl text-xs h-10 px-4"
              >
                View Ticket
              </Button>
            ) : (
              <Button disabled className="bg-white/50 text-white font-black rounded-xl text-xs h-10 px-4 cursor-not-allowed">
                Unavailable
              </Button>
            )}
          </div>
        )}

        {/* ========== WALK-IN ONLY NOTICE ========== */}
        {isWalkInOnly && (slot?.label === "C1" || slot?.is_reservable === false) && (
          <div className={cn(
            "text-white p-5 rounded-2xl shadow-lg border-2",
            (slot?.is_pwd === true || String(slot?.is_pwd) === "true") ? "bg-blue-600 border-blue-400" : "bg-gray-500 border-gray-400"
          )}>
            <p className="text-[10px] font-bold uppercase opacity-90 flex items-center gap-1 mb-1">
              {(slot?.is_pwd === true || String(slot?.is_pwd) === "true") ? <Accessibility size={12}/> : <AlertCircle size={12}/>} 
              Walk-in Only
            </p>
            <h3 className="font-black text-lg leading-tight">
              {(slot?.is_pwd === true || String(slot?.is_pwd) === "true") 
                ? "PWD Reserved (Walk-in Only)" 
                : "Hindi pwedeng i-reserve ang slot na ito."}
            </h3>
            <p className="text-xs opacity-90 mt-1">
              {(slot?.is_pwd === true || String(slot?.is_pwd) === "true")
                ? "Ang slot na ito ay nakalaan para sa mga PWD walk-in customers lamang."
                : "Ang pwestong ito ay nakalaan lamang para sa mga walk-in customers."}
            </p>
            <Button 
              onClick={() => window.history.back()}
              className="bg-white text-gray-800 hover:bg-gray-100 font-black rounded-xl text-xs h-10 px-4 mt-3"
            >
              Pumili ng ibang Slot
            </Button>
          </div>
        )}

        {/* ========== SLOT INFO CARD ========== */}
        <div className={cn(
          "text-white rounded-2xl p-5 shadow-lg transition-colors",
          isBlocked && isVerified ? "bg-gray-400" : "bg-gradient-to-br from-[oklch(0.22_0.07_255)] to-[oklch(0.28_0.07_255)]"
        )}>
          <div className="flex justify-between items-start">
            <div>
              <p className="opacity-70 text-[10px] font-bold uppercase tracking-widest">{lot?.name}</p>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black mt-0.5">Slot {slot?.label}</h2>
                {(slot?.is_pwd === true || String(slot?.is_pwd) === "true") && (
                   <Accessibility size={20} className="opacity-80" />
                )}
              </div>
              <p className="text-[10px] opacity-80 mt-1 flex items-center gap-1">
                <Clock size={10}/> {lot?.open_hours}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold opacity-70 uppercase">Base (3h)</p>
              <p className="text-sm font-bold">₱{baseRate}</p>
              {extendedFee > 0 && (
                <>
                  <p className="text-[10px] font-bold text-orange-200 uppercase mt-1">Extra</p>
                  <p className="text-sm font-bold text-orange-200">+₱{extendedFee}</p>
                </>
              )}
              <div className="mt-2 border-t border-white/20 pt-2">
                <p className="text-[10px] font-bold opacity-70 uppercase">Total</p>
                <p className="text-xl font-black">₱{isParkingClosed || isWalkInOnly ? "--" : totalCost}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ========== REMAINING TIME INFO ========== */}
        {isVerified && !isParkingClosed && (
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-blue-800">
                Remaining: {formatMinutesToTime(remainingMins)}
              </span>
            </div>
            <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
              Max {maxDuration}h
            </span>
          </div>
        )}

        {/* ========== VEHICLE & DURATION (Side by Side) ========== */}
        <div className={cn(
          "grid grid-cols-2 gap-3",
          (isBlocked || !isVerified) ? "opacity-50 pointer-events-none" : ""
        )}>
          {/* Select Vehicle */}
          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <label className="text-[10px] font-black uppercase text-gray-500 mb-1.5 flex items-center gap-1">
              <Car className="w-3 h-3" />
              Vehicle
            </label>
            <div className="relative">
              <select 
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                disabled={isBlocked || !isVerified}
                className="w-full bg-transparent text-sm font-bold outline-none cursor-pointer appearance-none pr-5 truncate"
              >
                <option value="" disabled>Select vehicle</option>
                {availableVehicles.map((v) => (
                  <option key={v.id} value={v.plate}>
                    {v.plate}
                  </option>
                ))}
              </select>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronRight size={14} className="text-gray-400 rotate-90" />
              </div>
            </div>
            {plateNumber && (
              <p className="text-[9px] text-gray-400 mt-1 truncate">
                {availableVehicles.find(v => v.plate === plateNumber)?.model || ""}
              </p>
            )}
          </div>

          {/* Duration */}
          <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
            <label className="text-[10px] font-black uppercase text-gray-500 mb-1.5 flex items-center gap-1">
              <Timer className="w-3 h-3" />
              Duration
            </label>
            <div className="relative">
              <select 
                value={duration} 
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-transparent text-sm font-bold outline-none cursor-pointer appearance-none pr-5"
                disabled={isBlocked || !isVerified}
              >
                {durationOptions.map(h => (
                  <option key={h} value={h}>{h} Hour{h>1?'s':''}</option>
                ))}
              </select>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronRight size={14} className="text-gray-400 rotate-90" />
              </div>
            </div>
          </div>
        </div>

        {/* ========== TIME RANGE (Single Row) ========== */}
        <div className={cn(
          "bg-white rounded-xl p-4 border border-gray-200 shadow-sm",
          (isBlocked || !isVerified) ? "opacity-50 pointer-events-none" : ""
        )}>
          <label className="text-[10px] font-black uppercase text-gray-500 mb-2 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Parking Time
          </label>
          
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div className="text-center flex-1">
              <p className="text-[9px] font-bold uppercase text-gray-400 mb-0.5">Start</p>
              <p className="text-lg font-black text-green-700">{startTimeFormatted}</p>
              <p className="text-[8px] text-green-600 flex items-center justify-center gap-0.5 mt-0.5">
                <Play className="w-2 h-2" /> Book Now
              </p>
            </div>
            
            <div className="px-4">
              <div className="w-8 h-0.5 bg-gray-300 rounded-full"></div>
            </div>
            
            <div className="text-center flex-1">
              <p className="text-[9px] font-bold uppercase text-gray-400 mb-0.5">End</p>
              <p className="text-lg font-black text-gray-800">{endTimeFormatted}</p>
              <p className="text-[8px] text-gray-400 mt-0.5">Estimated</p>
            </div>
          </div>
          
          <p className="text-[9px] text-gray-400 text-center mt-2">
            Reservation starts immediately after payment
          </p>
        </div>

        {/* ========== EXCEEDS CLOSING TIME ERROR ========== */}
        {isExceedingCloseTime && isVerified && (
          <div className="bg-orange-50 text-orange-700 p-3 rounded-xl border border-orange-200 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 text-orange-500 mt-0.5" />
            <div>
              <p className="text-xs font-black uppercase">Exceeds Closing Time</p>
              <p className="text-[10px] opacity-90">
                This lot closes at <b>{format12Hour(getLotClosingTime24(lot?.open_hours))}</b>
              </p>
            </div>
          </div>
        )}

        {/* ========== PAYMENT METHOD ========== */}
        {isVerified && (
          <div className={cn(
            "bg-white rounded-xl p-4 border border-gray-200 shadow-sm",
            isBlocked ? "opacity-50 pointer-events-none" : ""
          )}>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-3 flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setPaymentMethod("gcash")} 
                className={cn(
                  "h-14 rounded-xl border-2 flex items-center justify-center gap-2 transition-all",
                  paymentMethod === "gcash" 
                    ? "border-blue-500 bg-blue-50" 
                    : "border-gray-200 bg-white"
                )}
              >
                <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-xs">G</span>
                </div>
                <span className="font-bold text-blue-600">GCash</span>
                {paymentMethod === "gcash" && <Check size={14} className="text-blue-600" />}
              </button>
              <button 
                onClick={() => setPaymentMethod("maya")} 
                className={cn(
                  "h-14 rounded-xl border-2 flex items-center justify-center gap-2 transition-all",
                  paymentMethod === "maya" 
                    ? "border-emerald-500 bg-emerald-50" 
                    : "border-gray-200 bg-white"
                )}
              >
                <div className="w-6 h-6 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-xs">M</span>
                </div>
                <span className="font-bold text-emerald-600">Maya</span>
                {paymentMethod === "maya" && <Check size={14} className="text-emerald-600" />}
              </button>
            </div>
          </div>
        )}

        {/* ========== GRACE PERIOD POLICY ========== */}
        {isVerified && (
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
            <p className="text-[10px] font-bold uppercase text-amber-800 mb-1">⏰ Grace Period Policy</p>
            <p className="text-xs text-amber-700">
              You have <b>1 hour</b> to arrive after booking. If you don't check in, 
              your reservation will be cancelled and the slot released.
              <span className="block mt-1 text-red-600 font-bold">No refunds for no-shows.</span>
            </p>
          </div>
        )}

        {/* ========== ACTION BUTTON ========== */}
        <Button 
          onClick={handleProceed} 
          disabled={!isVerified || isBlocked || !plateNumber || isExceedingCloseTime || isParkingClosed} 
          className={cn(
            "w-full h-14 rounded-xl text-base font-black shadow-lg transition-all",
            !isVerified || isBlocked || !plateNumber || isExceedingCloseTime || isParkingClosed
              ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
              : "bg-[oklch(0.22_0.07_255)] text-white hover:bg-[oklch(0.25_0.07_255)] active:scale-[0.98]"
          )}
        >
          {!isVerified ? (
            "Verify Account to Park"
          ) : isParkingClosed ? (
            "Parking Currently Closed"
          ) : isWalkInOnly ? (
            (slot?.is_pwd === true || String(slot?.is_pwd) === "true") ? "PWD Walk-in Only" : "Walk-in Only Slot"
          ) : isBlocked ? 
            "Action Not Allowed" : 
            isExceedingCloseTime ?
              "Exceeds Closing Time" :
              !plateNumber ?
                "Select a Vehicle" :
                `Pay ₱${totalCost} to Reserve Now`
          }
        </Button>

        {/* ========== CASH NOTE FOR UNVERIFIED ========== */}
        {!isVerified && (
          <p className="text-center text-[10px] text-gray-400">
            💵 Unverified accounts can pay in cash at the parking location
          </p>
        )}
      </div>
    </MobileLayout>
  );
}




/*
 * ParKada (formerly iParkBayan) — ParkingMapPage
 * Clean Satellite View + Navigation (Waze & GMaps) + Real-time Geolocation + In-App Route Directions + Supabase Real-time
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "../../supabaseClient";
import { MapPin, List, Map, Search, Loader2, Plus, Minus, Layers, Navigation, Route as RouteIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// Leaflet Imports
import { MapContainer, TileLayer, Marker, Tooltip, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// --- HELPER: Distance Calculator (Haversine Formula) ---
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius ng Earth sa kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance sa KM
};

// --- NAVIGATION HELPERS ---

// Helper for Google Maps Navigation (Starts from user's current location)
const openGoogleMaps = (destLat: number, destLng: number, userLat?: number, userLng?: number) => {
  if (userLat && userLng) {
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${destLat},${destLng}&travelmode=driving`, "_blank");
  } else {
    // Fallback if no user location is available
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`, "_blank");
  }
};

// Helper for Waze Navigation (Waze automatically uses current GPS location as starting point)
const openWaze = (lat: number, lng: number) => {
  const url = `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  window.open(url, "_blank");
};

// Custom Zoom Controls Component
function ZoomHandler() {
  const map = useMap();
  return (
    <div className="absolute right-4 top-20 z-[1000] flex flex-col gap-2">
      <button 
        onClick={() => map.setZoom(19)}
        className="w-10 h-10 bg-primary text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform"
      >
        <Layers size={18} />
      </button>
      <button 
        onClick={() => map.zoomIn()}
        className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border border-border"
      >
        <Plus size={20} className="text-primary" />
      </button>
      <button 
        onClick={() => map.zoomOut()}
        className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border border-border"
      >
        <Minus size={20} className="text-primary" />
      </button>
    </div>
  );
}

const createCustomIcon = (availableSlots: number) => {
  const isSomeFree = availableSlots > 0;
  const colorClass = availableSlots > 5 ? 'text-emerald-500' : isSomeFree ? 'text-amber-500' : 'text-rose-500';
  const bgClass = availableSlots > 5 ? 'bg-emerald-500' : isSomeFree ? 'bg-amber-500' : 'bg-rose-500';
  
  return L.divIcon({
    html: `
      <div class="flex flex-col items-center gap-0.5" style="transform: translate(-50%, -100%);">
        <div class="px-2 py-1 rounded-lg text-[10px] font-bold shadow-lg whitespace-nowrap text-white ${bgClass}">
          ${availableSlots > 0 ? `${availableSlots} slots available` : 'Full'}
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5" class="drop-shadow-lg ${colorClass}">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3" fill="white"/>
        </svg>
      </div>`,
    className: 'bg-transparent',
    iconSize: [0, 0], 
  });
};

export default function ParkingMapPage() {
  const [, navigate] = useLocation();
  const [lots, setLots] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"map" | "list">("map");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "private" | "public">("all");

  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);

  const lipaCenter: [number, number] = [13.9430, 121.1625];

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("Location error:", err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [lotsRes, slotsRes] = await Promise.all([
          supabase.from('parking_lots').select('*'),
          supabase.from('parking_slots').select('*')
        ]);
        
        if (lotsRes.error) throw lotsRes.error;
        if (slotsRes.error) throw slotsRes.error;

        setLots(lotsRes.data || []);
        setSlots(slotsRes.data || []);
      } catch (err) {
        console.error("Supabase Error:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();

    const lotsChannel = supabase
      .channel('realtime:parking_lots')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parking_lots' },
        (payload) => {
          setLots((currentLots) => {
            if (payload.eventType === 'INSERT') return [...currentLots, payload.new];
            if (payload.eventType === 'UPDATE') return currentLots.map((lot) => lot.id === payload.new.id ? { ...lot, ...payload.new } : lot);
            if (payload.eventType === 'DELETE') return currentLots.filter((lot) => lot.id !== payload.old.id);
            return currentLots;
          });
        }
      )
      .subscribe();

    const slotsChannel = supabase
      .channel('realtime:parking_slots')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parking_slots' },
        (payload) => {
          setSlots((currentSlots) => {
            if (payload.eventType === 'INSERT') return [...currentSlots, payload.new];
            if (payload.eventType === 'UPDATE') return currentSlots.map((slot) => slot.id === payload.new.id ? payload.new : slot);
            if (payload.eventType === 'DELETE') return currentSlots.filter((slot) => slot.id !== payload.old.id);
            return currentSlots;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(lotsChannel);
      supabase.removeChannel(slotsChannel);
    };
  }, []);

  const handleShowRoute = async (targetLat: number, targetLng: number) => {
    if (!userCoords) {
      alert("Please allow location access to get directions.");
      return;
    }
    setIsFetchingRoute(true);
    setView("map"); 

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${userCoords.lng},${userCoords.lat};${targetLng},${targetLat}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const coordinates = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
        setRouteCoords(coordinates);
      }
    } catch (err) {
      console.error("Error fetching route:", err);
    } finally {
      setIsFetchingRoute(false);
    }
  };

  const computedLots = lots.map(lot => {
    const lotSlots = slots.filter(s => s.lot_id === lot.id);
    if (lotSlots.length > 0) {
      const available = lotSlots.filter(s => s.status === 'available').length;
      return { ...lot, available_slots: available, total_slots: lotSlots.length };
    }
    return lot; 
  });

  const filteredAndSorted = computedLots
    .filter((lot) => {
      const matchSearch = lot.name.toLowerCase().includes(search.toLowerCase()) ||
                          lot.address.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "all" || lot.type === filter;
      return matchSearch && matchFilter;
    })
    .map((lot) => {
      const distance = userCoords && lot.latitude && lot.longitude
        ? getDistance(userCoords.lat, userCoords.lng, lot.latitude, lot.longitude)
        : null;
      return { ...lot, currentDistance: distance };
    })
    .sort((a, b) => {
      if (a.currentDistance === null) return 1;
      if (b.currentDistance === null) return -1;
      return a.currentDistance - b.currentDistance;
    });

  return (
    <MobileLayout title="Find Parking" showBack onBack={() => navigate("/home")} noPadding>
      <div className="flex flex-col h-[calc(100dvh-56px)] bg-slate-50">
        
        {/* --- HEADER --- */}
        <div className="px-4 py-3 bg-white border-b border-border space-y-2 z-20 shadow-sm">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parking in Lipa City..."
              className="pl-9 h-10 rounded-xl bg-muted/40 text-sm border-none"
            />
          </div>
          <div className="flex gap-2 items-center">
            {(["all", "private", "public"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[11px] font-bold transition-all capitalize border",
                  filter === f ? "bg-primary text-white border-primary shadow-sm" : "bg-white text-muted-foreground border-border"
                )}
              >
                {f}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 bg-muted rounded-full p-1">
              <button onClick={() => setView("map")} className={cn("p-1.5 rounded-full transition-all", view === "map" ? "bg-white shadow-sm" : "")}>
                <Map size={14} className={view === "map" ? "text-primary" : "text-muted-foreground"} />
              </button>
              <button onClick={() => setView("list")} className={cn("p-1.5 rounded-full transition-all", view === "list" ? "bg-white shadow-sm" : "")}>
                <List size={14} className={view === "list" ? "text-primary" : "text-muted-foreground"} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-primary" />
            <p className="text-xs font-medium text-muted-foreground">Updating map data...</p>
          </div>
        ) : view === "map" ? (
          <div className="flex-1 relative overflow-hidden bg-slate-900">
            <MapContainer center={lipaCenter} zoom={17} maxZoom={21} zoomControl={false} className="w-full h-full">
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                attribution="&copy; Google Satellite"
                maxZoom={21}
              />
              
              {userCoords && (
                <Marker 
                  position={[userCoords.lat, userCoords.lng]} 
                  icon={L.divIcon({ 
                    html: '<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg ring-4 ring-blue-500/30 animate-pulse"></div>', 
                    className: '' 
                  })} 
                />
              )}

              {routeCoords && (
                <Polyline 
                  positions={routeCoords} 
                  color="#3b82f6" 
                  weight={5} 
                  opacity={0.8}
                  dashArray="10, 10"
                />
              )}

              <ZoomHandler />
              {filteredAndSorted.map((lot) => (
                lot.latitude && lot.longitude ? (
                  <Marker 
                    key={lot.id}
                    position={[lot.latitude, lot.longitude]} 
                    icon={createCustomIcon(lot.available_slots)}
                    eventHandlers={{ click: () => navigate(`/parking/${lot.id}`) }}
                  >
                    <Tooltip permanent direction="bottom" offset={[0, 10]} className="bg-primary border-none shadow-xl text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      {lot.name}
                    </Tooltip>
                  </Marker>
                ) : null
              ))}
            </MapContainer>

            {/* --- BOTTOM SHEET PREVIEW --- */}
            <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md rounded-t-[24px] p-4 shadow-2xl z-[1000]">
              <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 px-1">
                {filteredAndSorted.length} Results
              </p>
              
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {filteredAndSorted.map((lot) => (
                  <div key={lot.id} className="shrink-0 w-72 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm flex flex-col gap-3">
                    <div onClick={() => navigate(`/parking/${lot.id}`)}>
                      <p className="text-xs font-black text-slate-800 truncate mb-1">{lot.name}</p>
                      <div className="flex items-center gap-2">
                         <Badge variant="outline" className="text-[8px] h-4 px-1.5 uppercase font-bold">{lot.type}</Badge>
                         <span className="text-[10px] text-slate-500 font-medium">₱{lot.rate_per_hour}/hr</span>
                         
                         {lot.currentDistance !== null && (
                           <span className="text-[10px] font-black text-primary ml-auto">
                             {lot.currentDistance.toFixed(2)} km
                           </span>
                         )}
                      </div>
                    </div>
                    
                    {/* BUTTONS: Route (App), GMaps, Waze */}
                    <div className="flex gap-1.5">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleShowRoute(lot.latitude, lot.longitude); }}
                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 py-2 rounded-xl text-[9px] font-black flex flex-col items-center justify-center gap-1 transition-colors"
                      >
                        {isFetchingRoute ? <Loader2 size={16} className="animate-spin" /> : <RouteIcon size={16} />}
                        APP ROUTE
                      </button>

                      <button 
                        onClick={() => openGoogleMaps(lot.latitude, lot.longitude, userCoords?.lat, userCoords?.lng)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-[9px] font-black flex flex-col items-center justify-center gap-1 transition-colors"
                      >
                        <Map size={16} fill="none" />
                        GMAPS
                      </button>

                      <button 
                        onClick={() => openWaze(lot.latitude, lot.longitude)}
                        className="flex-1 bg-[#33CCFF] hover:bg-[#2DBBEA] text-white py-2 rounded-xl text-[9px] font-black flex flex-col items-center justify-center gap-1 transition-colors"
                      >
                        <Navigation size={16} fill="currentColor" />
                        WAZE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* --- LIST VIEW --- */
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-10">
            {filteredAndSorted.map((lot) => (
              <div
                key={lot.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4 active:bg-slate-50 transition-colors"
              >
                <div onClick={() => navigate(`/parking/${lot.id}`)} className="flex-1 flex items-center gap-4 min-w-0">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                    lot.available_slots > 5 ? "bg-emerald-50 text-emerald-600" : 
                    lot.available_slots > 0 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                  )}>
                    <MapPin size={24} fill="currentColor" fillOpacity={0.2} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-black text-slate-800 truncate">{lot.name}</p>
                      <Badge variant="secondary" className="text-[8px] h-4 px-1 shadow-none uppercase">{lot.type}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mb-1">{lot.address}</p>
                    
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                        lot.available_slots > 5 ? "bg-emerald-100 text-emerald-700" : 
                        lot.available_slots > 0 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                      )}>
                        {lot.available_slots} / {lot.total_slots} Slots
                      </span>
                      
                      {lot.currentDistance !== null && (
                        <span className="text-[10px] font-bold text-primary ml-auto">
                          {lot.currentDistance.toFixed(2)} km
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* LIST VIEW BUTTONS */}
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleShowRoute(lot.latitude, lot.longitude); }}
                    className="p-2.5 bg-blue-500/10 text-blue-500 rounded-full hover:bg-blue-500 hover:text-white transition-all"
                    title="Draw Route on Map"
                  >
                    <RouteIcon size={16} />
                  </button>

                  <button 
                    onClick={() => openGoogleMaps(lot.latitude, lot.longitude, userCoords?.lat, userCoords?.lng)}
                    className="p-2.5 bg-green-500/10 text-green-500 rounded-full hover:bg-green-500 hover:text-white transition-all"
                    title="Google Maps"
                  >
                    <Map size={16} />
                  </button>

                  <button 
                    onClick={() => openWaze(lot.latitude, lot.longitude)}
                    className="p-2.5 bg-[#33CCFF]/10 text-[#33CCFF] rounded-full hover:bg-[#33CCFF] hover:text-white transition-all"
                    title="Waze"
                  >
                    <Navigation size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}