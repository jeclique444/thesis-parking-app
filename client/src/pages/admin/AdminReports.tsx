/*
 * iParkBayan — AdminReports (Real‑time & Role‑Based)
 * Dropdown controls visibility; export includes only visible reports.
 * Fixed TypeScript error; removed print buttons from popup.
 */
import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/supabaseClient";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  PieChart, Pie, Cell
} from "recharts";
import { Download, TrendingUp, TrendingDown, MapPin, Clock, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const COLORS = ["#0f172a", "#10b981", "#f59e0b"];

export default function AdminReports() {
  const [stats, setStats] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [lotStats, setLotStats] = useState<any[]>([]);
  const [walkInStats, setWalkInStats] = useState({ totalRevenue: 0, totalTransactions: 0 });
  const [composition, setComposition] = useState({ online: 0, walkin: 0 });
  const [dailyRevenue, setDailyRevenue] = useState<any[]>([]);
  const [topLots, setTopLots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewOption, setViewOption] = useState<string>("all");

  const userRole = localStorage.getItem("admin_role");
  const userLotId = localStorage.getItem("admin_lot_id");
  const isSuperAdmin = userRole === "superadmin" || userRole === "super_admin";

  // Refs for each report section
  const compositionRef = useRef<HTMLDivElement>(null);
  const dailyRef = useRef<HTMLDivElement>(null);
  const topLotsRef = useRef<HTMLDivElement>(null);
  const monthlyRef = useRef<HTMLDivElement>(null);
  const weeklyRef = useRef<HTMLDivElement>(null);
  const hourlyRef = useRef<HTMLDivElement>(null);
  const lotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSuperAdmin && viewOption === "toplots") {
      setViewOption("all");
    }
  }, [isSuperAdmin, viewOption]);

  useEffect(() => {
    fetchReportData();
    const channel = supabase
      .channel('reports-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchReportData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'walk_in_records' }, () => fetchReportData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      let reservationsQuery = supabase
        .from('reservations')
        .select(`
          id, total_amount, status, created_at, start_time, lot_id,
          parking_lots (name, type, total_slots)
        `);
      if (userRole === 'manager' && userLotId) {
        reservationsQuery = reservationsQuery.eq('lot_id', userLotId);
      }
      const { data: reservationsData, error: resError } = await reservationsQuery;
      if (resError) throw resError;

      let walkInQuery = supabase
        .from('walk_in_records')
        .select(`
          id, amount_paid, entry_time, slot_id,
          parking_slots (lot_id, parking_lots (id, name, type))
        `);
      if (userRole === 'manager' && userLotId) {
        walkInQuery = walkInQuery.eq('parking_slots.lot_id', userLotId);
      }
      const { data: walkInData, error: walkError } = await walkInQuery;
      if (walkError) throw walkError;

      processStats(reservationsData || [], walkInData || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load analytics data.");
    } finally {
      setIsLoading(false);
    }
  };

  const processStats = (reservations: any[], walkIns: any[]) => {
    // Walk‑in totals
    const walkInTotalRevenue = walkIns.reduce((sum, w) => sum + (w.amount_paid || 0), 0);
    const walkInTotalTransactions = walkIns.length;
    setWalkInStats({ totalRevenue: walkInTotalRevenue, totalTransactions: walkInTotalTransactions });

    // Revenue composition
    const onlineTotal = reservations.filter(r => r.status === 'completed').reduce((sum, r) => sum + (r.total_amount || 0), 0);
    setComposition({ online: onlineTotal, walkin: walkInTotalRevenue });

    // Monthly revenue
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyMap: any = {};
    months.forEach(m => monthlyMap[m] = { online: 0, walkin: 0 });
    reservations.filter(r => r.status === 'completed').forEach(r => {
      const month = months[new Date(r.created_at).getMonth()];
      monthlyMap[month].online += Number(r.total_amount || 0);
    });
    walkIns.forEach(w => {
      const month = months[new Date(w.entry_time).getMonth()];
      monthlyMap[month].walkin += Number(w.amount_paid || 0);
    });
    setStats(months.map(m => ({
      month: m,
      online: monthlyMap[m].online,
      walkin: monthlyMap[m].walkin,
      total: monthlyMap[m].online + monthlyMap[m].walkin
    })));

    // Weekly occupancy
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyMap: any = {};
    days.forEach(d => weeklyMap[d] = 0);
    reservations.forEach(r => {
      const day = days[new Date(r.created_at).getDay()];
      weeklyMap[day] += 1;
    });
    const maxExpected = 20;
    setWeeklyData(days.map(d => ({
      day: d,
      occupancy: Math.min(Math.round((weeklyMap[d] / maxExpected) * 100), 100)
    })));

    // Hourly pattern
    const hourlyMap: any = {};
    for (let i = 7; i <= 18; i++) hourlyMap[i] = 0;
    reservations.forEach(r => {
      if (r.start_time) {
        const hour = parseInt(r.start_time.split(':')[0]);
        const isPM = r.start_time.includes('PM');
        const standardHour = (isPM && hour !== 12) ? hour + 12 : (!isPM && hour === 12 ? 0 : hour);
        if (hourlyMap[standardHour] !== undefined) hourlyMap[standardHour] += 1;
      }
    });
    setHourlyData(Object.keys(hourlyMap).map(h => ({
      hour: `${h}:00`,
      pattern: Math.min(hourlyMap[h] * 15, 100)
    })));

    // Daily revenue (last 7 days)
    const dailyMap: any = {};
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();
    last7.forEach(day => dailyMap[day] = { online: 0, walkin: 0 });
    reservations.filter(r => r.status === 'completed').forEach(r => {
      const day = r.created_at.split('T')[0];
      if (dailyMap[day]) dailyMap[day].online += Number(r.total_amount || 0);
    });
    walkIns.forEach(w => {
      const day = w.entry_time.split('T')[0];
      if (dailyMap[day]) dailyMap[day].walkin += Number(w.amount_paid || 0);
    });
    setDailyRevenue(last7.map(day => ({
      date: day.slice(5),
      online: dailyMap[day]?.online || 0,
      walkin: dailyMap[day]?.walkin || 0,
      total: (dailyMap[day]?.online || 0) + (dailyMap[day]?.walkin || 0)
    })));

    // Lot performance
    const lotMap: any = {};
    const getLotInfoFromWalkIn = (w: any) => w.parking_slots?.parking_lots;
    reservations.filter(r => r.status === 'completed').forEach(r => {
      const lotName = r.parking_lots?.name || "Unknown";
      if (!lotMap[lotName]) lotMap[lotName] = {
        name: lotName,
        type: r.parking_lots?.type || "unknown",
        onlineBookings: 0,
        onlineRevenue: 0,
        walkinBookings: 0,
        walkinRevenue: 0,
      };
      lotMap[lotName].onlineBookings += 1;
      lotMap[lotName].onlineRevenue += Number(r.total_amount || 0);
    });
    walkIns.forEach(w => {
      const lotInfo = getLotInfoFromWalkIn(w);
      if (!lotInfo) return;
      const lotName = lotInfo.name;
      if (!lotMap[lotName]) lotMap[lotName] = {
        name: lotName,
        type: lotInfo.type,
        onlineBookings: 0,
        onlineRevenue: 0,
        walkinBookings: 0,
        walkinRevenue: 0,
      };
      lotMap[lotName].walkinBookings += 1;
      lotMap[lotName].walkinRevenue += w.amount_paid || 0;
    });
    const lotArray = Object.values(lotMap);
    setLotStats(lotArray);
    setTopLots([...lotArray].sort((a: any, b: any) => (b.onlineRevenue + b.walkinRevenue) - (a.onlineRevenue + a.walkinRevenue)).slice(0, 5));
  };

  // Fixed type: accept RefObject with possible null
  const buildWrapper = (refs: (React.RefObject<HTMLDivElement | null> | null)[]) => {
    const wrapper = document.createElement("div");
    wrapper.className = "print-wrapper";
    refs.forEach(ref => {
      if (ref?.current) {
        wrapper.appendChild(ref.current.cloneNode(true));
      }
    });
    return wrapper;
  };

  const handleExportPDF = () => {
    let content: HTMLElement | null = null;
    let title = "ParKada_Report";

    switch (viewOption) {
      case "composition":
        content = compositionRef.current ? compositionRef.current.cloneNode(true) as HTMLElement : null;
        title = "Revenue_Composition_Report";
        break;
      case "daily":
        content = dailyRef.current ? dailyRef.current.cloneNode(true) as HTMLElement : null;
        title = "Daily_Revenue_Report";
        break;
      case "toplots":
        if (isSuperAdmin) {
          content = topLotsRef.current ? topLotsRef.current.cloneNode(true) as HTMLElement : null;
          title = "Top_Lots_Report";
        }
        break;
      case "monthly":
        content = monthlyRef.current ? monthlyRef.current.cloneNode(true) as HTMLElement : null;
        title = "Monthly_Revenue_Report";
        break;
      case "weekly":
        content = weeklyRef.current ? weeklyRef.current.cloneNode(true) as HTMLElement : null;
        title = "Weekly_Occupancy_Report";
        break;
      case "hourly":
        content = hourlyRef.current ? hourlyRef.current.cloneNode(true) as HTMLElement : null;
        title = "Hourly_Pattern_Report";
        break;
      case "lots":
        content = lotRef.current ? lotRef.current.cloneNode(true) as HTMLElement : null;
        title = "Lot_Performance_Report";
        break;
      case "all":
      default:
        content = buildWrapper([
          compositionRef, dailyRef, isSuperAdmin ? topLotsRef : null,
          monthlyRef, weeklyRef, hourlyRef, lotRef
        ]);
        title = "All_Reports";
        break;
    }

    if (!content) {
      toast.error("No content to export.");
      return;
    }

    const originalTitle = document.title;
    document.title = title;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Popup blocked. Please allow popups for this site.");
      return;
    }

    const styles = document.querySelector('link[rel="stylesheet"]')?.outerHTML || '';
    // Print-friendly CSS – removed the action buttons
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          ${styles}
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; margin: 0; background: white; }
            @media print {
              body { margin: 0; padding: 0; }
            }
            .print-wrapper { margin: 0 auto; }
            .report-card { margin-bottom: 30px; break-inside: avoid; }
            h3 { color: #0f172a; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 700; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .no-print { display: none; }
          </style>
        </head>
        <body>
          ${content.outerHTML}
          <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #94a3b8;">
            Generated by ParKada Reports • ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();

    document.title = originalTitle;
  };

  const totalRevenue = lotStats.reduce((sum: number, lot: any) => sum + lot.onlineRevenue + lot.walkinRevenue, 0);
  const totalBookings = lotStats.reduce((sum: number, lot: any) => sum + lot.onlineBookings + lot.walkinBookings, 0);
  const walkInTotal = walkInStats.totalRevenue;

  if (isLoading) {
    return (
      <AdminLayout title="Analytics">
        <div className="flex justify-center items-center h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  const showSection = (section: string) => viewOption === "all" || viewOption === section;
  const showTopLots = isSuperAdmin && showSection("toplots");

  return (
    <AdminLayout title={isSuperAdmin ? "System Analytics" : "Lot Analytics"}>
      <div className="space-y-6 pb-10">
        
        {/* Control Bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-primary" />
            <span className="text-sm font-bold">Show report:</span>
            <select
              value={viewOption}
              onChange={(e) => setViewOption(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Reports</option>
              <option value="composition">Revenue Composition</option>
              <option value="daily">Daily Revenue</option>
              {isSuperAdmin && <option value="toplots">Top 5 Lots</option>}
              <option value="monthly">Monthly Revenue</option>
              <option value="weekly">Weekly Occupancy</option>
              <option value="hourly">Hourly Pattern</option>
              <option value="lots">Lot Performance</option>
            </select>
          </div>
          <Button onClick={handleExportPDF} className="rounded-xl gap-2">
            <Download size={16} /> Export PDF
          </Button>
        </div>

        {/* KPI Cards (always visible) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Total Revenue" value={`₱${totalRevenue.toLocaleString()}`} change="+12%" up />
          <KPICard label="Completed Bookings" value={totalBookings.toString()} change="+5%" up />
          <KPICard label="Walk‑in Revenue" value={`₱${walkInTotal.toLocaleString()}`} change="+8%" up />
          <KPICard label="Avg per Booking" value={`₱${totalBookings > 0 ? (totalRevenue / totalBookings).toFixed(0) : 0}`} change="+2%" up />
        </div>

        {/* Revenue Composition */}
        {showSection("composition") && (
          <div ref={compositionRef} className="bg-white rounded-2xl p-5 border shadow-sm">
            <h3 className="text-lg font-black mb-2">Revenue Composition</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={[{ name: "Online", value: composition.online }, { name: "Walk‑in", value: composition.walkin }]} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={90} label>
                  <Cell fill={COLORS[0]} />
                  <Cell fill={COLORS[1]} />
                </Pie>
                <Tooltip formatter={(v) => `₱${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Daily Revenue */}
        {showSection("daily") && (
          <div ref={dailyRef} className="bg-white rounded-2xl p-5 border shadow-sm">
            <h3 className="text-lg font-black mb-2">Daily Revenue (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={dailyRevenue}>
                <defs><linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0f172a" stopOpacity={0.1}/><stop offset="95%" stopColor="#0f172a" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => `₱${v/1000}k`} />
                <Tooltip formatter={(v) => `₱${v.toLocaleString()}`} />
                <Area type="monotone" dataKey="total" stroke="#0f172a" fill="url(#dailyGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top 5 Lots */}
        {showTopLots && (
          <div ref={topLotsRef} className="bg-white rounded-2xl p-5 border shadow-sm">
            <h3 className="text-lg font-black mb-4">Top 5 Parking Lots by Revenue</h3>
            <div className="space-y-3">
              {topLots.map((lot: any, i: number) => {
                const maxRevenue = topLots[0]?.onlineRevenue + topLots[0]?.walkinRevenue || 1;
                const percent = ((lot.onlineRevenue + lot.walkinRevenue) / maxRevenue) * 100;
                return (
                  <div key={lot.name} className="flex items-center gap-3">
                    <span className="w-6 text-sm font-bold text-primary">{i+1}</span>
                    <span className="flex-1 font-medium">{lot.name}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="text-sm font-bold">₱{(lot.onlineRevenue + lot.walkinRevenue).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Monthly Revenue */}
        {showSection("monthly") && (
          <div ref={monthlyRef} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 leading-tight">Monthly Revenue Performance</h3>
            <p className="text-xs text-muted-foreground mb-6">Online reservations + Walk‑in cash transactions</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats} stackOffset="sign">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${v/1000}k`} />
                <Tooltip formatter={(value, name) => [`₱${value.toLocaleString()}`, name === 'online' ? 'Online' : 'Walk‑in']} />
                <Bar dataKey="online" name="Online" fill="#0f172a" radius={[6, 0, 0, 0]} />
                <Bar dataKey="walkin" name="Walk‑in" fill="#10b981" radius={[0, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Weekly & Hourly */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {showSection("weekly") && (
            <div ref={weeklyRef} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
                <Calendar size={16} className="text-primary" /> Weekly Occupancy (%)
              </h3>
              <p className="text-[10px] text-muted-foreground mb-6">Based on online reservations</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="occupancy" fill="#0f172a" radius={[6, 6, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {showSection("hourly") && (
            <div ref={hourlyRef} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
                <Clock size={16} className="text-emerald-500" /> Hourly Occupancy Pattern
              </h3>
              <p className="text-[10px] text-muted-foreground mb-6">Based on online reservations</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} hide />
                  <Tooltip />
                  <Line type="monotone" dataKey="pattern" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Lot Performance Table */}
        {showSection("lots") && (
          <div ref={lotRef} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <MapPin size={20} className="text-primary" />
              {isSuperAdmin ? "Revenue by Parking Lot" : "Your Lot Performance"}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-muted-foreground uppercase font-black tracking-widest border-b border-slate-100">
                    <th className="text-left pb-4">Parking Lot</th>
                    <th className="text-left pb-4">Lot Type</th>
                    <th className="text-center pb-4">Online Bookings</th>
                    <th className="text-center pb-4">Walk‑in Transactions</th>
                    <th className="text-right pb-4">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lotStats.map((lot: any) => (
                    <tr key={lot.name} className="group hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-bold text-slate-700">{lot.name}</td>
                      <td className="py-4">
                        <span className="text-[10px] font-black px-2 py-1 bg-slate-100 rounded-md uppercase">{lot.type}</span>
                      </td>
                      <td className="py-4 text-center font-medium text-slate-600">{lot.onlineBookings}</td>
                      <td className="py-4 text-center font-medium text-slate-600">{lot.walkinBookings}</td>
                      <td className="py-4 text-right font-black text-emerald-600">
                        ₱{(lot.onlineRevenue + lot.walkinRevenue).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function KPICard({ label, value, change, up }: any) {
  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm transition-transform hover:scale-[1.02]">
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 leading-none mb-2">{value}</p>
      <div className={`flex items-center gap-1 text-[10px] font-bold ${up ? "text-emerald-600" : "text-rose-600"}`}>
        {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        <span>{change}</span>
      </div>
    </div>
  );
}
