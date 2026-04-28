/*
 * iParkBayan — AdminWalkInRecords
 * Real‑time entry/exit, one‑click checkout with overtime confirmation,
 * overtime = ₱10 per hour beyond the first 3 hours.
 * PDF: Opens new window with clean report – no sidebars, no UI.
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
import { Plus, DollarSign, Car, Clock, CheckCircle, TrendingUp, Printer } from "lucide-react";
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
  const [checkoutConfirm, setCheckoutConfirm] = useState<{ record: WalkInRecord; extraHours: number; overtimeFee: number } | null>(null);

  const userRole = localStorage.getItem("admin_role");
  const userLotId = localStorage.getItem("admin_lot_id");

  // ================= DATA FETCHING (FIXED: NO NESTED SELECT) =================
  const getGuardId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setGuardId(user.id);
  };

  const fetchSlots = async () => {
    let query = supabase
      .from("parking_slots")
      .select(`id, label, parking_lots (id, name, rate_per_hour)`)
      .eq("is_reservable", false)
      .eq("status", "available");

    if (userRole === "manager" && userLotId) query = query.eq("lot_id", userLotId);
    else if (userRole === "guard" && userLotId) query = query.eq("lot_id", userLotId);

    const { data, error } = await query;
    if (!error && data) {
      data.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
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
    try {
      // 1. Get records without relations
      let query = supabase
        .from("walk_in_records")
        .select("*")
        .order("entry_time", { ascending: false });

      // Filter by lot if manager/guard
      if ((userRole === "manager" || userRole === "guard") && userLotId) {
        const { data: slotIds } = await supabase
          .from("parking_slots")
          .select("id")
          .eq("lot_id", userLotId);
        const ids = slotIds?.map(s => s.id) || [];
        if (ids.length === 0) {
          setRecords([]);
          setLoading(false);
          return;
        }
        query = query.in("slot_id", ids);
      }

      // Date filters
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

      const { data: recordsData, error: recordsError } = await query;
      if (recordsError) throw recordsError;

      if (!recordsData || recordsData.length === 0) {
        setRecords([]);
        setLoading(false);
        return;
      }

      // 2. Get slot details for these records
      const uniqueSlotIds = [...new Set(recordsData.map(r => r.slot_id))];
      const { data: slotsData, error: slotsError } = await supabase
        .from("parking_slots")
        .select(`id, label, parking_lots ( name, rate_per_hour )`)
        .in("id", uniqueSlotIds);

      if (slotsError) throw slotsError;

      // 3. Merge
      const combined = recordsData.map(record => ({
        ...record,
        parking_slots: slotsData?.find(slot => slot.id === record.slot_id) || null
      }));

      setRecords(combined);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to load records: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ================= PRINT: NEW WINDOW (NO SIDEBARS) =================
  const handlePrint = () => {
    const totalRevenue = records.reduce((sum, r) => sum + (r.amount_paid || 0), 0);
    const completedCount = records.filter(r => r.exit_time).length;
    const activeCount = records.length - completedCount;

    const getDateRangeText = () => {
      if (dateFilter === "today") return "Today";
      if (dateFilter === "week") return "Last 7 days";
      if (dateFilter === "month") return "Last 30 days";
      if (dateFilter === "custom" && customStart && customEnd) {
        return `${customStart} to ${customEnd}`;
      }
      return "All time";
    };

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>ParKada Walk‑in Records Report</title>
        <style>
          body {
            font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
            margin: 2rem;
            padding: 0;
          }
          .report-header {
            text-align: center;
            margin-bottom: 1.5rem;
            border-bottom: 2px solid #2c3e50;
            padding-bottom: 0.5rem;
          }
          .report-header h1 {
            font-size: 24pt;
            margin: 0;
          }
          .report-header p {
            margin: 0.25rem 0;
            font-size: 10pt;
            color: #555;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
            margin-top: 1rem;
          }
          .print-table th, .print-table td {
            border: 1px solid #aaa;
            padding: 8px;
            text-align: left;
            vertical-align: top;
          }
          .print-table th {
            background-color: #2c3e50;
            color: white;
            font-weight: 600;
          }
          .print-table tr:nth-child(even) td {
            background-color: #f9f9f9;
          }
          .report-summary {
            margin-top: 1rem;
            text-align: right;
            border-top: 1px solid #aaa;
            padding-top: 0.5rem;
            font-weight: bold;
          }
          .report-footer {
            margin-top: 1rem;
            text-align: center;
            font-size: 8pt;
            color: #777;
            border-top: 1px solid #ccc;
            padding-top: 0.5rem;
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>ParKada Walk‑in Records Report</h1>
          <p>Period: ${getDateRangeText()}</p>
          <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th>Entry Time</th>
              <th>Slot</th>
              <th>Plate Number</th>
              <th>Base Amount</th>
              <th>Overtime</th>
              <th>Total Paid</th>
              <th>Exit Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(rec => {
              const slotLabel = rec.parking_slots?.label || "—";
              const lotName = rec.parking_slots?.parking_lots?.name || "—";
              const overtime = rec.overtime_fee || 0;
              const total = rec.amount_paid;
              const base = total - overtime;
              const completed = !!rec.exit_time;
              return `
                <tr>
                  <td>${new Date(rec.entry_time).toLocaleString()}</td>
                  <td>${slotLabel} (${lotName})</td>
                  <td>${rec.plate_number}</td>
                  <td>₱${base.toFixed(2)}</td>
                  <td>${overtime > 0 ? `₱${overtime.toFixed(2)}` : "—"}</td>
                  <td>₱${total.toFixed(2)}</td>
                  <td>${rec.exit_time ? new Date(rec.exit_time).toLocaleString() : "—"}</td>
                  <td>${completed ? "Completed" : "Active"}</td>
                </tr>
              `;
            }).join('')}
            ${records.length === 0 ? '<tr><td colspan="8" style="text-align:center">No records found for the selected period.</td></tr>' : ''}
          </tbody>
        </table>
        <div class="report-summary">
          <p>Total Active: ${activeCount} &nbsp;|&nbsp; Total Completed: ${completedCount}</p>
          <p>Total Revenue: ₱${totalRevenue.toFixed(2)}</p>
        </div>
        <div class="report-footer">
          ParKada Parking Management System – Official Walk‑in Record
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportHtml);
      printWindow.document.close();
      printWindow.print();
    } else {
      toast.error('Unable to open print window. Please allow pop-ups.');
    }
  };

  // ================= OTHER HANDLERS (unchanged) =================
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
    const now = new Date().toISOString();
    const { error } = await supabase.from("walk_in_records").insert({
      slot_id: form.slot_id,
      guard_id: guardId,
      plate_number: form.plate_number.toUpperCase(),
      amount_paid: parseFloat(form.amount_paid),
      payment_method: "cash",
      notes: form.notes || null,
      entry_time: now,
      overtime_fee: 0,
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

  const calculateOvertime = (entryTime: string, exitTime: string): { extraHours: number; fee: number } => {
    const entry = new Date(entryTime);
    const exit = new Date(exitTime);
    let diffHours = (exit.getTime() - entry.getTime()) / (1000 * 60 * 60);
    if (diffHours <= 3) return { extraHours: 0, fee: 0 };
    const extraHours = Math.ceil(diffHours - 3);
    const fee = extraHours * 10;
    return { extraHours, fee };
  };

  const handleCheckoutClick = (record: WalkInRecord) => {
    const now = new Date().toISOString();
    const { extraHours, fee } = calculateOvertime(record.entry_time, now);
    if (extraHours === 0) {
      if (window.confirm(`No overtime. Total amount remains ₱${record.amount_paid.toFixed(2)}. Checkout now?`)) {
        performCheckout(record, now, 0);
      }
    } else {
      setCheckoutConfirm({ record, extraHours, overtimeFee: fee });
    }
  };

  const performCheckout = async (record: WalkInRecord, exitTime: string, overtimeFee: number) => {
    const totalAmount = record.amount_paid + overtimeFee;
    const { error } = await supabase
      .from("walk_in_records")
      .update({
        exit_time: exitTime,
        amount_paid: totalAmount,
        overtime_fee: overtimeFee,
      })
      .eq("id", record.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Checked out at ${new Date(exitTime).toLocaleTimeString()}. Overtime +₱${overtimeFee}`);
      fetchRecords();
    }
    setCheckoutConfirm(null);
  };

  // ================= COMPUTED VALUES =================
  const totalRevenue = records.reduce((sum, r) => sum + (r.amount_paid || 0), 0);
  const completedCount = records.filter(r => r.exit_time).length;
  const activeCount = records.length - completedCount;

  const getDateRangeText = () => {
    if (dateFilter === "today") return "Today";
    if (dateFilter === "week") return "Last 7 days";
    if (dateFilter === "month") return "Last 30 days";
    if (dateFilter === "custom" && customStart && customEnd) {
      return `${customStart} to ${customEnd}`;
    }
    return "All time";
  };

  // ================= USE EFFECTS =================
  useEffect(() => {
    fetchSlots();
    fetchRecords();
    getGuardId();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [dateFilter, customStart, customEnd]);

  // ================= RENDER =================
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
              <Clock size={24} />
            </div>
            <div>
              <p className="text-2xl font-black">{completedCount}</p>
              <p className="text-xs text-muted-foreground uppercase font-bold">Completed</p>
            </div>
          </div>
        </div>

        {/* Filters & Buttons */}
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
            <div className="flex gap-2">
              <Button onClick={handlePrint} variant="outline" className="rounded-xl gap-2">
                <Printer size={16} /> Export Records 
              </Button>
              <Button onClick={() => setShowForm(!showForm)} className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" /> Add Walk‑in
              </Button>
            </div>
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
                <Label className="text-sm font-semibold">Base Amount (₱) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount_paid}
                  onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
                  placeholder="0.00"
                  className="h-11"
                  required
                />
                <p className="text-[10px] text-muted-foreground mt-1">Covers first 3 hours. Overtime ₱10/hour beyond.</p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Notes (optional)</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g., discount, special"
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

        {/* Screen Table */}
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
                  <TableHead className="text-right">Action</TableHead>
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
                          {!completed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCheckoutClick(rec)}
                              className="text-blue-600 hover:bg-blue-50"
                            >
                              <TrendingUp size={14} /> Checkout
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Checkout Confirmation Modal */}
      {checkoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-4">Checkout Confirmation</h3>
            <div className="space-y-3">
              <p><span className="font-medium">Plate:</span> {checkoutConfirm.record.plate_number}</p>
              <p><span className="font-medium">Slot:</span> {checkoutConfirm.record.parking_slots?.label} ({checkoutConfirm.record.parking_slots?.parking_lots?.name})</p>
              <p><span className="font-medium">Entry:</span> {new Date(checkoutConfirm.record.entry_time).toLocaleString()}</p>
              <p><span className="font-medium">Base amount (first 3h):</span> ₱{checkoutConfirm.record.amount_paid.toFixed(2)}</p>
              <p className="text-rose-600 font-semibold">Extra hours: {checkoutConfirm.extraHours} (₱10/hour) → +₱{checkoutConfirm.overtimeFee}</p>
              <div className="border-t pt-2 mt-2">
                <p className="text-lg font-black">Total amount: ₱{(checkoutConfirm.record.amount_paid + checkoutConfirm.overtimeFee).toFixed(2)}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setCheckoutConfirm(null)}>Cancel</Button>
              <Button onClick={() => performCheckout(checkoutConfirm.record, new Date().toISOString(), checkoutConfirm.overtimeFee)}>Confirm Checkout</Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}