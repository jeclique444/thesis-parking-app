/*
 * iParkBayan — AdminDashboard (Supabase Connected - Super Admin & Manager)
 * Design: Civic Tech / Filipino Urban Identity
 */
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/supabaseClient"; 
import { useEffect, useState } from "react";
import { ParkingSquare, Users, BookOpen, TrendingUp, Activity, Loader2, Map as MapIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";

// Leaflet Imports for Map Integration
import { MapContainer, TileLayer, Marker, Tooltip as LeafletTooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Static mock for weekly chart
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weeklyData = [40, 55, 60, 45, 70, 85, 50].map((v, i) => ({ day: weekDays[i], occupancy: v }));

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-rose-100 text-rose-700",
  pending: "bg-amber-100 text-amber-700",
};

export default function AdminDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  
  const [userRole, setUserRole] = useState<string>(""); 
  
  // Dashboard States
  const [stats, setStats] = useState({
    totalSlots: 0,
    availableSlots: 0,
    occupiedSlots: 0,
    reservedSlots: 0,
    todayReservations: 0,
    activeUsers: 0 
  });
  
  const [lotsOverview, setLotsOverview] = useState<any[]>([]);
  const [recentReservations, setRecentReservations] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 0. KUNIN ANG ROLE AT ASSIGNED LOT NG CURRENT USER
      const { data: { user } } = await supabase.auth.getUser();
      
      let currentRole = "";
      let managerLotId = null;

      if (user) {
        const { data: profileData, error: profileError } = await supabase
          .from("admin_profiles")
          .select("role, lot_id") 
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Error fetching admin profile:", profileError.message);
        }

        if (profileData && profileData.role) {
          currentRole = profileData.role.toLowerCase();
          managerLotId = profileData.lot_id;
          setUserRole(currentRole);
        }
      }

      // 1. Fetch Parking Slots
      let slotsQuery = supabase.from("parking_slots").select("status, lot_id");
      if (currentRole === "manager" && managerLotId) {
        slotsQuery = slotsQuery.eq("lot_id", managerLotId);
      }
      const { data: slotsData } = await slotsQuery;
      
      let total = 0, available = 0, occupied = 0, reserved = 0;
      const lotSlotCounts: Record<string, { total: number, available: number }> = {};

      if (slotsData) {
        total = slotsData.length;
        slotsData.forEach(slot => {
          if (slot.status === 'available') available++;
          if (slot.status === 'occupied') occupied++;
          if (slot.status === 'reserved') reserved++;

          if (!lotSlotCounts[slot.lot_id]) {
            lotSlotCounts[slot.lot_id] = { total: 0, available: 0 };
          }
          lotSlotCounts[slot.lot_id].total++;
          if (slot.status === 'available') lotSlotCounts[slot.lot_id].available++;
        });
      }

      // 2. Fetch Parking Lots with Latitude & Longitude
      let lotsQuery = supabase.from("parking_lots").select("id, name, latitude, longitude");
      if (currentRole === "manager" && managerLotId) {
        lotsQuery = lotsQuery.eq("id", managerLotId); 
      }
      const { data: lotsData } = await lotsQuery;
      
      const formattedLots = (lotsData || []).map(lot => ({
        id: lot.id,
        name: lot.name,
        lat: lot.latitude,
        lng: lot.longitude,
        totalSlots: lotSlotCounts[lot.id]?.total || 0,
        availableSlots: lotSlotCounts[lot.id]?.available || 0,
      }));

      // 3. Fetch Today's Reservations
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let todayResQuery = supabase
        .from("reservations")
        .select("*", { count: 'exact', head: true })
        .gte("start_time", today.toISOString());
        
      if (currentRole === "manager" && managerLotId) {
        todayResQuery = todayResQuery.eq("lot_id", managerLotId); 
      }
      const { count: todayCount } = await todayResQuery;

      // 4. Fetch Recent Reservations
      let recentResQuery = supabase
        .from("reservations")
        .select("id, start_time, end_time, created_at, total_amount, status, parking_lots(name), parking_slots(label)") 
        .order("created_at", { ascending: false })
        .limit(5);

      if (currentRole === "manager" && managerLotId) {
        recentResQuery = recentResQuery.eq("lot_id", managerLotId);
      }

      const { data: reservationsData, error: fetchError } = await recentResQuery;

      if (fetchError) {
        console.error("Error sa Reservations:", fetchError.message);
      }

      const formattedReservations = (reservationsData || []).map((res: any) => ({
        id: res.id.substring(0, 8), 
        lotName: res.parking_lots?.name || "Unknown", 
        slotLabel: res.parking_slots?.label || "N/A", 
        date: res.created_at 
            ? new Date(res.created_at).toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }) 
            : "No Date", 
        amount: res.total_amount || 0,
        status: res.status
      }));

      // Update State
      setStats({
        totalSlots: total,
        availableSlots: available,
        occupiedSlots: occupied,
        reservedSlots: reserved,
        todayReservations: todayCount || 0,
        activeUsers: 124 // Default mock active users
      });
      setLotsOverview(formattedLots);
      setRecentReservations(formattedReservations);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const pieData = [
    { name: "Available", value: stats.availableSlots, color: "oklch(0.65 0.18 145)" },
    { name: "Occupied", value: stats.occupiedSlots, color: "oklch(0.60 0.22 25)" },
    { name: "Reserved", value: stats.reservedSlots, color: "oklch(0.77 0.18 72)" },
  ];

  // LOGIC PARA SA STAT CARDS
  const statCards = [
    { label: "Total Slots", value: stats.totalSlots, icon: ParkingSquare, color: "bg-primary/10 text-primary", change: null },
    { label: "Available Now", value: stats.availableSlots, icon: Activity, color: "bg-emerald-100 text-emerald-700", change: null },
    { label: "Today's Bookings", value: stats.todayReservations, icon: BookOpen, color: "bg-amber-100 text-amber-700", change: null },
  ];

  const isSuperAdmin = userRole === "superadmin";

  if (isSuperAdmin) {
    statCards.push({ label: "Active Users", value: stats.activeUsers, icon: Users, color: "bg-blue-100 text-blue-700", change: null });
  }

  // Create a minimal map icon
  const customMapIcon = L.divIcon({
    className: "bg-transparent",
    html: `<div style="background-color: oklch(0.22 0.07 255); width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

  if (isLoading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        
        {/* Stat Cards */}
        <div className={cn("grid gap-4", isSuperAdmin ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 lg:grid-cols-3")}>
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 card-elevated">
              <div className="flex items-start justify-between mb-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
                  <Icon size={20} />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Weekly Occupancy Bar Chart */}
          <div className={cn("bg-white rounded-2xl p-5 card-elevated", userRole === "manager" ? "lg:col-span-2" : "lg:col-span-3")}>
            <h3 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Weekly Occupancy Rate (%)
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.004 286.32)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.52 0.03 255)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.03 255)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", fontSize: "12px" }}
                  formatter={(v) => [`${v}%`, "Occupancy"]}
                />
                <Bar dataKey="occupancy" fill="oklch(0.22 0.07 255)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart - KITA LAMANG NG MANAGER */}
          {userRole === "manager" && (
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
                  <RechartsTooltip contentStyle={{ borderRadius: "12px", border: "none", fontSize: "12px" }} />
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

        {/* Maps and Overview Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Map Feature (View Only) */}
          <div className="bg-white rounded-2xl p-5 card-elevated flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Parking Network Map
              </h3>
              <MapIcon size={16} className="text-muted-foreground" />
            </div>
            {/* Using z-0 to ensure it doesn't overlap with admin dropdowns */}
            <div className="flex-1 w-full min-h-[220px] rounded-xl overflow-hidden relative z-0 border border-border bg-slate-50">
              <MapContainer 
                center={[13.9419, 121.1644]} // Centered initially to Lipa City, Batangas
                zoom={14} // Slightly closer zoom to see the city layout clearly
                style={{ height: "100%", width: "100%" }}
                zoomControl={false} // Cleaner minimal look
              >
                {/* Changed to Google Satellite Hybrid view to match the Driver App */}
                <TileLayer
                  url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  attribution="&copy; Google Maps"
                />
                {lotsOverview.filter(lot => lot.lat && lot.lng).map((lot) => (
                  <Marker 
                    key={lot.id} 
                    position={[lot.lat, lot.lng]}
                    icon={customMapIcon}
                  >
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
            <h3 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Parking Lots Overview
            </h3>
            <div className="space-y-4 flex-1 overflow-y-auto">
              {lotsOverview.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No parking lots found.</p>
              ) : (
                lotsOverview.map((lot) => {
                  const pct = lot.totalSlots === 0 ? 0 : Math.round((lot.availableSlots / lot.totalSlots) * 100);
                  return (
                    <div key={lot.id} className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-sm font-semibold text-foreground truncate">{lot.name}</p>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">{lot.availableSlots}/{lot.totalSlots}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-rose-500")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className={cn("text-xs font-bold shrink-0 w-10 text-right", pct > 50 ? "text-emerald-600" : pct > 20 ? "text-amber-600" : "text-rose-600")}>
                        {pct}%
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Recent Reservations Table */}
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
                {recentReservations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted-foreground text-xs">
                      No recent reservations found.
                    </td>
                  </tr>
                ) : (
                  recentReservations.map((res) => (
                    <tr key={res.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 font-mono text-xs text-muted-foreground">{res.id}</td>
                      <td className="py-2.5 font-medium truncate max-w-[140px]">{res.lotName}</td>
                      <td className="py-2.5 font-bold">{res.slotLabel}</td>
                      <td className="py-2.5 text-muted-foreground text-xs">{res.date}</td>
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