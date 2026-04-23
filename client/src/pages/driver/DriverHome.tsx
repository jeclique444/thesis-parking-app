/*
 * iParkBayan — DriverHome (With Nearby Suggestion, Live Countdown, Auto-Cleanup & Overnight Fix)
 */
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { MapPin, Clock, ChevronRight, Bell, Search, RefreshCcw, Navigation, AlertCircle, WifiOff, HelpCircle, ArrowUpDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "../../supabaseClient";
import ActiveReservationTimer from "@/components/ActiveReservationTimer"; // 🔥 NEW IMPORT

const MAP_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/iparkbayan-lipa-map-bf9Bjp7jKhLR43sJchAZUD.webp";

// 🔥 HELPER FUNCTIONS (unchanged)
const parseOpenHoursToMins = (timeStr: string) => {
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let [_, h, m, period] = match;
  let hours = parseInt(h, 10);
  const minutes = parseInt(m, 10);
  if (period.toUpperCase() === 'PM' && hours < 12) hours += 12;
  if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const parseTimeWithAnchor = (timeStr: string, anchorDate: Date) => {
  if (!timeStr || timeStr === "-") return new Date(anchorDate);
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  
  const d = new Date(anchorDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
};

// 🔥 HAVERSINE FORMULA (Pang-compute ng distance in km)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

// 🔥 Loading Skeleton Component
function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mx-4 mt-4">
        <div className="h-36 bg-gray-200 rounded-2xl" />
      </div>
      <div className="mx-4 mt-6">
        <div className="h-32 bg-gray-200 rounded-2xl" />
      </div>
      <div className="mx-4 mt-6 grid grid-cols-3 gap-3">
        <div className="h-20 bg-gray-200 rounded-2xl" />
        <div className="h-20 bg-gray-200 rounded-2xl" />
        <div className="h-20 bg-gray-200 rounded-2xl" />
      </div>
      <div className="mx-4 mt-8">
        <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-28 bg-gray-200 rounded-2xl" />
          <div className="h-28 bg-gray-200 rounded-2xl" />
          <div className="h-28 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// 🔥 Offline Indicator Component
function OfflineIndicator() {
  return (
    <div className="mx-4 mt-2 mb-2 bg-red-50 border border-red-200 rounded-xl p-2 flex items-center justify-center gap-2">
      <WifiOff size={14} className="text-red-500" />
      <p className="text-[10px] font-medium text-red-600">You are offline. Some data may be outdated.</p>
    </div>
  );
}

// 🔥 CountdownTimer - retained but no longer used (can be removed later)
function CountdownTimer({ startTime, endTime, createdAt, onExpire }: any) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!endTime || endTime === "-" || !createdAt) {
      setTimeLeft("--:--:--");
      return;
    }

    const calculateTime = () => {
      const now = new Date();
      try {
        const anchorDate = new Date(createdAt);
        let startDateTime = parseTimeWithAnchor(startTime || endTime, anchorDate);
        let target = parseTimeWithAnchor(endTime, anchorDate);

        if (target < startDateTime) target.setDate(target.getDate() + 1);

        const diff = target.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeLeft("00:00:00");
          onExpire(); 
          return;
        }

        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        if (h === 0 && m < 10) setIsUrgent(true); 
        else setIsUrgent(false);

        const display = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        setTimeLeft(display);
      } catch (e) {
        setTimeLeft("--:--:--");
      }
    };

    const timer = setInterval(calculateTime, 1000);
    calculateTime();
    return () => clearInterval(timer);
  }, [startTime, endTime, createdAt, onExpire]);

  return (
    <div className={cn("flex items-center gap-1.5 font-black text-sm tabular-nums", isUrgent ? "text-rose-500 animate-pulse" : "text-amber-400")}>
      <Clock size={14} />
      <span>{timeLeft} left</span>
    </div>
  );
}

function AvailabilityBar({ available, total }: { available: number; total: number }) {
  if (!total || total === 0) return null; 
  const pct = Math.round((available / total) * 100);
  const color = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{available}/{total}</span>
    </div>
  );
}

export default function DriverHome() {
  const [, navigate] = useLocation();
  const [userName, setUserName] = useState<string>("Driver");
  const [dbParkingLots, setDbParkingLots] = useState<any[]>([]); 
  const [dbSlots, setDbSlots] = useState<any[]>([]); 
  const [activeReservation, setActiveReservation] = useState<any>(null);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false); 
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 🔥 Online/Offline state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // 🔥 NEW: Toggle state for sorting mode (false = distance-first, true = recommended)
  const [useRecommendedSort, setUseRecommendedSort] = useState(false);
  
  // 🔥 LBS STATE
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const activeStatuses = ["reserved", "active", "pending", "booked", "Reserved", "Active", "Pending", "Booked"];

  // 🔥 Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      fetchAllData();
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Kuhanin ang location ni User
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log("User denied location or error:", error),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const runCleanup = useCallback(async (userId: string) => {
  try {
    const { data: reservations } = await supabase
      .from("reservations")
      .select("id, slot_id, start_time, end_time, created_at")
      .eq("user_id", userId)
      .in("status", activeStatuses);

    if (!reservations || reservations.length === 0) return;

    const now = new Date();
    for (const res of reservations) {
      if (!res.end_time) continue;

      const endDateTime = new Date(res.end_time);
      const startDateTime = new Date(res.start_time || res.created_at);

      let adjustedEnd = endDateTime;
      if (adjustedEnd < startDateTime) {
        adjustedEnd = new Date(adjustedEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      if (now >= adjustedEnd) {
        await supabase.from("reservations").update({ status: "completed" }).eq("id", res.id);
        await supabase.from("parking_slots").update({ status: "available" }).eq("id", res.slot_id);
      }
    }
  } catch (err) {
    console.error("Cleanup error:", err);
  }
}, []);

  const fetchAllData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (!user) {
        setLoading(false); setIsRefreshing(false); return;
      }

      await runCleanup(user.id);

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      if (profile?.full_name) setUserName(profile.full_name.split(" ")[0]);

      const { data: unreadNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("read", false)
        .limit(1);

      setHasUnreadNotifs(!!(unreadNotif && unreadNotif.length > 0));

      const [lotsRes, slotsRes] = await Promise.all([
        supabase.from("parking_lots").select("*"),
        supabase.from("parking_slots").select("*")
      ]);

      if (lotsRes.data) setDbParkingLots(lotsRes.data);
      if (slotsRes.data) setDbSlots(slotsRes.data);

      if (!isSilent && navigator.vibrate) {
        navigator.vibrate(50);
      }

      // 🔥 UPDATED: Include all needed fields for ActiveReservationTimer
     const { data: resData } = await supabase
  .from("reservations")
  .select(`
    *,
    parking_lots ( id, name, rate_per_hour, extension_rate_per_hour, extension_fee, fine_penalty, overtime_rate, grace_period_minutes, allow_extensions ),
    parking_slots ( label )
  `)
  .eq("user_id", user.id)
  .in("status", activeStatuses)
  .order("created_at", { ascending: false })
  .limit(1);

      if (resData && resData.length > 0) {
        const rawRes = resData[0] as any;
        const lotData = Array.isArray(rawRes.parking_lots) ? rawRes.parking_lots[0] : rawRes.parking_lots;
        const slotData = Array.isArray(rawRes.parking_slots) ? rawRes.parking_slots[0] : rawRes.parking_slots;
        
        setActiveReservation({
          id: rawRes.id,
          user_id: rawRes.user_id,   
          total_amount: rawRes.total_amount,                     // ✅ added
          lotName: lotData?.name || "Parking Lot",
          lot_id: rawRes.lot_id,                         // ✅ added
          hourly_rate: lotData?.rate_per_hour || 30,     // ✅ added
          slotLabel: slotData?.label || "-",
          vehiclePlate: rawRes.plate_number || "N/A",
          start_time: rawRes.start_time,                 // ✅ keep as start_time (not startTime)
          end_time: rawRes.end_time,                     // ✅ keep as end_time
          duration: rawRes.duration || 0,                // ✅ added
          extension_count: rawRes.extension_count || 0,  // ✅ added
          extension_fee: rawRes.extension_fee || 0,      // ✅ added
          fine_amount: rawRes.fine_amount || 0,          // ✅ added
          fine_paid: rawRes.fine_paid || false,          // ✅ added
          status: rawRes.status || "PENDING",
          extension_fee_setting: lotData?.extension_fee || 10,
          fine_penalty: lotData?.fine_penalty || 50,
          overtime_rate: lotData?.overtime_rate || 30,
          grace_period_minutes: lotData?.grace_period_minutes || 15,
          allow_extensions: lotData?.allow_extensions ?? true,
          extension_rate_per_hour: lotData?.extension_rate_per_hour ?? lotData?.rate_per_hour ?? 30,
          createdAt: rawRes.created_at                    // for backwards compatibility
        });
      } else {
        setActiveReservation(null);
      }
    } catch (error) {
      console.error("Dashboard Fetch Error:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [runCleanup]);

  useEffect(() => {
    fetchAllData(); 
    const channel = supabase.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_slots' }, () => fetchAllData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchAllData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchAllData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAllData]);

  const isLotOpen = (openHoursStr?: string) => {
    if (!openHoursStr) return true;
    const hoursText = openHoursStr.toLowerCase();
    if (hoursText.includes("24 hour")) return true;
    const times = openHoursStr.split("-").map((t) => t.trim());
    if (times.length === 2) {
      const startMins = parseOpenHoursToMins(times[0]);
      const endMins = parseOpenHoursToMins(times[1]);
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      if (startMins < endMins) return currentMins >= startMins && currentMins < endMins;
      else return currentMins >= startMins || currentMins < endMins;
    }
    return true;
  };

  // 🔥 LBS SORTING & FILTERING LOGIC (UPDATED: Dynamic sorting based on toggle)
  const getProcessedLots = () => {
    let lotsWithData = dbParkingLots.map(lot => {
      const lotSlots = dbSlots.filter(s => s.lot_id === lot.id);
      const availableCount = lotSlots.filter(s => s.status === 'available').length;
      const totalSlots = lotSlots.length;
      
      let distance = null;
      if (userLocation && lot.latitude && lot.longitude) {
        distance = calculateDistance(userLocation.lat, userLocation.lng, lot.latitude, lot.longitude);
      }

      const isOpen = isLotOpen(lot.open_hours);

      // 🔥 COMPUTE SCORE: Balance ng distance at availability (for Recommended sort)
      let score = 0;
      if (distance !== null && isOpen && availableCount > 0) {
        const MAX_DISTANCE = 5;
        const MAX_AVAILABLE_SCORE = 50;
        const distanceScore = Math.max(0, (1 - (distance / MAX_DISTANCE)) * 100);
        const availabilityScore = Math.min((availableCount / MAX_AVAILABLE_SCORE) * 100, 100);
        const DISTANCE_WEIGHT = 0.4;
        const AVAILABILITY_WEIGHT = 0.6;
        score = (distanceScore * DISTANCE_WEIGHT) + (availabilityScore * AVAILABILITY_WEIGHT);
      }

      return { ...lot, lotSlots, availableCount, totalSlots, distance, isOpen, score };
    });

    // I-FILTER: Tanggalin sa listahan kapag closed ang operating hours OR kapag 0 na ang available slots.
    let filteredLots = lotsWithData.filter(lot => lot.isOpen && lot.availableCount > 0);

    // 🔥 DYNAMIC SORTING: Distance-first OR Recommended (score-based)
    filteredLots.sort((a, b) => {
      if (useRecommendedSort) {
        // RECOMMENDED SORT: Score-based (40% distance + 60% availability)
        if (a.distance !== null && b.distance !== null) {
          return b.score - a.score;
        }
        // Fallback to distance if no score
        const distA = a.distance !== null ? a.distance : Infinity;
        const distB = b.distance !== null ? b.distance : Infinity;
        if (distA !== distB) return distA - distB;
        return b.availableCount - a.availableCount;
      } else {
        // DISTANCE-FIRST SORT: Nearest first
        const distA = a.distance !== null ? a.distance : Infinity;
        const distB = b.distance !== null ? b.distance : Infinity;
        if (distA !== distB) return distA - distB;
        return b.availableCount - a.availableCount;
      }
    });

    // I-LIMIT: Ipakita lang ang 1 hanggang 5 na parking suggestions
    return filteredLots.slice(0, 5);
  };

  // 🔥 Memoization para hindi mag-recompute unnecessarily
  const processedLots = useMemo(() => getProcessedLots(), [dbParkingLots, dbSlots, userLocation, useRecommendedSort]);
  
  // 🔥 Available at Occupied slots ay mula lang sa OPEN na 5 suggested lots
  const suggestedLotIds = processedLots.map(lot => lot.id);
  
  const suggestedSlots = dbSlots.filter(slot => {
    const lot = processedLots.find(l => l.id === slot.lot_id);
    return lot && isLotOpen(lot.open_hours);
  });
  
  const totalAvailable = suggestedSlots.filter((s) => s.status === 'available').length;
  const totalOccupied = suggestedSlots.filter((s) => s.status !== 'available').length;
  const totalOpenLots = processedLots.length;
  
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (!isOnline) {
    return (
      <MobileLayout title="ParKada">
        <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
          <WifiOff size={48} className="text-gray-400" />
          <p className="text-gray-600 font-medium">You're offline</p>
          <p className="text-xs text-gray-400">Please check your internet connection</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium"
            aria-label="Retry connecting"
          >
            Retry
          </button>
        </div>
      </MobileLayout>
    );
  }

  if (loading) return (
    <MobileLayout title="ParKada">
      <LoadingSkeleton />
    </MobileLayout>
  );

  return (
    <MobileLayout
      title="ParKada"
      headerRight={
        <button 
          onClick={() => navigate("/notifications")} 
          className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted"
          aria-label="View notifications"
        >
          <Bell size={20} aria-hidden="true" />
          {hasUnreadNotifs && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" aria-label="Unread notifications" />}
        </button>
      }
    >
      <div className="page-enter pb-10">
        {!isOnline && <OfflineIndicator />}
        
        {/* Banner */}
        <div className="relative overflow-hidden mx-4 mt-4 rounded-2xl shadow-md h-36">
          <img src={MAP_IMG} className="w-full h-full object-cover" alt="Lipa City downtown map" />
          <div className="absolute inset-0 bg-slate-900/80 p-4 flex flex-col justify-between">
            <div>
              <p className="text-white/70 text-xs font-medium">{greeting}, {userName} 👋</p>
              <h2 className="text-white text-lg font-extrabold leading-tight mt-1">Lipa City Downtown Parking</h2>
            </div>
            <button 
              onClick={() => navigate("/map")} 
              className="flex items-center gap-2 bg-amber-400 text-amber-950 text-xs font-bold px-4 py-2 rounded-xl self-start active:scale-95 transition-transform"
              aria-label="Search all parking lots"
            >
              <Search size={14} aria-hidden="true" /> Search Now
            </button>
          </div>
        </div>

        {/* ACTIVE RESERVATION CARD */}
        <div className="mx-4 mt-6">
          <div className="flex justify-between items-end mb-2">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">My Current Booking</h3>
            <button 
              onClick={() => fetchAllData(false)} 
              className="flex items-center gap-1 text-[10px] font-bold text-blue-600 active:opacity-50"
              aria-label="Refresh data"
            >
              <RefreshCcw size={10} className={cn(isRefreshing && "animate-spin")} aria-hidden="true" />
              {isRefreshing ? "Updating..." : "Refresh"}
            </button>
          </div>

          {activeReservation ? (
            <div 
              className="bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-white/5"
              role="button"
              tabIndex={0}
              aria-label={`View reservation details for ${activeReservation.lotName}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-extrabold text-base tracking-tight">{activeReservation.lotName}</p>
                  <p className="text-white/60 text-xs mt-0.5">Slot {activeReservation.slotLabel} • <span className="uppercase font-mono text-amber-400">{activeReservation.vehiclePlate}</span></p>
                </div>
                <Badge className="bg-emerald-400 text-emerald-950">
                  ACTIVE
                </Badge>
              </div>

              {/* 🔥 NEW: Real-time timer with extension and fine */}
              <ActiveReservationTimer 
                reservation={{
                  id: activeReservation.id,
                  user_id: activeReservation.user_id,
                  total_amount: activeReservation.total_amount,   // ✅ IDAGDAG ITO
                  lot_id: activeReservation.lot_id,
                  end_time: activeReservation.end_time,
                  start_time: activeReservation.start_time,
                  duration: activeReservation.duration,
                  extension_count: activeReservation.extension_count,
                  extension_fee: activeReservation.extension_fee,
                  fine_amount: activeReservation.fine_amount,
                  fine_paid: activeReservation.fine_paid,
                  hourly_rate: activeReservation.hourly_rate,
                  extension_fee_setting: activeReservation.extension_fee_setting,
                  fine_penalty: activeReservation.fine_penalty,
                  overtime_rate: activeReservation.overtime_rate,
                  grace_period_minutes: activeReservation.grace_period_minutes,
                  extension_rate_per_hour: activeReservation.extension_rate_per_hour,
                  allow_extensions: activeReservation.allow_extensions
                }}
                onUpdate={() => fetchAllData()}
              />

              <div className="mt-3 text-right">
  <p className="text-[8px] text-white/40 font-bold">Ends at: {new Date(activeReservation.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</p>               
 </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-6 text-center">
              <p className="text-xs text-muted-foreground font-medium">No active reservations found.</p>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="mx-4 mt-6 grid grid-cols-3 gap-3">
          {[
            { label: "Available", value: totalAvailable, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Occupied", value: totalOccupied, color: "text-rose-600", bg: "bg-rose-50" },
            { label: "Total Lots", value: totalOpenLots, color: "text-blue-600", bg: "bg-blue-50" },
          ].map((s) => (
            <div key={s.label} className={cn("rounded-2xl p-3 text-center shadow-sm", s.bg)}>
              <p className={cn("text-2xl font-black", s.color)}>{s.value}</p>
              <p className="text-[9px] text-muted-foreground font-bold uppercase">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Nearby Lots List with Toggle Buttons */}
        <div className="mx-4 mt-8">
           <div className="flex flex-col gap-3 mb-4">
             <div className="flex justify-between items-center flex-wrap gap-2">
               <div className="flex items-center gap-2">
                 <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                   Nearby Suggestions
                   {userLocation && (
                     <span className="relative flex h-2 w-2" aria-label="Live location active">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                     </span>
                   )}
                 </h3>
               </div>
               <button 
                 onClick={() => navigate("/map")} 
                 className="text-xs font-bold text-blue-600 flex items-center gap-1"
                 aria-label="View all parking lots on map"
               >
                 View Map <ChevronRight size={14} aria-hidden="true" />
               </button>
             </div>
             
             {/* 🔥 Toggle Buttons - COMPACT */}
             <div className="flex gap-1.5 mb-2">
               <button 
                 onClick={() => setUseRecommendedSort(false)}
                 className={cn(
                   "flex-1 text-[9px] font-bold px-2 py-1 rounded-full transition-all flex items-center justify-center gap-0.5",
                   !useRecommendedSort ? "bg-blue-500 text-white shadow-sm" : "bg-gray-100 text-gray-600 border border-gray-200"
                 )}
               >
                 <ArrowUpDown size={10} /> Nearest
               </button>
               <button 
                 onClick={() => setUseRecommendedSort(true)}
                 className={cn(
                   "flex-1 text-[9px] font-bold px-2 py-1 rounded-full transition-all flex items-center justify-center gap-0.5",
                   useRecommendedSort ? "bg-amber-500 text-white shadow-sm" : "bg-gray-100 text-gray-600 border border-gray-200"
                 )}
               >
                 <Star size={10} /> Recommended
               </button>
             </div>
           </div>
           
           <div className="space-y-3">
              {processedLots.length > 0 ? processedLots.map(lot => {
                const available = lot.availableCount;
                
                let slotsColorClass = "text-rose-600"; 
                if (available >= 30) slotsColorClass = "text-emerald-600"; 
                else if (available > 10) slotsColorClass = "text-amber-500"; 

                // 🔥 Show "Best Value" badge only when Recommended sort is active and lot has good availability
                const showBestValueBadge = useRecommendedSort && lot.availableCount > 15 && lot.distance && lot.distance < 3;

                return (
                  <div 
                    key={lot.id} 
                    onClick={() => navigate(`/parking/${lot.id}`)} 
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition-all active:scale-[0.99] cursor-pointer relative"
                    role="button"
                    tabIndex={0}
                    aria-label={`View details for ${lot.name}, ${available} slots available`}
                  >
                    {/* 🔥 Best Value Badge (only when Recommended is active) */}
                    {showBestValueBadge && (
                      <div className="absolute -top-2 -right-2">
                        <Badge className="bg-amber-400 text-amber-950 text-[8px] px-2 py-0.5 rounded-full shadow-md">
                          ⭐ Best Value
                        </Badge>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm flex items-center gap-1.5">
                            {lot.name}
                            {lot.distance !== null && (
                              <span className="bg-blue-50 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-0.5">
                                <Navigation size={8} aria-hidden="true" /> {lot.distance.toFixed(1)} km
                              </span>
                            )}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <MapPin size={10} aria-hidden="true" /> {lot.address}
                          </p>
                        </div>

                        <p className="text-[9px] font-medium text-amber-600 mt-1">
                          🕒 {lot.open_hours}
                        </p>
                        <p className={cn("text-[10px] font-extrabold mt-0.5", slotsColorClass)}>
                          {available} {available === 1 ? 'slot' : 'slots'} available
                        </p>
                      </div>
                      <p className="text-sm font-black text-blue-700">
                        ₱{lot.rate_per_hour}/hr
                      </p>
                    </div>

                    <AvailabilityBar available={available} total={lot.lotSlots.length} />
                  </div>
                )
              }) : (
                 <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-6 text-center">
                   <p className="text-xs text-muted-foreground font-medium">No nearby parking available right now.</p>
                 </div>
              )}
           </div>
        </div>
      </div>
    </MobileLayout>
  );
}