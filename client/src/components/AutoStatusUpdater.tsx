import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient"; // Isang akyat lang mula sa components
import { toast } from "sonner";

export default function AutoStatusUpdater() {
  const [notifiedReservations, setNotifiedReservations] = useState<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data: reservations, error } = await supabase
          .from("reservations")
          .select("*")
          .eq("status", "active");

        if (error || !reservations) return;

        const now = new Date();

        // Smart Time Parser (Para iwas Invalid Date)
        const parseTime = (timeStr: string) => {
          if (!timeStr) return [0, 0];
          const cleanTime = timeStr.replace(/AM|PM/i, '').trim();
          const parts = cleanTime.split(':');
          let h = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) || 0;
          const lowerStr = timeStr.toLowerCase();
          if (lowerStr.includes('pm') && h < 12) h += 12;
          if (lowerStr.includes('am') && h === 12) h = 0;
          return [h, m];
        };

        for (const res of reservations) {
          const [startH, startM] = parseTime(res.start_time);
          const [endH, endM] = parseTime(res.end_time);

          const startDateTime = new Date();
          startDateTime.setHours(startH, startM, 0, 0);

          const endDateTime = new Date();
          endDateTime.setHours(endH, endM, 0, 0);
          if (endH < startH) endDateTime.setDate(endDateTime.getDate() + 1);

          // 🔔 30-Minute Reminder
          const thirtyMinsBefore = new Date(startDateTime.getTime() - 30 * 60000);
          if (now >= thirtyMinsBefore && now < startDateTime && !notifiedReservations.has(res.id)) {
            toast.info("Parking Reminder", { description: `Slot ${res.slot_id} starts in 30 mins!` });
            
            await supabase.from("notifications").insert({
              user_id: res.user_id,
              title: "Upcoming Reservation",
              message: `Your booking for Slot ${res.slot_id} starts at ${res.start_time}.`,
              type: "urgent",
              read: false
            });
            setNotifiedReservations(prev => new Set(prev).add(res.id));
          }

          // 🚦 Update status to Occupied (Red) kapag oras na
          if (now >= startDateTime && now < endDateTime) {
            await supabase.from("parking_slots").update({ status: "occupied" }).eq("id", res.slot_id);
          } 
          // 🏁 Update status to Available (Green) kapag tapos na
          else if (now >= endDateTime) {
            await supabase.from("parking_slots").update({ status: "available" }).eq("id", res.slot_id);
            await supabase.from("reservations").update({ status: "completed" }).eq("id", res.id);
          }
        }
      } catch (err) { console.error(err); }
    }, 5000);
    return () => clearInterval(interval);
  }, [notifiedReservations]);

  return null;
}