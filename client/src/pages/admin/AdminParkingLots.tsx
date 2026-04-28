/*
 * iParkBayan — AdminParkingLots (With Strict Delete, Real‑time & TypeScript)
 * No manual refresh button – real‑time updates only.
 * Accredited lots first, clickable with green hover. Unaccredited: not clickable, show "Walk‑In Only".
 * Added: Accreditation toggle in add form. Removed suspend button for unaccredited lots.
 * Capacity column now shows only total slots (e.g., "30" instead of "30/30").
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/supabaseClient";
import { toast } from "sonner";
import { RefreshCw, Building2, Plus, Trash2, MapPin, Tag, Ban, CheckCircle2, Award, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ==================== TypeScript Interface ====================
interface ParkingLot {
  id: string;
  name: string;
  address: string;
  type: string;
  rate_per_hour: number;
  total_slots: number;
  available_slots: number;
  open_hours: string | null;
  status: "active" | "suspended";
  is_accredited: boolean;
  created_at: string;
}

export default function AdminParkingLots() {
  const [, setLocation] = useLocation();
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add form state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newType, setNewType] = useState("private");
  const [newRate, setNewRate] = useState("");
  const [newTotalSlots, setNewTotalSlots] = useState("");
  const [newOpenHours, setNewOpenHours] = useState("");
  const [newIsAccredited, setNewIsAccredited] = useState(true); // default accredited

  // Real‑time subscription
  useEffect(() => {
    fetchLots();

    const lotsChannel = supabase
      .channel("parking-lots-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "parking_lots" }, () => fetchLots(true))
      .subscribe();

    return () => {
      supabase.removeChannel(lotsChannel);
    };
  }, []);

  const fetchLots = async (silentRefresh = false) => {
    if (!silentRefresh) {
      setIsLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from("parking_lots")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Sort: accredited first, then unaccredited
      const sorted = (data || []).sort((a, b) => {
        if (a.is_accredited === b.is_accredited) return 0;
        return a.is_accredited ? -1 : 1;
      });
      setLots(sorted);
    } catch (error: any) {
      console.error("Fetch Error:", error.message);
      toast.error("Failed to fetch parking lots.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string, name: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      const { error } = await supabase
        .from("parking_lots")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(`${name} is now ${newStatus}`);
      fetchLots(true);
    } catch (err: any) {
      toast.error("Failed to update status.");
    }
  };

  const handleAddLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newAddress.trim()) {
      toast.error("Please fill in the name and address.");
      return;
    }

    try {
      const total = parseInt(newTotalSlots) || 0;
      const { error } = await supabase.from("parking_lots").insert([
        {
          name: newName.trim(),
          address: newAddress.trim(),
          type: newType,
          rate_per_hour: parseFloat(newRate) || 0,
          total_slots: total,
          available_slots: total,
          open_hours: newOpenHours.trim() || null,
          status: "active",
          is_accredited: newIsAccredited,
        },
      ]);

      if (error) throw error;
      toast.success("Parking Lot added successfully!");
      setNewName("");
      setNewAddress("");
      setNewType("private");
      setNewRate("");
      setNewTotalSlots("");
      setNewOpenHours("");
      setNewIsAccredited(true);
      setIsAdding(false);
      fetchLots(true);
    } catch (error: any) {
      toast.error("Failed to add parking lot.");
    }
  };

  const handleDeleteLot = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `WARNING: Sigurado ka bang buburahin ang "${name}"?\n\n` +
        `HINDI ito mabubura kung may history na ito ng reservations o slots.`
    );
    if (!confirmed) return;

    try {
      const { count: slotCount } = await supabase
        .from("parking_slots")
        .select("*", { count: "exact", head: true })
        .eq("lot_id", id);

      if (slotCount && slotCount > 0) {
        toast.error(`Bawal burahin. May ${slotCount} slots pa sa loob ng building na ito.`);
        return;
      }

      const { count: historyCount } = await supabase
        .from("reservations")
        .select("*", { count: "exact", head: true })
        .eq("lot_id", id);

      if (historyCount && historyCount > 0) {
        toast.error("Bawal burahin! May transaction history na ang location na ito. I-suspend mo na lang.");
        return;
      }

      const { error } = await supabase.from("parking_lots").delete().eq("id", id);
      if (error) {
        toast.error("Database restriction: Hindi mabura ang location.");
      } else {
        toast.success(`${name} deleted successfully!`);
        fetchLots(true);
      }
    } catch (err: any) {
      toast.error("An unexpected error occurred.");
    }
  };

  const handleGoToSlots = (lotId: string) => {
    localStorage.setItem("view_lot_id", lotId);
    setLocation("/admin/slots");
  };

  if (isLoading) {
    return (
      <AdminLayout title="Parking Locations">
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <RefreshCw className="animate-spin text-primary mb-4 w-8 h-8" />
          <p className="text-muted-foreground font-medium">Loading locations...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Parking Locations">
      <div className="space-y-6">
        {/* Header card – no refresh button */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-full text-primary">
              <Building2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Manage Parking Lots</h3>
              <p className="text-sm text-muted-foreground">Add or remove parking buildings/areas</p>
            </div>
          </div>
          <Button className="rounded-xl font-bold" onClick={() => setIsAdding(!isAdding)}>
            <Plus size={16} className="mr-2" /> Add New Location
          </Button>
        </div>

        {/* Add form */}
        {isAdding && (
          <div className="bg-white p-6 border border-border rounded-2xl shadow-sm">
            <h4 className="font-bold mb-4 text-foreground">New Parking Location Details</h4>
            <form onSubmit={handleAddLot} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Lot Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-lg border border-border text-sm"
                  placeholder="e.g. Big Ben"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Address *</label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-lg border border-border text-sm"
                  placeholder="e.g. Lipa City"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Lot Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border text-sm bg-white"
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Price Rate (₱)</label>
                <input
                  type="number"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Total Slots</label>
                <input
                  type="number"
                  value={newTotalSlots}
                  onChange={(e) => setNewTotalSlots(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Open Hours</label>
                <input
                  type="text"
                  value={newOpenHours}
                  onChange={(e) => setNewOpenHours(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border text-sm"
                  placeholder="e.g. 6 AM - 10 PM"
                />
              </div>

              {/* Accreditation Toggle */}
              <div className="space-y-1 md:col-span-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                  <Award size={14} /> Accreditation Status
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newIsAccredited}
                      onChange={(e) => setNewIsAccredited(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium">Accredited (Online Reservations)</span>
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {newIsAccredited ? "Will be shown in user app" : "Walk‑in only, not in user app"}
                  </span>
                </div>
              </div>

              <div className="md:col-span-3 flex justify-end gap-2 mt-2">
                <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Location</Button>
              </div>
            </form>
          </div>
        )}

        {/* Table of lots */}
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left p-4 font-semibold uppercase tracking-wider">Details</th>
                  <th className="text-left p-4 font-semibold uppercase tracking-wider">Type & Rate</th>
                  <th className="text-center p-4 font-semibold uppercase tracking-wider">Capacity</th>
                  <th className="text-right p-4 font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lots.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      No parking lots found. Click "Add New Location" to create one.
                    </td>
                  </tr>
                ) : (
                  lots.map((lot) => {
                    const isAccredited = lot.is_accredited === true;
                    return (
                      <tr
                        key={lot.id}
                        onClick={() => isAccredited && handleGoToSlots(lot.id)}
                        className={cn(
                          "transition-all cursor-pointer group",
                          lot.status === "suspended" ? "bg-slate-50 opacity-75" : "",
                          isAccredited && lot.status !== "suspended" ? "hover:bg-emerald-50" : ""
                        )}
                      >
                        <td className="p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={cn(
                                "font-bold text-base",
                                lot.status === "suspended" ? "text-slate-400" : 
                                isAccredited ? "text-foreground group-hover:text-emerald-700" : "text-foreground"
                              )}
                            >
                              {lot.name}
                              {lot.status === "suspended" && " (Suspended)"}
                            </p>
                            <span
                              className={cn(
                                "text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase",
                                isAccredited
                                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-500 border border-slate-200"
                              )}
                            >
                              {isAccredited ? "Accredited" : "Unaccredited"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin size={12} /> {lot.address}
                          </p>
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-primary/10 text-primary mb-1">
                            <Tag size={12} /> {lot.type}
                          </span>
                          <p className="font-semibold mt-1 text-foreground">₱{lot.rate_per_hour}</p>
                        </td>
                        {/* 🔥 Capacity column – now shows only total slots */}
                        <td className="p-4 text-center">
                          {isAccredited ? (
                            <span className="font-bold text-foreground">{lot.total_slots}</span>
                          ) : (
                            <span className="text-amber-600 text-xs font-bold">Walk‑In Only</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1">
                            {isAccredited && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleStatus(lot.id, lot.status, lot.name);
                                }}
                                className={cn(
                                  "p-2 rounded-lg transition-all",
                                  lot.status === "active" ? "text-amber-500 hover:bg-amber-100" : "text-emerald-500 hover:bg-emerald-100"
                                )}
                                title={lot.status === "active" ? "Suspend Lot" : "Activate Lot"}
                              >
                                {lot.status === "active" ? <Ban size={18} /> : <CheckCircle2 size={18} />}
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLot(lot.id, lot.name);
                              }}
                              className="text-rose-500 opacity-30 hover:opacity-100 hover:bg-rose-100 p-2 rounded-lg transition-all"
                              title="Delete (Strict Check)"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}