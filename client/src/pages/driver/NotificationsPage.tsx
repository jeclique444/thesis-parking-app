/*
 * ParKada — NotificationPage
 * Fixed: 30-min expiry notice, reservation completed, long press selection, pull-to-refresh
 * Fixed: TypeScript errors (parking_lots array access, async cleanup)
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "../../supabaseClient";
import {
  Bell, Loader2, Car, Clock, CheckCircle, AlertTriangle,
  DollarSign, RefreshCw, Calendar, AlertCircle,
  Trash2, CheckCheck, Smile, CheckSquare, Square, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, isToday } from "date-fns";
import { toast } from "sonner";

type NotificationType =
  | "vehicle_added"
  | "reservation_confirmed"
  | "reservation_started"
  | "session_expiring"
  | "reservation_extended"
  | "reservation_completed"
  | "penalty_overpark"
  | "overtime_fee";

interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  related_id?: string;
  metadata?: any;
}

const getNotificationStyle = (type: NotificationType) => {
  switch (type) {
    case "vehicle_added": return { icon: Car, color: "bg-blue-100 text-blue-600" };
    case "reservation_confirmed": return { icon: Calendar, color: "bg-green-100 text-green-600" };
    case "reservation_started": return { icon: Clock, color: "bg-amber-100 text-amber-600" };
    case "session_expiring": return { icon: AlertTriangle, color: "bg-orange-100 text-orange-600" };
    case "reservation_extended": return { icon: RefreshCw, color: "bg-purple-100 text-purple-600" };
    case "reservation_completed": return { icon: CheckCircle, color: "bg-emerald-100 text-emerald-600" };
    case "penalty_overpark": return { icon: AlertCircle, color: "bg-red-100 text-red-600" };
    case "overtime_fee": return { icon: DollarSign, color: "bg-rose-100 text-rose-600" };
    default: return { icon: Bell, color: "bg-gray-100 text-gray-600" };
  }
};

const getDisplayTime = (dateString: string) => {
  const date = new Date(dateString);
  if (isToday(date)) return format(date, "h:mm a");
  else return format(date, "MMM d");
};

// Helper: convert time string (e.g., "10:00 AM") to minutes since midnight
const timeToMinutes = (timeStr: string): number => {
  const [time, modifier] = timeStr.trim().split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + (minutes || 0);
};

export default function NotificationPage() {
  const [, navigate] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [limit, setLimit] = useState(50);
  const refreshing = useRef(false);
  const isProcessing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isAtTop = useRef(true);

  // Helper: send notification with deduplication using flag field
  const sendNotifIfNeeded = async (
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    reservationId: string,
    flagField: string
  ) => {
    try {
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("related_id", reservationId)
        .eq("title", title)
        .maybeSingle();
      if (existing) return;

      const { data: res } = await supabase
        .from("reservations")
        .select(flagField)
        .eq("id", reservationId)
        .single();
      if (res && (res as any)[flagField] === true) return;

      const { error: insertError } = await supabase.from("notifications").insert({
        user_id: userId,
        title,
        message,
        type,
        recipient_role: "user",
        read: false,
        related_id: reservationId,
      });
      if (insertError) throw insertError;

      await supabase
        .from("reservations")
        .update({ [flagField]: true })
        .eq("id", reservationId);

      toast.info(title);
    } catch (err) {
      console.error("Failed to send notification:", err);
    }
  };

  // Background checker (every minute) - uses end_time if available, fallback to duration
  useEffect(() => {
    if (!user) return;

    const runCheck = async () => {
      if (isProcessing.current) return;
      isProcessing.current = true;
      try {
        // Get all active or booked reservations for this user
        const { data: reservations } = await supabase
          .from("reservations")
          .select(`
            id,
            user_id,
            start_time,
            end_time,
            created_at,
            duration,
            status,
            slot_id,
            lot_id,
            parking_lots (name)
          `)
          .eq("user_id", user.id)
          .in("status", ["active", "booked"]);

        if (!reservations) return;

        const now = new Date();

        for (const res of reservations) {
          // Extract lot name from array (parking_lots is an array)
          const lotName = (res.parking_lots as any)?.[0]?.name || "Parking";
          const slotShort = res.slot_id?.split('-')[0] || res.slot_id;

          let endDateTime: Date | null = null;

          // Try to parse end_time as full timestamp first
          if (res.end_time && res.end_time.includes('T')) {
            endDateTime = new Date(res.end_time);
          } else if (res.end_time && res.created_at) {
            // end_time is only time string, combine with created_at date
            const endMinutes = timeToMinutes(res.end_time);
            const baseDate = new Date(res.created_at);
            baseDate.setHours(0, 0, 0, 0);
            endDateTime = new Date(baseDate.getTime() + endMinutes * 60 * 1000);
          } else if (res.duration && res.created_at) {
            // Use duration (minutes) from created_at
            endDateTime = new Date(new Date(res.created_at).getTime() + res.duration * 60 * 1000);
          }

          if (!endDateTime) continue;

          const thirtyMinsBeforeEnd = new Date(endDateTime.getTime() - 30 * 60000);

          // 1. Session expiring in 30 minutes
          if (now >= thirtyMinsBeforeEnd && now < endDateTime && res.status !== "completed") {
            await sendNotifIfNeeded(
              user.id,
              "Session Expiring Soon",
              `${lotName} - Slot ${slotShort} ends in 30 minutes. Extend now to avoid penalty.`,
              "session_expiring",
              res.id,
              "notified_expiring"
            );
          }

          // 2. Reservation started (if active and within timeframe)
          if (now >= new Date(res.created_at) && now < endDateTime && res.status === "active") {
            await sendNotifIfNeeded(
              user.id,
              "Reservation Started",
              `${lotName} - Slot ${slotShort} is now active.`,
              "reservation_started",
              res.id,
              "notified_active"
            );
          }

          // 3. Reservation completed
          if (now >= endDateTime && res.status !== "completed") {
            await sendNotifIfNeeded(
              user.id,
              "Reservation Completed",
              `${lotName} - Time's up for Slot ${slotShort}.`,
              "reservation_completed",
              res.id,
              "notified_completed"
            );
            // Auto-update slot and reservation status
            await supabase
              .from("parking_slots")
              .update({ status: "available" })
              .eq("id", res.slot_id);
            await supabase
              .from("reservations")
              .update({ status: "completed" })
              .eq("id", res.id);
          }
        }
      } catch (err) {
        console.error("Background check error:", err);
      } finally {
        isProcessing.current = false;
      }
    };

    const interval = setInterval(runCheck, 60000);
    runCheck(); // run immediately
    return () => clearInterval(interval);
  }, [user]);

  // Fetch notifications (unchanged)
  const fetchNotifications = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("recipient_role", "user")
      .order("created_at", { ascending: false })
      .limit(limit);
    setNotifications(data || []);
    setLoading(false);
    setPulling(false);
    refreshing.current = false;
  }, [limit]);

  const loadMore = async () => {
    const newLimit = limit + 50;
    setLimit(newLimit);
    if (user) await fetchNotifications(user.id);
  };

  // Selection mode functions
  const enterSelectionMode = (triggeredById?: string) => {
    if (selectionMode) return;
    setSelectionMode(true);
    setSelectedIds(triggeredById ? new Set([triggeredById]) : new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === notifications.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(notifications.map(n => n.id)));
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const { error } = await supabase
      .from("notifications")
      .delete()
      .in("id", Array.from(selectedIds));
    if (!error) {
      setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
      toast.success(`${selectedIds.size} notification${selectedIds.size > 1 ? 's' : ''} deleted`);
      exitSelectionMode();
    } else toast.error("Failed to delete");
  };

  const handleMarkSelectedAsRead = async () => {
    if (selectedIds.size === 0) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", Array.from(selectedIds));
    if (!error) {
      setNotifications(prev => prev.map(n => selectedIds.has(n.id) ? { ...n, read: true } : n));
      toast.success(`Marked ${selectedIds.size} as read`);
      exitSelectionMode();
    } else toast.error("Failed to mark as read");
  };

  // Long press handlers (7 seconds)
  const handleTouchStartNotification = (e: React.TouchEvent, id: string) => {
    if (selectionMode) return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => enterSelectionMode(id), 7000);
  };

  const handleTouchEndNotification = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClickNotification = (id: string) => {
    if (selectionMode) toggleSelect(id);
    else handleMarkAsRead(id);
  };

  const handleMarkAsRead = async (id: string) => {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (!error) setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // Strict pull-to-refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    if (container.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
      isAtTop.current = true;
    } else {
      isAtTop.current = false;
      touchStartY.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isAtTop.current) return;
    if (touchStartY.current === 0) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 30 && !refreshing.current && !selectionMode) {
      setPulling(true);
      e.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    if (pulling && !refreshing.current && user && !selectionMode) {
      refreshing.current = true;
      setPulling(false);
      await fetchNotifications(user.id);
      toast.success("Refreshed");
    }
    touchStartY.current = 0;
    isAtTop.current = false;
  };

  // Initial load & real-time subscription (fixed cleanup)
  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser(authUser);
        fetchNotifications(authUser.id);
      } else setLoading(false);
    };
    init();
  }, [fetchNotifications]);

  // Real-time subscription – fixed async cleanup
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('notif-realtime-user')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => fetchNotifications(user.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); }; // no return of promise
  }, [user?.id, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const allSelected = notifications.length > 0 && selectedIds.size === notifications.length;
  const selectedCount = selectedIds.size;

  return (
    <MobileLayout
      title="Alerts"
      showBack={false}
      headerRight={
        !selectionMode && unreadCount > 0 && (
          <div className="flex items-center">
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          </div>
        )
      }
    >
      <div className="flex flex-col h-full">
        {/* Selection Toolbar */}
        {selectionMode && (
          <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={selectAll} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                <span>Select All</span>
              </button>
              <span className="text-xs text-slate-500">{selectedCount} selected</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleDeleteSelected} className="text-rose-500 hover:text-rose-700 p-1 rounded-full transition-colors" disabled={selectedIds.size === 0}>
                <Trash2 size={18} />
              </button>
              <button onClick={handleMarkSelectedAsRead} className="text-blue-500 hover:text-blue-700 p-1 rounded-full transition-colors" disabled={selectedIds.size === 0}>
                <CheckCheck size={18} />
              </button>
              <button onClick={exitSelectionMode} className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-y-auto"
        >
          <div className="p-4 space-y-3 pb-24">
            {pulling && (
              <div className="flex justify-center py-2">
                <Loader2 className="animate-spin text-slate-400" size={20} />
              </div>
            )}

            {loading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="bg-white p-4 rounded-2xl border animate-pulse">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-200"></div>
                      <div className="flex-1">
                        <div className="h-3 bg-gray-200 rounded w-1/3 mb-2"></div>
                        <div className="h-2 bg-gray-200 rounded w-full mb-1"></div>
                        <div className="h-2 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-16">
                <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell size={40} className="text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">No alerts yet</p>
                <p className="text-xs text-gray-400 mt-1">We'll notify you when something happens.</p>
              </div>
            ) : (
              <>
                {notifications.map((notif) => {
                  const { icon: Icon, color } = getNotificationStyle(notif.type);
                  const displayTime = getDisplayTime(notif.created_at);
                  const isSelected = selectionMode && selectedIds.has(notif.id);
                  const isUnread = !notif.read && !selectionMode;
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleClickNotification(notif.id)}
                      onTouchStart={(e) => handleTouchStartNotification(e, notif.id)}
                      onTouchEnd={handleTouchEndNotification}
                      className={cn(
                        "p-4 rounded-2xl border flex gap-4 transition-all relative shadow-sm",
                        selectionMode ? "cursor-pointer" : "cursor-pointer active:scale-[0.99]",
                        isUnread ? "bg-white border-l-4 border-l-slate-900 shadow-sm" : "bg-gray-50 border-gray-100",
                        isSelected ? "bg-blue-50 border-blue-200" : "",
                        selectionMode && !isSelected ? "opacity-90" : ""
                      )}
                    >
                      {selectionMode && (
                        <div className="shrink-0 self-center">
                          {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} className="text-gray-400" />}
                        </div>
                      )}
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", color)}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 pr-6">
                        <h4 className="font-black text-slate-900 text-[11px] uppercase tracking-tight flex items-center gap-2">
                          {notif.title}
                          {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium leading-tight">{notif.message}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap">{displayTime}</span>
                      </div>
                    </div>
                  );
                })}
                {notifications.length >= limit && (
                  <button onClick={loadMore} className="w-full text-center text-blue-500 text-sm py-2 font-medium">
                    Load more
                  </button>
                )}
                {!notifications.some(n => !n.read) && notifications.length > 0 && !selectionMode && (
                  <div className="flex items-center justify-center gap-2 pt-4 text-gray-400">
                    <Smile size={14} />
                    <span className="text-xs">You're all caught up!</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}