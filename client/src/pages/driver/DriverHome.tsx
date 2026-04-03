/*
 * iParkBayan — DriverHome (With Live Countdown, Auto-Cleanup & Overnight Fix)
 */
import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { MapPin, Clock, ChevronRight, Bell, Search, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "../../supabaseClient";

const MAP_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/iparkbayan-lipa-map-bf9Bjp7jKhLR43sJchAZUD.webp";

// 🔥 HELPER FUNCTIONS (Dapat nasa labas sila at magkahiwalay)

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

// 🔥 UPDATED: CountdownTimer with Overnight Fix
// 🔥 UPDATED: CountdownTimer with Overnight Fix & 10-min Red Warning
function CountdownTimer({ 
  startTime, 
  endTime, 
  createdAt, 
  onExpire 
}: { 
  startTime: string; 
  endTime: string; 
  createdAt: string; 
  onExpire: () => Promise<void> 
}) {
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

        // OVERNIGHT FIX: Kung mas maaga ang End kaysa Start, ibig sabihin bukas pa ito matatapos
        if (target < startDateTime) {
          target.setDate(target.getDate() + 1);
        }

        const diff = target.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeLeft("00:00:00");
          onExpire(); 
          return;
        }

        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        // BAGONG LOGIC: Kapag 0 hours at less than 10 minutes, magiging red (isUrgent)
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
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false); // 🔥 NOTIF STATE
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeStatuses = ["reserved", "active", "pending", "booked", "Reserved", "Active", "Pending", "Booked"];

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
        if (!res.end_time || !res.created_at) continue; 

        const anchorDate = new Date(res.created_at);
        let startDateTime = parseTimeWithAnchor(res.start_time || res.end_time, anchorDate);
        let endDateTime = parseTimeWithAnchor(res.end_time, anchorDate);

        if (endDateTime < startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }

        if (now >= endDateTime) {
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
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      await runCleanup(user.id);

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      if (profile?.full_name) setUserName(profile.full_name.split(" ")[0]);

      // 🔥 FIXED: Mas direct na query, kukuha lang kahit isa para mas mabilis at sigurado
      const { data: unreadNotif, error: notifError } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("read", false)
        .limit(1);

      if (!notifError) {
        setHasUnreadNotifs(unreadNotif && unreadNotif.length > 0);
      } else {
        console.error("Notif Fetch Error:", notifError);
      }

      const [lotsRes, slotsRes] = await Promise.all([
        supabase.from("parking_lots").select("*").order("name", { ascending: true }),
        supabase.from("parking_slots").select("*")
      ]);

      if (lotsRes.data) setDbParkingLots(lotsRes.data);
      if (slotsRes.data) setDbSlots(slotsRes.data);

      const { data: resData, error: resError } = await supabase
        .from("reservations")
        .select(`*, parking_lots ( name ), parking_slots ( label )`)
        .eq("user_id", user.id)
        .in("status", activeStatuses) 
        .order("created_at", { ascending: false })
        .limit(1);

      if (resError) console.error("Fetch Reservation Error:", resError);

      if (resData && resData.length > 0) {
        const rawRes = resData[0] as any;
        const getJoinValue = (val: any) => Array.isArray(val) ? val[0] : val;

        setActiveReservation({
          lotName: getJoinValue(rawRes.parking_lots)?.name || "Parking Lot",
          slotLabel: getJoinValue(rawRes.parking_slots)?.label || "-",
          vehiclePlate: rawRes.plate_number || "N/A",
          startTime: rawRes.start_time || "-", 
          endTime: rawRes.end_time || "-",
          createdAt: rawRes.created_at, 
          status: rawRes.status || "PENDING"
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

    // 🔥 Make sure enabled sa Supabase Dashboard ang Replication/Realtime ng 'notifications' table!
    const channel = supabase.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_slots' }, () => {
          fetchAllData(true); 
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
          fetchAllData(true); 
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
          fetchAllData(true); // Ito ang magti-trigger ng silent re-fetch pag may bagong notif
      })
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

  const openLotIds = dbParkingLots.filter(lot => isLotOpen(lot.open_hours)).map(lot => lot.id);
  const activeSlots = dbSlots.filter(s => openLotIds.includes(s.lot_id));

  const totalAvailable = activeSlots.filter((s) => s.status === 'available').length;
  const totalOccupied = activeSlots.filter((s) => s.status !== 'available').length;
  
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (loading) return (
    <MobileLayout title="ECPark">
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </MobileLayout>
  );

  return (
    <MobileLayout
      title="ECPark"
      headerRight={
        <button onClick={() => navigate("/notifications")} className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted">
          <Bell size={20} />
          {/* 🔥 Dito lalabas yung red dot KAPAG MAY UNREAD NOTIFICATIONS lang */}
          {hasUnreadNotifs && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />}
        </button>
      }
    >
      <div className="page-enter pb-10">
        {/* Banner */}
        <div className="relative overflow-hidden mx-4 mt-4 rounded-2xl shadow-md h-36">
          <img src={MAP_IMG} className="w-full h-full object-cover" alt="Lipa Map" />
          <div className="absolute inset-0 bg-slate-900/80 p-4 flex flex-col justify-between">
            <div>
              <p className="text-white/70 text-xs font-medium">{greeting}, {userName} 👋</p>
              <h2 className="text-white text-lg font-extrabold leading-tight mt-1">Lipa City Downtown Parking</h2>
            </div>
            <button onClick={() => navigate("/map")} className="flex items-center gap-2 bg-amber-400 text-amber-950 text-xs font-bold px-4 py-2 rounded-xl self-start active:scale-95 transition-transform">
              <Search size={14} /> Search Now
            </button>
          </div>
        </div>

         {/* ACTIVE RESERVATION CARD */}
        <div className="mx-4 mt-6">
          <div className="flex justify-between items-end mb-2">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">My Current Booking</h3>
            <button onClick={() => fetchAllData(false)} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 active:opacity-50">
              <RefreshCcw size={10} className={cn(isRefreshing && "animate-spin")} />
              {isRefreshing ? "Updating..." : "Refresh"}
            </button>
          </div>

          {activeReservation ? (
            <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-white/5 active:scale-[0.98] transition-all" onClick={() => navigate("/reservations")}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-extrabold text-base tracking-tight">{activeReservation.lotName}</p>
                  <p className="text-white/60 text-xs mt-0.5">Slot {activeReservation.slotLabel} • <span className="uppercase font-mono text-amber-400">{activeReservation.vehiclePlate}</span></p>
                </div>
                <Badge className={cn("font-black text-[9px]", activeReservation.status.toLowerCase() === 'active' ? "bg-emerald-400 text-emerald-950" : "bg-amber-400 text-amber-950")}>
                  {activeReservation.status.toUpperCase()}
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                <div>
                   <p className="text-[8px] uppercase text-white/40 font-bold mb-1">Time Remaining</p>
                   <CountdownTimer 
                     startTime={activeReservation.startTime}
                     endTime={activeReservation.endTime} 
                     createdAt={activeReservation.createdAt}
                     onExpire={async () => {
                       const { data: { session } } = await supabase.auth.getSession();
                       if (session?.user) await runCleanup(session.user.id);
                       fetchAllData();
                     }} 
                   />
                </div>
                <div className="text-right">
                   <p className="text-[8px] uppercase text-white/40 font-bold mb-1">Ends At</p>
                   <p className="text-xs font-bold">{activeReservation.endTime}</p>
                </div>
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
            { label: "Total Lots", value: dbParkingLots.length, color: "text-blue-600", bg: "bg-blue-50" },
          ].map((s) => (
            <div key={s.label} className={cn("rounded-2xl p-3 text-center shadow-sm", s.bg)}>
              <p className={cn("text-2xl font-black", s.color)}>{s.value}</p>
              <p className="text-[9px] text-muted-foreground font-bold uppercase">{s.label}</p>
            </div>
          ))}
        </div>

    {/* Nearby Lots List */}
        <div className="mx-4 mt-8">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-extrabold">Nearby Parking</h3>
              <button onClick={() => navigate("/map")} className="text-xs font-bold text-blue-600 flex items-center gap-1">View Map <ChevronRight size={14}/></button>
           </div>
           <div className="space-y-3">
              {dbParkingLots.map(lot => {
                const lotSlots = dbSlots.filter(s => s.lot_id === lot.id);
                const available = lotSlots.filter(s => s.status === 'available').length;
                
                let slotsColorClass = "text-rose-600"; 
                if (available >= 30) slotsColorClass = "text-emerald-600"; 
                else if (available > 10) slotsColorClass = "text-amber-500"; 

                let isOpen = true;
                let openTimeDisplay = "tomorrow";

                if (lot.open_hours) {
                  const hoursText = lot.open_hours.toLowerCase();
                  
                  if (!hoursText.includes("24 hour")) {
                    const times = lot.open_hours.split("-").map((t: string) => t.trim());
                    
                    if (times.length === 2) {
                      const startTimeStr = times[0]; 
                      const endTimeStr = times[1];  

                      const startMins = parseOpenHoursToMins(startTimeStr);
                      const endMins = parseOpenHoursToMins(endTimeStr);

                      const now = new Date();
                      const currentMins = now.getHours() * 60 + now.getMinutes();

                      if (startMins < endMins) {
                        isOpen = currentMins >= startMins && currentMins < endMins;
                      } else {
                        isOpen = currentMins >= startMins || currentMins < endMins;
                      }

                      openTimeDisplay = `tomorrow at ${startTimeStr}`;
                    }
                  }
                }

                return (
                  <div 
                    key={lot.id} 
                    onClick={() => isOpen ? navigate(`/parking/${lot.id}`) : null} 
                    className={cn(
                      "bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition-all",
                      isOpen ? "active:scale-[0.99] cursor-pointer" : "opacity-80 grayscale-[0.3] cursor-not-allowed"
                    )}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={cn("font-bold text-sm", !isOpen && "text-gray-500")}>
                            {lot.name}
                          </p>
                          {!isOpen && (
                            <span className="bg-rose-100 text-rose-700 text-[9px] font-black px-1.5 py-0.5 rounded flex items-center tracking-wider uppercase">
                              Closed
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin size={10}/> {lot.address}
                        </p>
                        <p className="text-[9px] font-medium text-amber-600 mt-1">
                          🕒 {lot.open_hours}
                        </p>
                        {isOpen && (
                          <p className={cn("text-[10px] font-extrabold mt-0.5", slotsColorClass)}>
                            {available} {available === 1 ? 'slot' : 'slots'} available
                          </p>
                        )}
                      </div>
                      <p className={cn("text-sm font-black", isOpen ? "text-blue-700" : "text-gray-400")}>
                        ₱{lot.rate_per_hour}/hr
                      </p>
                    </div>

                    {isOpen ? (
                      <AvailabilityBar available={available} total={lotSlots.length} />
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-2.5 text-center border border-dashed border-gray-200 mt-1">
                        <p className="text-[10px] font-bold text-gray-500">
                          This lot is currently closed. Please reserve {openTimeDisplay}.
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
           </div>
        </div>
      </div>
    </MobileLayout>
  );
}