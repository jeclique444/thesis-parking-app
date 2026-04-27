/*
 * iParkBayan — AdminWalkInRecords (Slot-based, for managers & guards)
 */
import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/supabaseClient";
import { toast } from "sonner";
import { Plus, DollarSign, Car, Clock, Trash2, CheckCircle, TrendingUp, Clock as ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface WalkInRecord {
  id: string;
  slot_id: string;
  guard_id: string;
  plate_number: string;
  amount_paid: number;
  payment_method: string;
  entry_time: string;
  exit_time: string | null;
  overtime_fee: number;
  notes: string | null;
  created_at: string;
  parking_slots?: { label: string; parking_lots: { name: string; rate_per_hour: number } };
}

export default function AdminWalkInRecords() {
  const [slots, setSlots] = useState<{ id: string; label: string; lot_name: string; lot_rate: number }[]>([]);
  const [records, setRecords] = useState<WalkInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    slot_id: "",
    plate_number: "",
    amount_paid: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [guardId, setGuardId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "custom">("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [checkoutModal, setCheckoutModal] = useState<{ open: boolean; record: WalkInRecord | null; exitTime: string }>({
    open: false,
    record: null,
    exitTime: "",
  });

  const userRole = localStorage.getItem("admin_role");
  const userLotId = localStorage.getItem("admin_lot_id");

  useEffect(() => {
    fetchSlots();
    fetchRecords();
    getGuardId();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [dateFilter, customStart, customEnd]);

  const getGuardId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setGuardId(user.id);
  };

  const fetchSlots = async () => {
    let query = supabase
      .from("parking_slots")
      .select(`
        id, label,
        parking_lots (id, name, rate_per_hour)
      `)
      .eq("is_reservable", false)   // 🔥 Only walk‑in slots
      .eq("status", "available");   // optional: only show available slots

    if (userRole === "manager" && userLotId) {
      query = query.eq("lot_id", userLotId);
    } else if (userRole === "guard" && userLotId) {
      query = query.eq("lot_id", userLotId);
    }

    const { data, error } = await query;
    if (!error && data) {
      const formatted = data.map((slot: any) => ({
        id: slot.id,
        label: slot.label,
        lot_name: slot.parking_lots?.name || "Unknown",
        lot_rate: slot.parking_lots?.rate_per_hour || 30,
      }));
      setSlots(formatted);
    } else {
      toast.error("Failed to load walk‑in slots");
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    let query = supabase
      .from("walk_in_records")
      .select(`
        *,
        parking_slots (
          label,
          parking_lots ( name, rate_per_hour )
        )
      `)
      .order("entry_time", { ascending: false });

    if (userRole === "manager" && userLotId) {
      const { data: slotIds } = await supabase
        .from("parking_slots")
        .select("id")
        .eq("lot_id", userLotId);
      const ids = slotIds?.map(s => s.id) || [];
      if (ids.length > 0) {
        query = query.in("slot_id", ids);
      } else {
        setRecords([]);
        setLoading(false);
        return;
      }
    } else if (userRole === "guard" && userLotId) {
      const { data: slotIds } = await supabase
        .from("parking_slots")
        .select("id")
        .eq("lot_id", userLotId);
      const ids = slotIds?.map(s => s.id) || [];
      if (ids.length > 0) {
        query = query.in("slot_id", ids);
      } else {
        setRecords([]);
        setLoading(false);
        return;
      }
    }

    const now = new Date();
    if (dateFilter === "today") {
      const start = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const end = new Date(now.setHours(23, 59, 59, 999)).toISOString();
      query = query.gte("entry_time", start).lte("entry_time", end);
    } else if (dateFilter === "week") {
      const start = new Date(now.setDate(now.getDate() - 7)).toISOString();
      query = query.gte("entry_time", start);
    } else if (dateFilter === "month") {
      const start = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
      query = query.gte("entry_time", start);
    } else if (dateFilter === "custom" && customStart && customEnd) {
      const start = new Date(customStart).toISOString();
      const end = new Date(customEnd + "T23:59:59").toISOString();
      query = query.gte("entry_time", start).lte("entry_time", end);
    }

    const { data, error } = await query;
    if (!error && data) setRecords(data);
    else toast.error("Failed to load records");
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.slot_id || !form.plate_number || !form.amount_paid) {
      toast.error("Please fill in slot, plate, and amount");
      return;
    }
    if (!guardId) {
      toast.error("Guard identity not found");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("walk_in_records").insert({
      slot_id: form.slot_id,
      guard_id: guardId,
      plate_number: form.plate_number.toUpperCase(),
      amount_paid: parseFloat(form.amount_paid),
      payment_method: "cash",
      notes: form.notes || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Walk‑in recorded");
      setForm({ slot_id: "", plate_number: "", amount_paid: "", notes: "" });
      setShowForm(false);
      fetchRecords();
    }
    setSubmitting(false);
  };

  const deleteRecord = async (id: string) => {
    if (!confirm("Delete this walk‑in record?")) return;
    const { error } = await supabase.from("walk_in_records").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Record deleted");
      fetchRecords();
    }
  };

  const openCheckout = (record: WalkInRecord) => {
    setCheckoutModal({
      open: true,
      record,
      exitTime: new Date().toISOString().slice(0, 16),
    });
  };

  const calculateOvertime = (entryTime: string, exitTime: string, rate: number): number => {
    const entry = new Date(entryTime);
    const exit = new Date(exitTime);
    const diffHours = Math.max(0, (exit.getTime() - entry.getTime()) / (1000 * 60 * 60));
    const overtime = Math.ceil(diffHours) * rate;
    return overtime;
  };

  const handleCheckout = async () => {
    const { record, exitTime } = checkoutModal;
    if (!record || !exitTime) return;
    const rate = record.parking_slots?.parking_lots?.rate_per_hour || 30;
    const overtime = calculateOvertime(record.entry_time, exitTime, rate);
    const totalAmount = record.amount_paid + overtime;
    const { error } = await supabase
      .from("walk_in_records")
      .update({
        exit_time: exitTime,
        amount_paid: totalAmount,
        overtime_fee: overtime,
      })
      .eq("id", record.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Checked out. Extra +₱${overtime.toFixed(2)} added.`);
      setCheckoutModal({ open: false, record: null, exitTime: "" });
      fetchRecords();
    }
  };

  const totalRevenue = records.reduce((sum, r) => sum + (r.amount_paid || 0), 0);

  return (
    <AdminLayout title="Walk‑in Records">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-full text-emerald-700">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-2xl font-black">₱{totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground uppercase font-bold">Total Revenue</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-700">
              <Car size={24} />
            </div>
            <div>
              <p className="text-2xl font-black">{records.length}</p>
              <p className="text-xs text-muted-foreground uppercase font-bold">Transactions</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-full text-amber-700">
              <ClockIcon size={24} />
            </div>
            <div>
              <p className="text-2xl font-black">{records.filter(r => r.exit_time).length}</p>
              <p className="text-xs text-muted-foreground uppercase font-bold">Completed</p>
            </div>
          </div>
        </div>

        {/* Filters & Add Button */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <div className="flex flex-wrap items-center justify-between gap-4">
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
                <div className="flex gap-2">
                  <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-36 h-9" />
                  <span>–</span>
                  <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-36 h-9" />
                </div>
              )}
            </div>
            <Button onClick={() => setShowForm(!showForm)} className="rounded-xl">
              <Plus className="mr-2 h-4 w-4" /> Add Walk‑in
            </Button>
          </div>
        </div>

        {/* Add Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-2xl border shadow-sm">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <Label className="text-sm font-semibold">Parking Slot *</Label>
                <select
                  value={form.slot_id}
                  onChange={(e) => setForm({ ...form, slot_id: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm"
                  required
                >
                  <option value="">Select slot</option>
                  {slots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.label} ({slot.lot_name})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">Only walk‑in slots are shown.</p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Plate Number *</Label>
                <Input
                  value={form.plate_number}
                  onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
                  placeholder="ABC-1234"
                  className="h-11"
                  required
                />
              </div>
              <div>
                <Label className="text-sm font-semibold">Amount Paid (₱) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount_paid}
                  onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
                  placeholder="0.00"
                  className="h-11"
                  required
                />
              </div>
              <div>
                <Label className="text-sm font-semibold">Notes (optional)</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g., overstaying, discount"
                  className="h-20 resize-none"
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="rounded-xl">
                  {submitting ? "Saving..." : "Record Walk‑in"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Records Table (unchanged) */}
        <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="py-3">Entry Time</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Plate</TableHead>
                  <TableHead>Base Amount</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Total Paid</TableHead>
                  <TableHead>Exit Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : records.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No records found.</TableCell></TableRow>
                ) : (
                  records.map((rec) => {
                    const slotLabel = rec.parking_slots?.label || "—";
                    const lotName = rec.parking_slots?.parking_lots?.name || "—";
                    const overtime = rec.overtime_fee || 0;
                    const total = rec.amount_paid;
                    const base = total - overtime;
                    const completed = !!rec.exit_time;
                    return (
                      <TableRow key={rec.id} className="border-t">
                        <TableCell className="text-xs whitespace-nowrap">{new Date(rec.entry_time).toLocaleString()}</TableCell>
                        <TableCell>
                          <span className="font-mono font-medium">{slotLabel}</span>
                          <span className="text-xs text-muted-foreground ml-1">({lotName})</span>
                        </TableCell>
                        <TableCell className="font-mono">{rec.plate_number}</TableCell>
                        <TableCell>₱{base.toFixed(2)}</TableCell>
                        <TableCell className={overtime > 0 ? "text-rose-600 font-bold" : ""}>
                          {overtime > 0 ? `+₱${overtime.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="font-bold">₱{total.toFixed(2)}</TableCell>
                        <TableCell className="text-xs">
                          {rec.exit_time ? new Date(rec.exit_time).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>
                          {completed ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                              <CheckCircle size={12} /> Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                              <Clock size={12} /> Active
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!completed && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openCheckout(rec)}
                                className="text-blue-600 hover:bg-blue-50"
                              >
                                <TrendingUp size={14} /> Checkout
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteRecord(rec.id)}
                              className="text-rose-500 hover:bg-rose-50"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Checkout Modal */}
        {checkoutModal.open && checkoutModal.record && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
              <h3 className="text-lg font-bold mb-4">Check Out Walk‑in</h3>
              <div className="space-y-3">
                <p>
                  <span className="font-medium">Plate:</span> {checkoutModal.record.plate_number}
                </p>
                <p>
                  <span className="font-medium">Slot:</span>{" "}
                  {checkoutModal.record.parking_slots?.label} ({checkoutModal.record.parking_slots?.parking_lots?.name})
                </p>
                <p>
                  <span className="font-medium">Entry:</span>{" "}
                  {new Date(checkoutModal.record.entry_time).toLocaleString()}
                </p>
                <div>
                  <Label>Exit time *</Label>
                  <Input
                    type="datetime-local"
                    value={checkoutModal.exitTime}
                    onChange={(e) => setCheckoutModal({ ...checkoutModal, exitTime: e.target.value })}
                    className="mt-1"
                    required
                  />
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-sm">
                  <p className="font-medium">Overtime calculation:</p>
                  <p>Hourly rate: ₱{checkoutModal.record.parking_slots?.parking_lots?.rate_per_hour || 30}/hr</p>
                  <p>Extra charge will be added to total amount.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setCheckoutModal({ open: false, record: null, exitTime: "" })}>
                  Cancel
                </Button>
                <Button onClick={handleCheckout}>
                  Confirm Checkout
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}