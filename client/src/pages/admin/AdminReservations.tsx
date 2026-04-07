/*
 * iParkBayan — AdminReservations (Added Booked Status & Cross-Midnight Fix)
 */
import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/supabaseClient";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, XCircle, Clock, Search, CalendarDays, AlertTriangle, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PENALTY_RATE_PER_HOUR = 50; 

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  booked: "bg-indigo-100 text-indigo-700 border-indigo-200", // IBINALIK NATIN ANG BOOKED STATUS
  active: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function AdminReservations() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  const userRole = localStorage.getItem("admin_role");
  const userLotId = localStorage.getItem("admin_lot_id");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchReservations();
    const channel = supabase
      .channel('admin-res-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        fetchReservations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchReservations = async () => {
    setIsRefreshing(true);
    try {
      let query = supabase
        .from('reservations')
        .select(`*, parking_lots (name), parking_slots (label)`)
        .order('created_at', { ascending: false });

      if (userRole === 'manager' && userLotId) {
        query = query.eq('lot_id', userLotId);
      }

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
        slotId: res.slot_id
      }));

      setReservations(formattedData);
    } catch (error: any) {
      toast.error("Failed to fetch reservations.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const calculateFine = (startTimeStr: string, endTimeStr: string, status: string, createdAt: string) => {
    if (status.toLowerCase() !== 'active') return 0;
    if (!startTimeStr || !endTimeStr || !createdAt) return 0;
    
    const [startT, startMod] = startTimeStr.split(' ');
    let [startH, startM] = startT.split(':').map(Number);
    if (startMod === 'PM' && startH < 12) startH += 12;
    if (startMod === 'AM' && startH === 12) startH = 0;

    const [endT, endMod] = endTimeStr.split(' ');
    let [endH, endM] = endT.split(':').map(Number);
    if (endMod === 'PM' && endH < 12) endH += 12;
    if (endMod === 'AM' && endH === 12) endH = 0;

    const end = new Date(createdAt);
    end.setHours(endH, endM, 0, 0);

    if (endH < startH || (endH === startH && endM < startM)) {
      end.setDate(end.getDate() + 1);
    }
    
    if (currentTime <= end) return 0;

    const diffInMs = currentTime.getTime() - end.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    return Math.ceil(diffInHours * PENALTY_RATE_PER_HOUR);
  };

  const updateReservationStatus = async (res: any, newStatus: string) => {
    const fine = calculateFine(res.startTime, res.endTime, res.status, res.createdAt);
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
      // Kasama na ang booked sa pag-hold/reserve ng slot para hindi ma-double book
      if (newStatus === 'active' || newStatus === 'pending' || newStatus === 'booked') slotStatus = 'reserved';
      
      await supabase.from('parking_slots').update({ status: slotStatus }).eq('id', res.slotId);

      toast.success(fine > 0 ? `Completed with ₱${fine} fine!` : `Marked as ${newStatus}`);
      fetchReservations();
    } catch (error: any) {
      toast.error("Update failed.");
    }
  };

  // BAGONG FUNCTION PARA SA APPROVAL LOGIC
  const handleApprove = (res: any) => {
    if (!res.startTime || !res.createdAt) {
      updateReservationStatus(res, 'active');
      return;
    }

    const [startT, startMod] = res.startTime.split(' ');
    let [startH, startM] = startT.split(':').map(Number);
    if (startMod === 'PM' && startH < 12) startH += 12;
    if (startMod === 'AM' && startH === 12) startH = 0;

    const startDateTime = new Date(res.createdAt);
    startDateTime.setHours(startH, startM, 0, 0);

    // KUNG FUTURE PA ANG START TIME = BOOKED. KUNG PAST O PRESENT NA = ACTIVE.
    const newStatus = currentTime < startDateTime ? 'booked' : 'active';
    updateReservationStatus(res, newStatus);
  };

  const checkIsOverstaying = (startTimeStr: string, endTimeStr: string, status: string, createdAt: string) => {
    return calculateFine(startTimeStr, endTimeStr, status, createdAt) > 0;
  };

  const filteredReservations = reservations.filter(res => 
    res.shortId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    res.lotName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = reservations.filter(r => r.status === 'pending').length;
  const activeCount = reservations.filter(r => r.status === 'active').length;
  const overstayCount = reservations.filter(r => checkIsOverstaying(r.startTime, r.endTime, r.status, r.createdAt)).length;

  return (
    <AdminLayout title="Reservations">
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <div className={cn("p-4 rounded-2xl border flex items-center gap-4 transition-all", overstayCount > 0 ? "bg-rose-50 border-rose-200 animate-pulse" : "bg-white")}>
            <div className={cn("p-3 rounded-full", overstayCount > 0 ? "bg-rose-600 text-white" : "bg-slate-100")}><AlertTriangle size={20} /></div>
            <div><p className={cn("text-2xl font-bold", overstayCount > 0 ? "text-rose-600" : "")}>{overstayCount}</p><p className="text-xs text-muted-foreground uppercase font-black">Overstaying</p></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold">Reservation Records</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 bg-muted/30 border rounded-xl text-sm" />
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
                  const fine = calculateFine(res.startTime, res.endTime, res.status, res.createdAt);
                  const isOverstaying = fine > 0;
                  return (
                    <tr key={res.id} className={cn("hover:bg-muted/30 transition-colors", isOverstaying && "bg-rose-50/50")}>
                      <td className="py-4 font-mono text-xs">#{res.shortId}</td>
                      <td className="py-4">
                        <p className="font-bold">{res.lotName}</p>
                        <p className="text-[10px] text-primary font-black uppercase">Slot: {res.slotLabel}</p>
                      </td>
                      
                      <td className="py-4 text-xs font-semibold text-slate-700">
                        {res.createdAt ? new Date(res.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : "N/A"}
                      </td>

                      <td className="py-4 text-xs">
                        <p>{res.startTime}</p>
                        <p className={cn("font-bold", isOverstaying ? "text-rose-600" : "text-muted-foreground")}>to {res.endTime}</p>
                      </td>

                      <td className="py-4 font-bold">{fine > 0 ? <span className="text-rose-600">+₱{fine}</span> : "-"}</td>
                      <td className="py-4">
                        <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border", isOverstaying ? "bg-rose-600 text-white" : statusStyles[res.status])}>
                          {isOverstaying ? "OVERSTAYING" : res.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* BINAGO ANG ONCLICK PARA TUMAWAG SA handleApprove */}
                          {res.status === 'pending' && (
                            <Button size="sm" className="h-8 bg-blue-600 text-white rounded-lg" onClick={() => handleApprove(res)}>
                              Approve
                            </Button>
                          )}
                          
                          {/* DAGDAG: KUNG BOOKED NA, MAY BUTTON PARA GAWING ACTIVE KAPAG DUMATING NA */}
                          {res.status === 'booked' && (
                            <Button size="sm" className="h-8 bg-indigo-600 text-white rounded-lg" onClick={() => updateReservationStatus(res, 'active')}>
                              Set Active
                            </Button>
                          )}

                          {/* KASAMA NA ANG BOOKED SA MGA PWEDENG I-CANCEL */}
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
        </div>
      </div>
    </AdminLayout>
  );
} 