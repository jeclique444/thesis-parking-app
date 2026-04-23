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

// Helper: Convert time string (HH:MM) to minutes since midnight
const timeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

// Helper: Get remaining minutes until closing time (supports next-day closing)
const getRemainingMinutesUntilClose = (openHours: string): number => {
  if (!openHours || openHours.toLowerCase().includes("24 hours")) return 24 * 60;

  const parts = openHours.split("-");
  if (parts.length !== 2) return 0;

  // Parse start time
  let startStr = parts[0].trim().toUpperCase();
  let startIsPM = startStr.includes("PM");
  let startIsAM = startStr.includes("AM");
  let startTimePart = startStr.replace("PM", "").replace("AM", "").trim();
  let [startH, startM] = startTimePart.split(":").map(Number);
  if (isNaN(startH)) return 0;
  if (isNaN(startM)) startM = 0;
  if (startIsPM && startH !== 12) startH += 12;
  if (startIsAM && startH === 12) startH = 0;
  const startMinutes = startH * 60 + startM;

  // Parse end time
  let endStr = parts[1].trim().toUpperCase();
  let endIsPM = endStr.includes("PM");
  let endIsAM = endStr.includes("AM");
  let endTimePart = endStr.replace("PM", "").replace("AM", "").trim();
  let [endH, endM] = endTimePart.split(":").map(Number);
  if (isNaN(endH)) return 0;
  if (isNaN(endM)) endM = 0;
  if (endIsPM && endH !== 12) endH += 12;
  if (endIsAM && endH === 12) endH = 0;
  let endMinutes = endH * 60 + endM;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Check if closing time is on the next day
  const isNextDay = endMinutes < startMinutes;
  if (isNextDay) {
    // If current time is before start time (e.g., 5 AM before 7 AM), parking is not yet open
    if (currentMinutes < startMinutes) {
      // Return remaining minutes until opening? Actually we want remaining until close, but parking not open yet.
      // For our usage, if parking is not open, remaining should be 0 (closed) or maybe time until open? But better to return 0.
      return 0;
    }
    // Current time is after start time, so we are in the open period that extends past midnight
    // The closing time is tomorrow at endMinutes
    const endTomorrow = endMinutes + 24 * 60;
    return endTomorrow - currentMinutes;
  } else {
    // Normal day (end > start)
    if (currentMinutes < startMinutes) return 0;
    if (currentMinutes >= endMinutes) return 0;
    return endMinutes - currentMinutes;
  }
};

// Helper: Get maximum allowed duration based on remaining hours (capped at 6 hours)
const getMaxDuration = (openHours: string): number => {
  if (!openHours || openHours.toLowerCase().includes("24 hours")) return 6;
  
  const remainingMins = getRemainingMinutesUntilClose(openHours);
  const remainingHours = Math.floor(remainingMins / 60);
  const MAX_DURATION = 6;
  
  // Saka lang hindi na tatanggap kapag 1 hr (60 mins) o pababa na lang ang remaining
  if (remainingMins <= 60) return 0;
  
  // Minus 1 hour para may allowance at hindi mag-spill over sa closing time
  return Math.min(remainingHours - 1, MAX_DURATION);
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
    if (duration > maxDuration && maxDuration > 0) {
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
  
  // Check if selected duration exceeds closing time (supports next-day)
  const checkExceedsCloseTime = () => {
    if (!lot?.open_hours || lot.open_hours.toLowerCase().includes("24 hours")) return false;
    
    const remaining = getRemainingMinutesUntilClose(lot.open_hours);
    // If remaining time is less than selected duration (in minutes), it exceeds
    return remaining < duration * 60;
  };

  const isExceedingCloseTime = checkExceedsCloseTime();
  const availableVehicles = userVehicles.filter(v => !activePlates.includes(v.plate));
  const isParkingClosed = remainingMins <= 0;
  
  // Check kung 1 hour or less na lang bago mag-close
  const isBookingCutoff = remainingMins > 0 && remainingMins <= 60;

  const isWalkInOnly = 
    slot?.label === "C1" || 
    slot?.is_reservable === false || 
    String(slot?.is_reservable) === "false" ||
    !isVerified;

  // I-update ang isBlocked para isama ang isBookingCutoff
  const isBlocked = 
    activeReservation !== null || 
    availableVehicles.length === 0 || 
    isWalkInOnly ||
    !isVerified ||
    isParkingClosed ||
    isBookingCutoff ||
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

    // ADD THIS: Validation para sa cutoff
    if (isBookingCutoff) {
      return alert("Hindi na tumatanggap ng reservations 1 hour bago mag-close.");
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

        {/* ========== BOOKING CUTOFF NOTICE ========== */}
        {isBookingCutoff && !isParkingClosed && (
          <div className="bg-orange-500 text-white p-5 rounded-2xl shadow-lg border-2 border-orange-400">
            <p className="text-[10px] font-bold uppercase opacity-90 flex items-center gap-1 mb-1">
              <AlertCircle size={12}/> Booking Cutoff
            </p>
            <h3 className="font-black text-lg leading-tight">Closing Soon</h3>
            <p className="text-xs opacity-90 mt-1">
              ZAM Parking no longer accept online reservations within one hour of closing time. Thank You!
            </p>
            <Button 
              onClick={() => window.history.back()}
              className="bg-white text-orange-600 hover:bg-orange-50 font-black rounded-xl text-xs h-10 px-4 mt-3"
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
                <p className="text-xl font-black">₱{isParkingClosed || isWalkInOnly || isBookingCutoff ? "--" : totalCost}</p>
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
          disabled={!isVerified || isBlocked || !plateNumber || isExceedingCloseTime || isParkingClosed || isBookingCutoff} 
          className={cn(
            "w-full h-14 rounded-xl text-base font-black shadow-lg transition-all",
            !isVerified || isBlocked || !plateNumber || isExceedingCloseTime || isParkingClosed || isBookingCutoff
              ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
              : "bg-[oklch(0.22_0.07_255)] text-white hover:bg-[oklch(0.25_0.07_255)] active:scale-[0.98]"
          )}
        >
          {!isVerified ? (
            "Verify Account to Park"
          ) : isParkingClosed ? (
            "Parking Currently Closed"
          ) : isBookingCutoff ? (
            "Booking Cutoff Reached"
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