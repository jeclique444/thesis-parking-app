/*
 * iParkBayan — AdminReservations (Added Booked Status & Cross-Midnight Fix)
 * Fixed: Time display in 12‑hour format, fine calculation uses actual timestamps.
 * Added: Pagination (Load More) + manual refresh button.
 * Added: Date filters (Today, Last 7 days, Last 30 days, Custom) + Print PDF report.
 * Layout: Stats cards on top, then filter row.
 */
import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/supabaseClient";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, XCircle, Clock, Search, CalendarDays, AlertTriangle, Coins, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PENALTY_RATE_PER_HOUR = 50;
const PAGE_SIZE = 20;

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  booked: "bg-indigo-100 text-indigo-700 border-indigo-200",
  active: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

const format12HourTime = (dateInput: Date | string | null): string => {
  if (!dateInput) return "--:--";
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return "--:--";
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const minuteStr = minutes.toString().padStart(2, "0");
  return `${hours}:${minuteStr} ${ampm}`;
};

export default function AdminReservations() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "custom">("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const userRole = localStorage.getItem("admin_role");
  const userLotId = localStorage.getItem("admin_lot_id");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchReservations(true);
  }, [dateFilter, customStart, customEnd]);

  useEffect(() => {
    fetchReservations(true);
    const channel = supabase
      .channel('admin-res-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchReservations(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const applyDateFilters = (query: any) => {
    const now = new Date();
    if (dateFilter === "today") {
      const start = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const end = new Date(now.setHours(23, 59, 59, 999)).toISOString();
      return query.gte("created_at", start).lte("created_at", end);
    } else if (dateFilter === "week") {
      const start = new Date(now.setDate(now.getDate() - 7)).toISOString();
      return query.gte("created_at", start);
    } else if (dateFilter === "month") {
      const start = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
      return query.gte("created_at", start);
    } else if (dateFilter === "custom" && customStart && customEnd) {
      const start = new Date(customStart).toISOString();
      const end = new Date(customEnd + "T23:59:59").toISOString();
      return query.gte("created_at", start).lte("created_at", end);
    }
    return query;
  };

  const getBaseQuery = () => {
    let query = supabase
      .from('reservations')
      .select(`*, parking_lots (name), parking_slots (label)`)
      .order('created_at', { ascending: false });
    if (userRole === 'manager' && userLotId) {
      query = query.eq('lot_id', userLotId);
    }
    query = applyDateFilters(query);
    return query;
  };

  const fetchReservations = async (reset = false) => {
    if (reset) {
      setIsRefreshing(true);
      setPage(0);
      setHasMore(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const currentPage = reset ? 0 : page;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = getBaseQuery().range(from, to);
      const { data, error } = await query;
      if (error) throw error;

      const formattedData = (data || []).map((res: any) => ({
        id: res.id,
        shortId: res.id.substring(0, 8).toUpperCase(),
        lotName: res.parking_lots?.name || "Unknown Lot",
        slotLabel: res.parking_slots?.label || "N/A",
        createdAt: res.created_at,
        startTime: res.start_time,
        endTime: res.end_time,
        totalPrice: res.total_amount || 0,
        status: res.status || 'pending',
        slotId: res.slot_id,
      }));

      if (reset) {
        setReservations(formattedData);
      } else {
        setReservations(prev => [...prev, ...formattedData]);
      }

      setHasMore((data?.length || 0) === PAGE_SIZE);
      if (!reset) setPage(prev => prev + 1);
    } catch (error: any) {
      toast.error("Failed to fetch reservations.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!isLoadingMore && hasMore && !isRefreshing) {
      fetchReservations(false);
    }
  };

  const manualRefresh = () => {
    if (!isRefreshing) {
      fetchReservations(true);
    }
  };

  const calculateFine = (reservation: any): number => {
    if (reservation.status !== 'active') return 0;
    if (!reservation.startTime || !reservation.endTime) return 0;
    const end = new Date(reservation.endTime);
    const now = currentTime;
    if (now <= end) return 0;
    const diffMs = now.getTime() - end.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.ceil(diffHours * PENALTY_RATE_PER_HOUR);
  };

  const updateReservationStatus = async (res: any, newStatus: string) => {
    const fine = calculateFine(res);
    const finalAmount = Number(res.totalPrice) + fine;

    try {
      const { error: resError } = await supabase
        .from('reservations')
        .update({ 
          status: newStatus,
          total_amount: finalAmount 
        })
        .eq('id', res.id);
      if (resError) throw resError;

      let slotStatus = 'available';
      if (newStatus === 'active' || newStatus === 'pending' || newStatus === 'booked') slotStatus = 'reserved';
      await supabase.from('parking_slots').update({ status: slotStatus }).eq('id', res.slotId);

      toast.success(fine > 0 ? `Completed with ₱${fine} fine!` : `Marked as ${newStatus}`);
      fetchReservations(true);
    } catch (error: any) {
      toast.error("Update failed.");
    }
  };

  const handleApprove = (res: any) => {
    const now = currentTime;
    const start = new Date(res.startTime);
    const newStatus = now < start ? 'booked' : 'active';
    updateReservationStatus(res, newStatus);
  };

  const checkIsOverstaying = (res: any) => calculateFine(res) > 0;

  const filteredReservations = reservations.filter(res => 
    res.shortId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    res.lotName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = reservations.filter(r => r.status === 'pending').length;
  const activeCount = reservations.filter(r => r.status === 'active').length;
  const overstayCount = reservations.filter(r => checkIsOverstaying(r)).length;

  const handlePrint = async () => {
    try {
      let query = getBaseQuery();
      const { data, error } = await query;
      if (error) throw error;

      const records = data || [];
      const totalRevenue = records.reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);
      const completedCount = records.filter((r: any) => r.status === 'completed').length;
      const activeCountAll = records.filter((r: any) => r.status === 'active').length;
      const pendingCountAll = records.filter((r: any) => r.status === 'pending').length;

      const getDateRangeText = () => {
        if (dateFilter === "today") return "Today";
        if (dateFilter === "week") return "Last 7 days";
        if (dateFilter === "month") return "Last 30 days";
        if (dateFilter === "custom" && customStart && customEnd) {
          return `${customStart} to ${customEnd}`;
        }
        return "All time";
      };

      const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>ParKada Reservations Report</title>
          <style>
            body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; margin: 2rem; padding: 0; }
            .report-header { text-align: center; margin-bottom: 1.5rem; border-bottom: 2px solid #2c3e50; padding-bottom: 0.5rem; }
            .report-header h1 { font-size: 24pt; margin: 0; }
            .report-header p { margin: 0.25rem 0; font-size: 10pt; color: #555; }
            .stats-cards { display: flex; gap: 1rem; margin-bottom: 2rem; justify-content: space-between; }
            .stat-card { flex: 1; border: 1px solid #ddd; padding: 0.75rem; text-align: center; border-radius: 12px; background: #f9f9f9; }
            .stat-card h3 { font-size: 20pt; margin: 0; }
            .stat-card p { margin: 0; font-size: 9pt; color: #666; }
            .print-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 1rem; }
            .print-table th, .print-table td { border: 1px solid #aaa; padding: 6px 8px; text-align: left; vertical-align: top; }
            .print-table th { background-color: #2c3e50; color: white; font-weight: 600; }
            .print-table tr:nth-child(even) td { background-color: #f9f9f9; }
            .report-footer { margin-top: 1rem; text-align: center; font-size: 8pt; color: #777; border-top: 1px solid #ccc; padding-top: 0.5rem; }
          </style>
        </head>
        <body>
          <div class="report-header">
            <h1>ParKada Reservations Report</h1>
            <p>Period: ${getDateRangeText()}</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>
          <div class="stats-cards">
            <div class="stat-card"><h3>${records.length}</h3><p>Total</p></div>
            <div class="stat-card"><h3>${pendingCountAll}</h3><p>Pending</p></div>
            <div class="stat-card"><h3>${activeCountAll}</h3><p>Active</p></div>
            <div class="stat-card"><h3>${completedCount}</h3><p>Completed</p></div>
            <div class="stat-card"><h3>₱${totalRevenue.toFixed(2)}</h3><p>Revenue</p></div>
          </div>
          <table class="print-table">
            <thead>
              <tr><th>Booking ID</th><th>Location & Slot</th><th>Date</th><th>Time</th><th>Fine</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${records.map((res: any) => {
                const lotName = res.parking_lots?.name || "Unknown Lot";
                const slotLabel = res.parking_slots?.label || "N/A";
                const dateFormatted = res.created_at ? new Date(res.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "N/A";
                const startTimeFormatted = format12HourTime(res.start_time);
                const endTimeFormatted = format12HourTime(res.end_time);
                return `
                  <tr>
                    <td>#${res.id.substring(0, 8).toUpperCase()}</td>
                    <td><strong>${lotName}</strong><br/>Slot: ${slotLabel}</td>
                    <td>${dateFormatted}</td>
                    <td>${startTimeFormatted} – ${endTimeFormatted}</td>
                    <td>—</td>
                    <td style="text-transform:capitalize">${res.status}</td>
                  </tr>
                `;
              }).join('')}
              ${records.length === 0 ? '<tr><td colspan="6" style="text-align:center">No reservations found for the selected period.</td></tr>' : ''}
            </tbody>
          </table>
          <div class="report-footer">ParKada Parking Management System – Official Reservations Record</div>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(reportHtml);
        printWindow.document.close();
        printWindow.print();
      } else {
        toast.error('Unable to open print window. Please allow pop-ups.');
      }
    } catch (err: any) {
      toast.error("Failed to prepare report.");
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Reservations">
        <div className="flex justify-center items-center h-[60vh]">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Reservations">
      <div className="space-y-6">
        {/* Stats cards - at the very top */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-2xl border flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-full text-primary"><CalendarDays size={20} /></div>
            <div><p className="text-2xl font-bold">{reservations.length}</p><p className="text-xs text-muted-foreground uppercase font-black">Total</p></div>
          </div>
          <div className="bg-white p-4 rounded-2xl border flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-full text-amber-600"><Clock size={20} /></div>
            <div><p className="text-2xl font-bold">{pendingCount}</p><p className="text-xs text-muted-foreground uppercase font-black">Pending</p></div>
          </div>
          <div className="bg-white p-4 rounded-2xl border flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600"><CheckCircle size={20} /></div>
            <div><p className="text-2xl font-bold">{activeCount}</p><p className="text-xs text-muted-foreground uppercase font-black">Active</p></div>
          </div>
          <div className="bg-white p-4 rounded-2xl border flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-full text-emerald-600"><CheckCircle size={20} /></div>
            <div><p className="text-2xl font-bold">{reservations.filter(r => r.status === 'completed').length}</p><p className="text-xs text-muted-foreground uppercase font-black">Completed</p></div>
          </div>
          <div className={cn("p-4 rounded-2xl border flex items-center gap-4 transition-all", overstayCount > 0 ? "bg-rose-50 border-rose-200" : "bg-white")}>
            <div className={cn("p-3 rounded-full", overstayCount > 0 ? "bg-rose-600 text-white" : "bg-slate-100")}><AlertTriangle size={20} /></div>
            <div><p className={cn("text-2xl font-bold", overstayCount > 0 ? "text-rose-600" : "")}>{overstayCount}</p><p className="text-xs text-muted-foreground uppercase font-black">Overstaying</p></div>
          </div>
        </div>

        {/* Date filter row + Print + Refresh */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1">
              {["today", "week", "month", "custom"].map((f) => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f as any)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-full capitalize",
                    dateFilter === f ? "bg-primary text-white" : "text-muted-foreground hover:bg-slate-200"
                  )}
                >
                  {f === "today" ? "Today" : f === "week" ? "Last 7 days" : f === "month" ? "Last 30 days" : "Custom"}
                </button>
              ))}
            </div>
            {dateFilter === "custom" && (
              <div className="flex gap-2 items-center">
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-36 h-9 text-sm" />
                <span>–</span>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-36 h-9 text-sm" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePrint} variant="outline" size="sm" className="rounded-xl gap-2">
              <Printer size={14} /> Export Records
            </Button>
            <Button variant="outline" size="sm" onClick={manualRefresh} disabled={isRefreshing} className="rounded-xl">
              <RefreshCw size={14} className={cn("mr-2", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Main table section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold">Reservation Records</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-9 pr-4 py-2 bg-muted/30 border rounded-xl text-sm" 
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b uppercase font-black">
                  <th className="text-left pb-3">Booking ID</th>
                  <th className="text-left pb-3">Location & Slot</th>
                  <th className="text-left pb-3">Date</th>
                  <th className="text-left pb-3">Time</th>
                  <th className="text-left pb-3 text-rose-600">Fine</th>
                  <th className="text-left pb-3">Status</th>
                  <th className="text-right pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredReservations.map((res) => {
                  const fine = calculateFine(res);
                  const isOverstaying = fine > 0;
                  const startTimeFormatted = format12HourTime(res.startTime);
                  const endTimeFormatted = format12HourTime(res.endTime);
                  const dateFormatted = res.createdAt ? new Date(res.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  }) : "N/A";

                  return (
                    <tr key={res.id} className={cn("hover:bg-muted/30 transition-colors", isOverstaying && "bg-rose-50/50")}>
                      <td className="py-4 font-mono text-xs">#{res.shortId}</td>
                      <td className="py-4">
                        <p className="font-bold">{res.lotName}</p>
                        <p className="text-[10px] text-primary font-black uppercase">Slot: {res.slotLabel}</p>
                      </td>
                      <td className="py-4 text-xs font-semibold text-slate-700">{dateFormatted}</td>
                      <td className="py-4 text-xs">
                        <p>{startTimeFormatted}</p>
                        <p className={cn("font-bold", isOverstaying ? "text-rose-600" : "text-muted-foreground")}>to {endTimeFormatted}</p>
                      </td>
                      <td className="py-4 font-bold">{fine > 0 ? <span className="text-rose-600">+₱{fine}</span> : "-"}</td>
                      <td className="py-4">
                        <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border", isOverstaying ? "bg-rose-600 text-white" : statusStyles[res.status])}>
                          {isOverstaying ? "OVERSTAYING" : res.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {res.status === 'pending' && (
                            <Button size="sm" className="h-8 bg-blue-600 text-white rounded-lg" onClick={() => handleApprove(res)}>Approve</Button>
                          )}
                          {res.status === 'booked' && (
                            <Button size="sm" className="h-8 bg-indigo-600 text-white rounded-lg" onClick={() => updateReservationStatus(res, 'active')}>Set Active</Button>
                          )}
                          {(res.status === 'pending' || res.status === 'active' || res.status === 'booked') && (
                            <Button variant="outline" size="sm" className="h-8 text-rose-600 rounded-lg" onClick={() => window.confirm("Cancel?") && updateReservationStatus(res, 'cancelled')}>
                              <XCircle size={14} className="mr-1" /> Cancel
                            </Button>
                          )}
                          {res.status === 'active' && (
                            <Button size="sm" className={cn("h-8 rounded-lg text-white font-bold", isOverstaying ? "bg-rose-600" : "bg-emerald-600")} onClick={() => updateReservationStatus(res, 'completed')}>
                              {isOverstaying ? <Coins size={14} className="mr-1" /> : <CheckCircle size={14} className="mr-1" />}
                              {isOverstaying ? "Collect & Complete" : "Complete"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button variant="outline" onClick={loadMore} disabled={isLoadingMore || isRefreshing} className="rounded-xl">
                {isLoadingMore && <RefreshCw size={14} className="mr-2 animate-spin" />}
                {isLoadingMore ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}