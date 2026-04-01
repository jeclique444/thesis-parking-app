/*
 * iParkBayan — Home (Real-time, Countdown & 10-Min Alert Version)
 */
import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import MobileLayout from "@/components/MobileLayout";
import { Ticket, MapPin, Clock, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function Home() {
  const [, navigate] = useLocation();
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isUrgent, setIsUrgent] = useState(false); // Para sa red color
  const [hasNotified, setHasNotified] = useState(false); // Para sa 10-min notif

  useEffect(() => {
    fetchActiveBooking();

    const channel = supabase
      .channel('home-reservation-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => {
          fetchActiveBooking();
          setHasNotified(false); // Reset notif kapag nag-refresh ang booking
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- COUNTDOWN & ALERT LOGIC ---
  useEffect(() => {
    if (!activeBooking?.end_time) {
      setTimeLeft("");
      setIsUrgent(false);
      return;
    }

    const timer = setInterval(async () => {
      const now = new Date();
      const [hours, minutes] = activeBooking.end_time.split(':').map(Number);
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      
      const diff = target.getTime() - now.getTime();

      // 1. Check kung 10 minutes (600,000 ms) na lang
      if (diff > 0 && diff <= 600000) {
        setIsUrgent(true);
        
        // Mag-send ng notification sa DB kung hindi pa nagagawa
        if (!hasNotified) {
          sendTenMinuteWarning();
          setHasNotified(true);
        }
      } else {
        setIsUrgent(false);
      }

      if (diff <= 0) {
        setTimeLeft("EXPIRED");
        setIsUrgent(true);
        clearInterval(timer);
      } else {
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${h > 0 ? h + 'h ' : ''}${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeBooking, hasNotified]);

  const sendTenMinuteWarning = async () => {
    if (!activeBooking) return;
    await supabase.from("notifications").insert([{
      user_id: activeBooking.user_id,
      title: "Hurry up! ⏳",
      message: `Your reservation for Slot ${activeBooking.parking_slots?.label} expires in 10 minutes.`,
      type: "alert",
      read: false
    }]);
    console.log("10-minute warning sent to DB.");
  };

  const fetchActiveBooking = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('reservations')
        .select(`*, parking_lots (name, address), parking_slots (label)`)
        .eq('user_id', user.id)
        .in('status', ['active', 'pending', 'Active', 'Pending']) 
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        const cleanedData = {
          ...data,
          parking_lots: Array.isArray(data.parking_lots) ? data.parking_lots[0] : data.parking_lots,
          parking_slots: Array.isArray(data.parking_slots) ? data.parking_slots[0] : data.parking_slots
        };
        setActiveBooking(cleanedData);
      } else {
        setActiveBooking(null);
      }
    } catch (err) {
      console.error("Home fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MobileLayout title="iParkBayan">
      <div className="p-4 space-y-6 pb-24">
        
        <div className="pt-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Welcome back!</h2>
          <p className="text-sm text-slate-500 font-medium">Safe parking, happy driving.</p>
        </div>

        <section>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Current Booking</h3>
            {isUrgent && (
               <span className="flex items-center gap-1 text-[9px] font-black text-rose-500 animate-pulse">
                 <AlertCircle size={10} /> TIME CRITICAL
               </span>
            )}
          </div>
          
          {isLoading ? (
            <div className="h-44 w-full bg-slate-100 animate-pulse rounded-[2.5rem] flex items-center justify-center">
               <Loader2 className="animate-spin text-slate-300" size={24} />
            </div>
          ) : activeBooking ? (
            <div 
              onClick={() => navigate(`/ticket/${activeBooking.id}`)}
              className={cn(
                "p-7 rounded-[2.5rem] shadow-2xl relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all border-2",
                isUrgent ? "bg-rose-950 border-rose-500 shadow-rose-200" : "bg-slate-900 border-transparent shadow-slate-200"
              )}
            >
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <span className={cn(
                      "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                      activeBooking.status.toLowerCase() === 'active' ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                    )}>
                      {activeBooking.status}
                    </span>
                    <h4 className="font-black text-xl leading-tight mt-1 text-white">{activeBooking.parking_lots?.name}</h4>
                    <p className="text-slate-400 text-[11px] flex items-center gap-1">
                      <MapPin size={12} className={isUrgent ? "text-rose-500" : "text-primary"} /> {activeBooking.parking_lots?.address}
                    </p>
                  </div>
                  <div className={cn("p-3 rounded-2xl backdrop-blur-md", isUrgent ? "bg-rose-500/20" : "bg-white/10")}>
                    <Ticket size={24} className={isUrgent ? "text-rose-500" : "text-primary"} />
                  </div>
                </div>

                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em]">Time Remaining</p>
                    <p className={cn(
                      "text-3xl font-black transition-colors",
                      isUrgent ? "text-rose-500 font-black animate-pulse" : "text-emerald-400"
                    )}>
                      {timeLeft || "--:--"}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em]">Slot</p>
                    <p className="text-3xl font-black text-white">{activeBooking.parking_slots?.label}</p>
                  </div>
                </div>
              </div>
              
              {/* Glow Effect */}
              <div className={cn(
                "absolute -right-10 -bottom-10 w-48 h-48 rounded-full blur-[60px]",
                isUrgent ? "bg-rose-500/20" : "bg-primary/10"
              )} />
            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-10 rounded-[2.5rem] text-center" onClick={() => navigate('/book')}>
              <Ticket className="text-slate-300 mx-auto mb-3" size={24} />
              <p className="text-slate-500 font-bold text-sm">No active bookings.</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest">Tap to book now</p>
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-4">
           <button onClick={() => navigate('/book')} className="p-5 bg-white border border-slate-100 rounded-3xl flex flex-col items-center gap-2 shadow-sm active:bg-slate-50 transition-colors">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><MapPin size={20} /></div>
              <span className="text-[11px] font-black uppercase text-slate-600 tracking-wider">Find Parking</span>
           </button>
           <button onClick={() => navigate('/bookings')} className="p-5 bg-white border border-slate-100 rounded-3xl flex flex-col items-center gap-2 shadow-sm active:bg-slate-50 transition-colors">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center"><Clock size={20} /></div>
              <span className="text-[11px] font-black uppercase text-slate-600 tracking-wider">History</span>
           </button>
        </div>

      </div>
    </MobileLayout>
  );
}