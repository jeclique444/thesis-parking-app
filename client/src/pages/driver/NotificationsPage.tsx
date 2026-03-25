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
  const [user, setUser] = useState<any>(null);
  
  const isProcessing = useRef(false);
  const localNotified = useRef(new Set<string>());

  // 1. Fetch notifications - hiwalay sa main loop para iwas console errors
  const fetchNotifications = useCallback(async (userId: string) => {
    const { data } = await supabase.from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setNotifs(data || []);
    setLoading(false);
  }, []);

  // 2. Clickable: Mark as Read function
  const handleMarkAsRead = async (notifId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notifId);
    
    if (!error) {
      setNotifs(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    }
  };

  // 3. Alert Sender - May strict checking sa Database para sa one-time alert lang
  const sendUniqueNotif = async (userId: string, title: string, message: string, type: string, actionKey: string) => {
    if (localNotified.current.has(actionKey)) return;

    // Check sa DB kung na-send na ang specific alert na ito dati
    const { data: existing } = await supabase.from("notifications")
      .select("id")
      .eq("user_id", userId)
      .ilike("message", `%${actionKey}%`)
      .limit(1);

    if (!existing || existing.length === 0) {
      await supabase.from("notifications").insert({
        user_id: userId,
        title,
        message: `${message} (Ref: ${actionKey})`,
        type,
        read: false
      });
      toast.info(title);
    }
    localNotified.current.add(actionKey);
  };

  // 4. Initial Load at Realtime Listener
  useEffect(() => {
    const initSession = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser(authUser);
        fetchNotifications(authUser.id);
      }
    };
    initSession();

    const channel = supabase.channel('notif-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, 
        () => user && fetchNotifications(user.id)
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications, user?.id]);

  // 5. Background Checker - Pinagsama ang upcoming messages
  useEffect(() => {
    if (!user) return;

    const runCheck = async () => {
      if (isProcessing.current) return;
      isProcessing.current = true;

      try {
        const { data: reservations } = await supabase.from("reservations")
          .select("*").eq("status", "active").eq("user_id", user.id);

        if (!reservations) return;
        const now = new Date();

        const parseTime = (timeStr: string) => {
          const [time, modifier] = timeStr.split(' ');
          let [hours, minutes] = time.split(':').map(Number);
          if (modifier === 'PM' && hours < 12) hours += 12;
          if (modifier === 'AM' && hours === 12) hours = 0;
          const d = new Date();
          d.setHours(hours, minutes, 0, 0);
          return d;
        };

        for (const res of reservations) {
          const start = parseTime(res.start_time);
          const end = parseTime(res.end_time);
          if (end < start) end.setDate(end.getDate() + 1);

          const thirtyMinsBefore = new Date(start.getTime() - 30 * 60000);
          const shortSlot = res.slot_id.split('-')[0];

          // 🔔 One-time Combined Upcoming Alert
          if (now >= thirtyMinsBefore && now < start) {
            const combinedMsg = `Slot ${shortSlot} starts in 30 mins (at ${res.start_time}).`;
            await sendUniqueNotif(user.id, "Upcoming Reservation", combinedMsg, "urgent", `UPCOMING-${res.id}`);
          }

          // 🚦 Reservation Started
          if (now >= start && now < end) {
            await sendUniqueNotif(user.id, "Reservation Started", `Slot ${shortSlot} is now active.`, "reservation", `START-${res.id}`);
            await supabase.from("parking_slots").update({ status: "occupied" }).eq("id", res.slot_id);
          }

          // ✅ Reservation Completed
          if (now >= end) {
            await sendUniqueNotif(user.id, "Reservation Completed", `Time's up for Slot ${shortSlot}.`, "success", `END-${res.id}`);
            await supabase.from("parking_slots").update({ status: "available" }).eq("id", res.slot_id);
            await supabase.from("reservations").update({ status: "completed" }).eq("id", res.id);
          }
        }
      } finally {
        isProcessing.current = false;
      }
    };

    const interval = setInterval(runCheck, 15000); // 15s para iwas lock errors
    return () => clearInterval(interval);
  }, [user]);

  return (
    <MobileLayout 
      title="Alerts"
      headerRight={
        <button onClick={async () => {
          if (user) {
            await supabase.from("notifications").update({ read: true }).eq("user_id", user.id);
            fetchNotifications(user.id);
          }
        }} className="pr-2"><CheckCheck size={20} className="text-slate-400" /></button>
      }
    >
      <div className="p-4 space-y-3 pb-24">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300" /></div>
        ) : (
          notifs.map((n) => {
            const config = typeConfig[n.type] || typeConfig.system;
            const Icon = config.icon;
            return (
              <div 
                key={n.id} 
                onClick={() => handleMarkAsRead(n.id)}
                className={cn(
                  "bg-white p-4 rounded-2xl border flex gap-4 transition-all relative shadow-sm cursor-pointer", 
                  !n.read ? "border-l-4 border-l-slate-900" : "opacity-50 grayscale"
                )}
              >
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", config.color)}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 pr-6">
                  <h4 className="font-black text-slate-900 text-[11px] uppercase">{n.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium leading-tight">
                    {n.message.split(' (Ref:')[0]}
                  </p>
                  <span className="text-[8px] font-bold text-slate-400 uppercase mt-2 block">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </div>
                <button 
                  onClick={async (e) => {
                    e.stopPropagation(); // Iwas trigger sa mark as read
                    await supabase.from("notifications").delete().eq("id", n.id);
                    setNotifs(prev => prev.filter(item => item.id !== n.id));
                  }}
                  className="absolute right-3 top-4 text-slate-300 hover:text-rose-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })
        )}
        {!loading && notifs.length === 0 && (
          <div className="text-center py-20 text-slate-400 text-[10px] font-black uppercase tracking-widest">No Alerts</div>
        )}
      </div>
    </MobileLayout>
  );
}