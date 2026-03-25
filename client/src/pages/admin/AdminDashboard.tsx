/*
 * iParkBayan — AdminDashboard
 * Design: Civic Tech / Filipino Urban Identity
 * Main admin overview with stats, occupancy chart, recent reservations
 */
import AdminLayout from "@/components/AdminLayout";
import { adminStats, mockReservations, parkingLots } from "@/lib/data";
import { ParkingSquare, Users, BookOpen, TrendingUp, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weeklyData = adminStats.weeklyOccupancy.map((v, i) => ({ day: weekDays[i], occupancy: v }));

const pieData = [
  { name: "Available", value: adminStats.availableSlots, color: "oklch(0.65 0.18 145)" },
  { name: "Occupied", value: adminStats.occupiedSlots, color: "oklch(0.60 0.22 25)" },
  { name: "Reserved", value: adminStats.reservedSlots, color: "oklch(0.77 0.18 72)" },
];

const statCards = [
  { label: "Total Slots", value: adminStats.totalSlots, icon: ParkingSquare, color: "bg-primary/10 text-primary", change: null },
  { label: "Available Now", value: adminStats.availableSlots, icon: Activity, color: "bg-emerald-100 text-emerald-700", change: "+3" },
  { label: "Today's Bookings", value: adminStats.todayReservations, icon: BookOpen, color: "bg-amber-100 text-amber-700", change: "+5" },
  { label: "Active Users", value: adminStats.activeUsers, icon: Users, color: "bg-blue-100 text-blue-700", change: "+12" },
];

const statusColors = {
  active: "bg-emerald-100 text-emerald-700",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-rose-100 text-rose-700",
  pending: "bg-amber-100 text-amber-700",
};

export default function AdminDashboard() {
  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, change }) => (
            <div key={label} className="bg-white rounded-2xl p-4 card-elevated">
              <div className="flex items-start justify-between mb-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
                  <Icon size={20} />
                </div>
                {change && (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                    {change}
                  </span>
                )}
              </div>
              <p className="text-3xl font-extrabold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Weekly Occupancy Bar Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 card-elevated">
            <h3 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Weekly Occupancy Rate (%)
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.52 0.03 255)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.03 255)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", fontSize: "12px" }}
                  formatter={(v) => [`${v}%`, "Occupancy"]}
                />
                <Bar dataKey="occupancy" fill="oklch(0.22 0.07 255)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="bg-white rounded-2xl p-5 card-elevated">
            <h3 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Slot Status
            </h3>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {pieData.map(({ name, value, color }) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                    <span className="text-muted-foreground">{name}</span>
                  </div>
                  <span className="font-bold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Parking Lots Status */}
        <div className="bg-white rounded-2xl p-5 card-elevated">
          <h3 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Parking Lots Overview
          </h3>
          <div className="space-y-3">
            {parkingLots.map((lot) => {
              const pct = Math.round((lot.availableSlots / lot.totalSlots) * 100);
              return (
                <div key={lot.id} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{lot.name}</p>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{lot.availableSlots}/{lot.totalSlots}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-rose-500")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className={cn("text-xs font-bold shrink-0", pct > 50 ? "text-emerald-600" : pct > 20 ? "text-amber-600" : "text-rose-600")}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Reservations */}
        <div className="bg-white rounded-2xl p-5 card-elevated">
          <h3 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Recent Reservations
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left pb-2 font-semibold">ID</th>
                  <th className="text-left pb-2 font-semibold">Location</th>
                  <th className="text-left pb-2 font-semibold">Slot</th>
                  <th className="text-left pb-2 font-semibold">Date</th>
                  <th className="text-left pb-2 font-semibold">Amount</th>
                  <th className="text-left pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mockReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">{res.id}</td>
                    <td className="py-2.5 font-medium truncate max-w-[140px]">{res.lotName}</td>
                    <td className="py-2.5 font-bold">{res.slotLabel}</td>
                    <td className="py-2.5 text-muted-foreground text-xs">{res.date}</td>
                    <td className="py-2.5 font-bold text-primary">{res.amount === 0 ? "Free" : `₱${res.amount}`}</td>
                    <td className="py-2.5">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize", statusColors[res.status])}>
                        {res.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
