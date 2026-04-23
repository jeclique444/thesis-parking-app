import { useEffect, useState, useCallback, useRef } from "react";
import MobileLayout from "@/components/MobileLayout";
import { Bell, BookOpen, CheckCircle2, Info, Loader2, Trash2, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/supabaseClient"; 
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const typeConfig: any = {
  reservation: { icon: BookOpen, color: "bg-blue-100 text-blue-600", label: "Booking" },
  urgent: { icon: Bell, color: "bg-rose-100 text-rose-600", label: "Urgent" },
  success: { icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600", label: "Completed" },
  system: { icon: Info, color: "bg-slate-100 text-slate-600", label: "System" },
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [limit, setLimit] = useState(50);
  
  const isProcessing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const refreshing = useRef(false);

  const parseTime = (timeStr: string): Date => {
    if (timeStr.includes('T')) return new Date(timeStr);
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const fetchNotifications = useCallback(async (userId: string) => {
    const { data } = await supabase.from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("recipient_role", "user")
      .order("created_at", { ascending: false })
      .limit(limit);
    setNotifs(data || []);
    setLoading(false);
    setPulling(false);
    refreshing.current = false;
  }, [limit]);

  const loadMore = async () => {
    const newLimit = limit + 50;
    setLimit(newLimit);
    if (user) await fetchNotifications(user.id);
  };

  const handleMarkAsRead = async (notifId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notifId);
    if (!error) {
      setNotifs(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    }
  };

  const sendNotifIfNeeded = async (userId: string, title: string, message: string, type: string, reservationId: string, flagField: string) => {
    const { data: res } = await supabase
      .from("reservations")
      .select(flagField)
      .eq("id", reservationId)
      .single();
    
    if (res && (res as any)[flagField] === true) return;

    await supabase.from("notifications").insert({
      user_id: userId,
      title,
      message,
      type,
      recipient_role: 'user',
      read: false
    });

    await supabase
      .from("reservations")
      .update({ [flagField]: true })
      .eq("id", reservationId);

    toast.info(title);
  };

  // Background checker
  useEffect(() => {
    if (!user) return;

    const runCheck = async () => {
      if (isProcessing.current) return;
      isProcessing.current = true;

      try {
        const { data: reservations } = await supabase
          .from("reservations")
          .select(`
            *,
            parking_lots (name)
          `)
          .eq("user_id", user.id)
          .in("status", ["active", "booked"]);

        if (!reservations) return;
        const now = new Date();

        for (const res of reservations) {
          const start = parseTime(res.start_time);
          const end = parseTime(res.end_time);
          if (end < start) end.setDate(end.getDate() + 1);
          const thirtyMinsBefore = new Date(start.getTime() - 30 * 60000);
          const shortSlot = res.slot_id?.split('-')[0] || res.slot_id;
          const lotName = res.parking_lots?.name || "Parking";

          if (now >= thirtyMinsBefore && now < start) {
            await sendNotifIfNeeded(
              user.id,
              "Upcoming Reservation",
              `${lotName} - Slot ${shortSlot} starts in 30 mins (at ${res.start_time}).`,
              "urgent",
              res.id,
              "notified_upcoming"
            );
          }

          if (now >= start && now < end && res.status === "active") {
            await sendNotifIfNeeded(
              user.id,
              "Reservation Started",
              `${lotName} - Slot ${shortSlot} is now active.`,
              "reservation",
              res.id,
              "notified_active"
            );
          }

          if (now >= end && res.status !== "completed") {
            await sendNotifIfNeeded(
              user.id,
              "Reservation Completed",
              `${lotName} - Time's up for Slot ${shortSlot}.`,
              "success",
              res.id,
              "notified_completed"
            );
            await supabase.from("parking_slots").update({ status: "available" }).eq("id", res.slot_id);
            await supabase.from("reservations").update({ status: "completed" }).eq("id", res.id);
          }
        }
      } finally {
        isProcessing.current = false;
      }
    };

    const interval = setInterval(runCheck, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser(authUser);
        fetchNotifications(authUser.id);
      }
    };
    init();
  }, [fetchNotifications]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('notif-realtime-user')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, 
      () => fetchNotifications(user.id))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchNotifications]);

  // Pull‑to‑refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const scrollTop = containerRef.current?.scrollTop || 0;
    if (scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === 0) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 30 && !refreshing.current) {
      setPulling(true);
    }
  };

  const handleTouchEnd = async () => {
    if (pulling && !refreshing.current && user) {
      refreshing.current = true;
      setPulling(false);
      await fetchNotifications(user.id);
      toast.success("Notifications refreshed");
    }
    touchStartY.current = 0;
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("recipient_role", "user");
    if (!error) {
      fetchNotifications(user.id);
      toast.success("All notifications marked as read");
    }
  };

  return (
    <MobileLayout 
      title="Alerts"
      headerRight={
        <button onClick={handleMarkAllAsRead} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
          <CheckCheck size={20} className="text-slate-400" />
        </button>
      }
    >
      <div 
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="h-full overflow-y-auto"
      >
        <div className="p-4 space-y-3 pb-24">
          {pulling && (
            <div className="flex justify-center py-2">
              <Loader2 className="animate-spin text-slate-400" size={20} />
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300" /></div>
          ) : (
            <>
              {notifs.map((n) => {
                const config = typeConfig[n.type] || typeConfig.system;
                const Icon = config.icon;
                return (
                  <div 
                    key={n.id} 
                    onClick={() => handleMarkAsRead(n.id)}
                    className={cn(
                      "bg-white p-4 rounded-2xl border flex gap-4 transition-all relative shadow-sm cursor-pointer", 
                      !n.read ? "border-l-4 border-l-slate-900" : "opacity-60 grayscale-[0.5]"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", config.color)}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 pr-6">
                      <h4 className="font-black text-slate-900 text-[11px] uppercase tracking-tight">{n.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 font-medium leading-tight">
                        {n.message.split(' (Ref:')[0]}
                      </p>
                      <span className="text-[8px] font-bold text-slate-400 uppercase mt-2 block">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        await supabase.from("notifications").delete().eq("id", n.id);
                        setNotifs(prev => prev.filter(item => item.id !== n.id));
                      }}
                      className="absolute right-3 top-4 text-slate-300 hover:text-rose-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              {notifs.length >= limit && (
                <button onClick={loadMore} className="w-full text-center text-blue-500 text-sm py-2 font-medium">
                  Load more
                </button>
              )}
            </>
          )}
          {!loading && notifs.length === 0 && (
            <div className="text-center py-16">
              <Bell size={48} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No new alerts</p>
              <p className="text-xs text-gray-400 mt-1">We'll notify you when something happens.</p>
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
} 