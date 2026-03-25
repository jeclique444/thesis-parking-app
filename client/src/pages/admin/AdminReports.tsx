/*
 * iParkBayan — AdminReports
 * Design: Civic Tech / Filipino Urban Identity
 */
import AdminLayout from "@/components/AdminLayout";
import { adminStats, parkingLots, mockReservations } from "@/lib/data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weeklyData = adminStats.weeklyOccupancy.map((v, i) => ({ day: weekDays[i], occupancy: v, revenue: v * 12 }));

const monthlyRevenue = [
  { month: "Jan", revenue: 8400 }, { month: "Feb", revenue: 9200 }, { month: "Mar", revenue: 7800 },
  { month: "Apr", revenue: 11200 }, { month: "May", revenue: 10500 }, { month: "Jun", revenue: 12800 },
  { month: "Jul", revenue: 13400 }, { month: "Aug", revenue: 11900 }, { month: "Sep", revenue: 14200 },
  { month: "Oct", revenue: 15600 }, { month: "Nov", revenue: 13800 }, { month: "Dec", revenue: 16200 },
];

const hourlyData = Array.from({ length: 12 }, (_, i) => ({
  hour: `${i + 7}:00`,
  occupancy: Math.round(20 + Math.sin((i / 12) * Math.PI) * 60 + Math.random() * 10),
}));

export default function AdminReports() {
  return (
    <AdminLayout title="Reports & Analytics">
      <div className="space-y-5">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Monthly Revenue", value: "₱16,200", change: "+12%", up: true },
            { label: "Avg Occupancy", value: "74%", change: "+5%", up: true },
            { label: "Total Bookings", value: "284", change: "+18%", up: true },
            { label: "Cancellations", value: "12", change: "-3%", up: false },
          ].map(({ label, value, change, up }) => (
            <div key={label} className="bg-white rounded-2xl p-4 card-elevated">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{value}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
                {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span>{change} vs last month</span>
              </div>
            </div>
          ))}
        </div>

        {/* Monthly Revenue Chart */}
        <div className="bg-white rounded-2xl p-5 card-elevated">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Monthly Revenue (₱)
            </h3>
            <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => toast.info("Export feature coming soon")}>
              <Download size={13} className="mr-1.5" />
              Export
            </Button>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyRevenue}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.22 0.07 255)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="oklch(0.22 0.07 255)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "none", fontSize: "12px" }} formatter={(v) => [`₱${v}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="oklch(0.22 0.07 255)" strokeWidth={2.5} fill="url(#revenueGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Two charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Weekly Occupancy */}
          <div className="bg-white rounded-2xl p-5 card-elevated">
            <h3 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Weekly Occupancy (%)
            </h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", fontSize: "12px" }} formatter={(v) => [`${v}%`, "Occupancy"]} />
                <Bar dataKey="occupancy" fill="oklch(0.22 0.07 255)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Hourly Pattern */}
          <div className="bg-white rounded-2xl p-5 card-elevated">
            <h3 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Hourly Occupancy Pattern
            </h3>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32)" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", fontSize: "12px" }} />
                <Line type="monotone" dataKey="occupancy" stroke="oklch(0.65 0.18 145)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Per-Lot Revenue Table */}
        <div className="bg-white rounded-2xl p-5 card-elevated">
          <h3 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Revenue by Parking Lot
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left pb-2 font-semibold">Parking Lot</th>
                <th className="text-left pb-2 font-semibold">Type</th>
                <th className="text-left pb-2 font-semibold">Bookings</th>
                <th className="text-left pb-2 font-semibold">Occupancy</th>
                <th className="text-left pb-2 font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {parkingLots.map((lot, i) => {
                const bookings = [28, 15, 9, 5][i] ?? 0;
                const occ = [78, 65, 45, 32][i] ?? 0;
                const rev = lot.ratePerHour * bookings * 2;
                return (
                  <tr key={lot.id} className="hover:bg-muted/30">
                    <td className="py-2.5 font-medium">{lot.name}</td>
                    <td className="py-2.5 text-muted-foreground capitalize">{lot.type}</td>
                    <td className="py-2.5 font-bold">{bookings}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${occ}%` }} />
                        </div>
                        <span className="text-xs">{occ}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 font-bold text-primary">{rev === 0 ? "Free" : `₱${rev}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
