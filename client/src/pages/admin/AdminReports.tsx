/*
 * iParkBayan — AdminReports (Real-time & Role-Based)
 * Design: Civic Tech / Filipino Urban Identity
 */
import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/supabaseClient";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Download, TrendingUp, TrendingDown, LayoutDashboard, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdminReports() {
  const [stats, setStats] = useState<any[]>([]);
  const [lotStats, setLotStats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userRole = localStorage.getItem("admin_role"); // 'super_admin' or 'manager'
  const userLotId = localStorage.getItem("admin_lot_id");

  useEffect(() => {
    fetchReportData();

    // Real-time listener: Update charts when a reservation is completed
    const channel = supabase
      .channel('reports-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reservations' }, () => {
        fetchReportData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchReportData = async () => {
    try {
      // 1. Kunin ang lahat ng completed reservations
      let query = supabase
        .from('reservations')
        .select(`
          id, total_amount, status, created_at, lot_id,
          parking_lots (name, type)
        `)
        .eq('status', 'completed');

      // Filter by Lot if regular admin
      if (userRole === 'manager' && userLotId) {
        query = query.eq('lot_id', userLotId);
      }

      const { data, error } = await query;
      if (error) throw error;

      processStats(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load real-time analytics.");
    } finally {
      setIsLoading(false);
    }
  };

  const processStats = (data: any[]) => {
    // Process Monthly Revenue for Chart
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyMap: any = {};
    months.forEach(m => monthlyMap[m] = 0);

    data.forEach(res => {
      const month = months[new Date(res.created_at).getMonth()];
      monthlyMap[month] += Number(res.total_amount || 0);
    });

    const chartData = months.map(m => ({ month: m, revenue: monthlyMap[m] }));
    setStats(chartData);

    // Process Lot-specific stats
    const lotMap: any = {};
    data.forEach(res => {
      const lotName = res.parking_lots?.name || "Unknown";
      if (!lotMap[lotName]) {
        lotMap[lotName] = { name: lotName, type: res.parking_lots?.type, bookings: 0, revenue: 0 };
      }
      lotMap[lotName].bookings += 1;
      lotMap[lotName].revenue += Number(res.total_amount || 0);
    });
    setLotStats(Object.values(lotMap));
  };

  // KPI Calculations
  const totalRevenue = lotStats.reduce((sum, lot) => sum + lot.revenue, 0);
  const totalBookings = lotStats.reduce((sum, lot) => sum + lot.bookings, 0);

  return (
    <AdminLayout title={userRole === 'super_admin' ? "System Analytics" : "Lot Analytics"}>
      <div className="space-y-6">
        
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Total Revenue" value={`₱${totalRevenue.toLocaleString()}`} change="+12%" up={true} />
          <KPICard label="Completed Bookings" value={totalBookings.toString()} change="+5%" up={true} />
          <KPICard label={userRole === 'super_admin' ? "Active Lots" : "Lot Status"} value={userRole === 'super_admin' ? lotStats.length.toString() : "Online"} change="Stable" up={true} />
          <KPICard label="Avg per Booking" value={`₱${totalBookings > 0 ? (totalRevenue / totalBookings).toFixed(0) : 0}`} change="+2%" up={true} />
        </div>

        {/* Monthly Revenue Chart (Real-time) */}
        <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-black text-slate-900">Revenue Performance</h3>
              <p className="text-xs text-muted-foreground">Real-time data from {userRole === 'super_admin' ? 'all branches' : 'your lot'}</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl border-slate-200" onClick={() => window.print()}>
              <Download size={14} className="mr-2" /> Export PDF
            </Button>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={stats}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => `₱${v}`} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                formatter={(v) => [`₱${v}`, "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#0f172a" strokeWidth={3} fill="url(#revenueGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown Table */}
        <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
            <MapPin size={20} className="text-primary" />
            {userRole === 'super_admin' ? "Revenue by Parking Lot" : "Your Lot Performance"}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-muted-foreground uppercase font-black tracking-widest border-b border-slate-100">
                  <th className="text-left pb-4">Parking Lot</th>
                  <th className="text-left pb-4">Lot Type</th>
                  <th className="text-left pb-4">Total Bookings</th>
                  <th className="text-right pb-4">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lotStats.map((lot) => (
                  <tr key={lot.name} className="group hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-bold text-slate-700">{lot.name}</td>
                    <td className="py-4">
                      <span className="text-[10px] font-black px-2 py-1 bg-slate-100 rounded-md uppercase">{lot.type}</span>
                    </td>
                    <td className="py-4 font-medium text-slate-600">{lot.bookings}</td>
                    <td className="py-4 text-right font-black text-emerald-600">₱{lot.revenue.toLocaleString()}</td>
                  </tr>
                ))}
                {lotStats.length === 0 && (
                  <tr><td colSpan={4} className="py-10 text-center text-muted-foreground italic">No completed transactions recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

// Sub-component para sa KPI Cards
function KPICard({ label, value, change, up }: any) {
  return (
    <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm transition-transform hover:scale-[1.02]">
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 leading-none mb-2">{value}</p>
      <div className={`flex items-center gap-1 text-[10px] font-bold ${up ? "text-emerald-600" : "text-rose-600"}`}>
        {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        <span>{change}</span>
      </div>
    </div>
  );
}