/*
 * iParkBayan — AdminDashboard (Supabase Connected - Super Admin & Manager)
 * Real‑time updates, TypeScript, map view, clickable cards, skeleton loading.
 */
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/supabaseClient";
import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { ParkingSquare, Users, BookOpen, Activity, Loader2, RefreshCw, Map as MapIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Leaflet Imports for Map
import { MapContainer, TileLayer, Marker, Tooltip as LeafletTooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ==================== TypeScript Interfaces ====================
interface ParkingSlot {
  status: string;
  lot_id: string;
}

interface ParkingLot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  totalSlots: number;
  availableSlots: number;
}

interface Reservation {
  id: string;
  start_time: string;
  end_time: string;
  created_at: string;
  total_amount: number;
  status: string;
  parking_lots: { name: string }[] | null;
  parking_slots: { label: string }[] | null;
}

interface FormattedReservation {
  id: string;
  lotName: string;
  slotLabel: string;
  date: string;
  amount: number;
  status: string;
}

interface Stats {
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  todayReservations: number;
  activeUsers: number;
}

const statusColors: Record<string, string> = {
  confirmed: "bg-emerald-100 text-emerald-700",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-rose-100 text-rose-700",
  pending: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
};

// Custom map marker (small blue dot)
const customMapIcon = L.divIcon({
  className: "bg-transparent",
  html: `<div style="background-color: oklch(0.22 0.07 255); width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [weeklyData, setWeeklyData] = useState<{ day: string; occupancy: number }[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalSlots: 0,
    availableSlots: 0,
    occupiedSlots: 0,
    reservedSlots: 0,
    todayReservations: 0,
    activeUsers: 0,
  });
  const [lotsOverview, setLotsOverview] = useState<ParkingLot[]>([]);
  const [recentReservations, setRecentReservations] = useState<FormattedReservation[]>([]);

  // Realtime subscriptions
  useEffect(() => {
    const channels = setupRealtimeSubscriptions();
    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [userRole]);

  const setupRealtimeSubscriptions = () => {
    const channels = [];

    const slotsChannel = supabase
      .channel('dashboard-slots-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_slots' }, () => fetchDashboardData(true))
      .subscribe();
    channels.push(slotsChannel);

    const reservationsChannel = supabase
      .channel('dashboard-reservations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchDashboardData(true))
      .subscribe();
    channels.push(reservationsChannel);

    if (userRole === 'superadmin') {
      const adminChannel = supabase
        .channel('dashboard-admin-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_profiles' }, () => fetchDashboardData(true))
        .subscribe();
      channels.push(adminChannel);
    }

    return channels;
  };

  const handleGoToSlots = (lotId: string) => {
    localStorage.setItem("view_lot_id", lotId);
    setLocation("/admin/slots");
  };

  const refreshData = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isRefreshing) fetchDashboardData(true);
  };

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      let currentRole = "";
      let managerLotId: string | null = null;

      if (user) {
        const { data: profileData } = await supabase
          .from("admin_profiles")
          .select("role, lot_id")
          .eq("id", user.id)
          .single();
        if (profileData?.role) {
          currentRole = profileData.role.toLowerCase();
          managerLotId = profileData.lot_id;
          setUserRole(currentRole);
        }
      }

      // 1. Parking slots
      let slotsQuery = supabase.from("parking_slots").select("status, lot_id");
      if (currentRole === "manager" && managerLotId) slotsQuery = slotsQuery.eq("lot_id", managerLotId);
      const { data: slotsData } = await slotsQuery;

      let total = 0, available = 0, occupied = 0, reserved = 0;
      const lotSlotCounts: Record<string, { total: number; available: number }> = {};
      if (slotsData) {
        total = slotsData.length;
        (slotsData as ParkingSlot[]).forEach(slot => {
          if (slot.status === "available") available++;
          if (slot.status === "occupied") occupied++;
          if (slot.status === "reserved") reserved++;
          if (!lotSlotCounts[slot.lot_id]) lotSlotCounts[slot.lot_id] = { total: 0, available: 0 };
          lotSlotCounts[slot.lot_id].total++;
          if (slot.status === "available") lotSlotCounts[slot.lot_id].available++;
        });
      }

      // 2. Parking lots (with coordinates for map)
      let lotsQuery = supabase.from("parking_lots").select("id, name, latitude, longitude");
      if (currentRole === "manager" && managerLotId) lotsQuery = lotsQuery.eq("id", managerLotId);
      const { data: lotsData } = await lotsQuery;
      const formattedLots: ParkingLot[] = (lotsData || []).map(lot => ({
        id: lot.id,
        name: lot.name,
        lat: lot.latitude,
        lng: lot.longitude,
        totalSlots: lotSlotCounts[lot.id]?.total || 0,
        availableSlots: lotSlotCounts[lot.id]?.available || 0,
      }));

      // 3. Today's reservations
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);

      let todayResQuery = supabase
        .from("reservations")
        .select("*", { count: "exact", head: true })
        .gte("start_time", todayStart.toISOString())
        .lt("start_time", tomorrowStart.toISOString());
      if (currentRole === "manager" && managerLotId) todayResQuery = todayResQuery.eq("lot_id", managerLotId);
      const { count: todayCount } = await todayResQuery;

      // 4. Recent reservations
      let recentResQuery = supabase
        .from("reservations")
        .select("id, start_time, end_time, created_at, total_amount, status, parking_lots(name), parking_slots(label)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (currentRole === "manager" && managerLotId) recentResQuery = recentResQuery.eq("lot_id", managerLotId);
      const { data: reservationsData } = await recentResQuery;

      const formattedReservations: FormattedReservation[] = (reservationsData || []).map((res: any) => ({
        id: res.id.substring(0, 8),
        lotName: res.parking_lots?.name || "Unknown",
        slotLabel: res.parking_slots?.label || "N/A",
        date: res.created_at ? new Date(res.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "No Date",
        amount: res.total_amount || 0,
        status: res.status,
      }));

      // 5. Active managers (superadmin only)
      let activeCount = 0;
      if (currentRole === "superadmin") {
        const { count } = await supabase
          .from("admin_profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "manager");
        activeCount = count || 0;
      }

      // 6. Dynamic weekly occupancy
      const totalSlotsCount = total;
      const now = new Date();
      const currentDay = now.getDay();
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() + mondayOffset);
      startOfWeek.setHours(0, 0, 0, 0);
      const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const occupancyByDay: { day: string; occupancy: number }[] = [];
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      let reservationsQuery = supabase
        .from("reservations")
        .select("start_time, end_time, lot_id, status")
        .not("status", "eq", "cancelled")
        .lt("start_time", endOfWeek.toISOString())
        .gte("end_time", startOfWeek.toISOString());
      if (currentRole === "manager" && managerLotId) reservationsQuery = reservationsQuery.eq("lot_id", managerLotId);
      const { data: weekReservations } = await reservationsQuery;

      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(startOfWeek);
        dayStart.setDate(startOfWeek.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayStart.getDate() + 1);
        let occupiedCount = 0;
        if (weekReservations) {
          weekReservations.forEach((res: any) => {
            const resStart = new Date(res.start_time);
            const resEnd = new Date(res.end_time);
            if (resStart < dayEnd && resEnd > dayStart) occupiedCount++;
          });
        }
        let occupancyPct = totalSlotsCount > 0 ? Math.round((occupiedCount / totalSlotsCount) * 100) : 0;
        occupancyPct = Math.min(occupancyPct, 100);
        occupancyByDay.push({ day: weekDays[i], occupancy: occupancyPct });
      }
      setWeeklyData(occupancyByDay);

      setStats({
        totalSlots: total,
        availableSlots: available,
        occupiedSlots: occupied,
        reservedSlots: reserved,
        todayReservations: todayCount || 0,
        activeUsers: activeCount,
      });
      setLotsOverview(formattedLots);
      setRecentReservations(formattedReservations);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const pieData = [
    { name: "Available", value: stats.availableSlots, color: "#10b981" },
    { name: "Occupied", value: stats.occupiedSlots, color: "#f97316" },
    { name: "Reserved", value: stats.reservedSlots, color: "#f59e0b" },
  ];

  const isSuperAdmin = userRole === "superadmin";
  const statCards = [
    { label: "Total Slots", value: stats.totalSlots, icon: ParkingSquare, color: "bg-primary/10 text-primary", path: "/admin/slots" },
    { label: "Available Now", value: stats.availableSlots, icon: Activity, color: "bg-emerald-100 text-emerald-700", path: "/admin/slots" },
    { label: "Today's Bookings", value: stats.todayReservations, icon: BookOpen, color: "bg-amber-100 text-amber-700", path: "/admin/reservations" },
  ];
  if (isSuperAdmin) {
    statCards.push({ label: "Total Managers", value: stats.activeUsers, icon: Users, color: "bg-blue-100 text-blue-700", path: "/admin/personnel" });
  }

  if (isLoading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="bg-slate-100 rounded-2xl h-28" />)}
          </div>
          <div className="bg-slate-100 rounded-2xl h-64" />
          <div className="bg-slate-100 rounded-2xl h-48" />
          <div className="bg-slate-100 rounded-2xl h-80" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Stat Cards - clickable */}
        <div className={cn("grid gap-4", isSuperAdmin ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
          {statCards.map(({ label, value, icon: Icon, color, path }) => (
            <button
              key={label}
              onClick={() => setLocation(path)}
              className="bg-white rounded-2xl p-4 card-elevated text-left w-full hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
                  <Icon size={20} />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </button>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Weekly Bar Chart */}
          <div
            className={cn("bg-white rounded-2xl p-4 sm:p-5 card-elevated cursor-pointer hover:shadow-md transition", userRole === "manager" ? "lg:col-span-2" : "lg:col-span-3")}
            onClick={() => setLocation("/admin/reports")}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold text-foreground">Weekly Occupancy Rate (%)</h3>
              <button onClick={refreshData} disabled={isRefreshing} className="p-1 rounded-full hover:bg-muted transition-colors">
                <RefreshCw size={16} className={cn("text-muted-foreground", isRefreshing && "animate-spin")} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }} formatter={(v) => [`${v}%`, "Occupancy"]} />
                <Bar dataKey="occupancy" fill="#0f172a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart (manager only) */}
          {userRole === "manager" && (
            <div className="bg-white rounded-2xl p-4 sm:p-5 card-elevated cursor-pointer hover:shadow-md transition" onClick={() => setLocation("/admin/slots")}>
              <h3 className="text-sm font-bold text-foreground mb-4">Slot Status</h3>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
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
          )}
        </div>

        {/* Map + Parking Lots Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Map Feature */}
          <div className="bg-white rounded-2xl p-5 card-elevated flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Parking Network Map</h3>
              <MapIcon size={16} className="text-muted-foreground" />
            </div>
            <div className="flex-1 w-full min-h-55 rounded-xl overflow-hidden relative z-0 border border-border bg-slate-50">
              <MapContainer center={[13.9419, 121.1644]} zoom={14} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
                {lotsOverview.filter(lot => lot.lat && lot.lng).map((lot) => (
                  <Marker key={lot.id} position={[lot.lat, lot.lng]} icon={customMapIcon}>
                    <LeafletTooltip direction="top" offset={[0, -5]} opacity={1}>
                      <span className="font-bold text-[11px] font-sans">{lot.name}</span>
                    </LeafletTooltip>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          {/* Parking Lots Overview */}
          <div className="bg-white rounded-2xl p-5 card-elevated h-full flex flex-col">
            <h3 className="text-sm font-bold text-foreground mb-4">Parking Lots Overview</h3>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {lotsOverview.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No parking lots found.</p>
              ) : (
                lotsOverview.map((lot) => {
                  const pct = lot.totalSlots === 0 ? 0 : Math.round((lot.availableSlots / lot.totalSlots) * 100);
                  return (
                    <button
                      key={lot.id}
                      onClick={() => handleGoToSlots(lot.id)}
                      className="w-full flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-muted/20 p-2 rounded-lg transition-colors text-left cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">{lot.name}</p>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2 hidden sm:inline">
                            {lot.availableSlots}/{lot.totalSlots}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="flex justify-between items-center w-full sm:w-auto sm:flex-col sm:items-end gap-1">
                        <span className="text-xs text-muted-foreground sm:hidden">{lot.availableSlots}/{lot.totalSlots}</span>
                        <span className={cn("text-xs font-bold", pct > 50 ? "text-emerald-600" : pct > 20 ? "text-amber-600" : "text-rose-600")}>{pct}%</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recent Reservations Table */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 card-elevated">
          <h3 className="text-sm font-bold text-foreground mb-4">Recent Reservations</h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full text-sm min-w-125">
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
                {recentReservations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted-foreground text-xs">No recent reservations found.</td>
                  </tr>
                ) : (
                  recentReservations.map((res) => (
                    <tr key={res.id} onClick={() => setLocation("/admin/reservations")} className="hover:bg-muted/30 transition-colors cursor-pointer">
                      <td className="py-2.5 font-mono text-xs text-muted-foreground">{res.id}</td>
                      <td className="py-2.5 font-medium truncate max-w-35">{res.lotName}</td>
                      <td className="py-2.5 font-bold">{res.slotLabel}</td>
                      <td className="py-2.5 text-muted-foreground text-xs whitespace-nowrap">{res.date}</td>
                      <td className="py-2.5 font-bold text-primary">{res.amount === 0 ? "Free" : `₱${res.amount}`}</td>
                      <td className="py-2.5">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize", statusColors[res.status] || "bg-gray-100 text-gray-700")}>
                          {res.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}