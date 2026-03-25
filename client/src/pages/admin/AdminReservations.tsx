/*
 * iParkBayan — AdminReservations
 * Design: Civic Tech / Filipino Urban Identity
 */
import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { mockReservations } from "@/lib/data";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusColors = {
  active: "bg-emerald-100 text-emerald-700",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-rose-100 text-rose-700",
  pending: "bg-amber-100 text-amber-700",
};

export default function AdminReservations() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = mockReservations.filter((r) => {
    const matchSearch = r.lotName.toLowerCase().includes(search.toLowerCase()) ||
      r.vehiclePlate.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <AdminLayout title="Reservations">
      <div className="space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total", value: mockReservations.length, color: "text-foreground" },
            { label: "Active", value: mockReservations.filter(r => r.status === "active").length, color: "text-emerald-600" },
            { label: "Pending", value: mockReservations.filter(r => r.status === "pending").length, color: "text-amber-600" },
            { label: "Completed", value: mockReservations.filter(r => r.status === "completed").length, color: "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 card-elevated text-center">
              <p className={cn("text-3xl font-extrabold", color)} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 card-elevated flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, lot, or plate..."
              className="pl-9 h-9 rounded-xl text-sm"
            />
          </div>
          <div className="flex gap-2">
            {["all", "active", "pending", "completed", "cancelled"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize",
                  statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl p-5 card-elevated">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left pb-3 font-semibold">Booking ID</th>
                  <th className="text-left pb-3 font-semibold">Parking Lot</th>
                  <th className="text-left pb-3 font-semibold">Slot</th>
                  <th className="text-left pb-3 font-semibold">Vehicle</th>
                  <th className="text-left pb-3 font-semibold">Date & Time</th>
                  <th className="text-left pb-3 font-semibold">Duration</th>
                  <th className="text-left pb-3 font-semibold">Amount</th>
                  <th className="text-left pb-3 font-semibold">Status</th>
                  <th className="text-left pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((res) => (
                  <tr key={res.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-mono text-xs text-muted-foreground">{res.id}</td>
                    <td className="py-3 font-medium max-w-[140px] truncate">{res.lotName}</td>
                    <td className="py-3 font-bold">{res.slotLabel}</td>
                    <td className="py-3 font-mono text-xs">{res.vehiclePlate}</td>
                    <td className="py-3 text-xs text-muted-foreground">
                      <div>{res.date}</div>
                      <div>{res.startTime}–{res.endTime}</div>
                    </td>
                    <td className="py-3 text-xs">{res.duration}</td>
                    <td className="py-3 font-bold text-primary">{res.amount === 0 ? "Free" : `₱${res.amount}`}</td>
                    <td className="py-3">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize", statusColors[res.status])}>
                        {res.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button onClick={() => toast.info(`Viewing ${res.id}`)} className="text-xs text-primary font-semibold hover:underline">View</button>
                        {res.status === "active" && (
                          <button onClick={() => toast.success("Reservation cancelled")} className="text-xs text-rose-600 font-semibold hover:underline">Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No reservations found
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
