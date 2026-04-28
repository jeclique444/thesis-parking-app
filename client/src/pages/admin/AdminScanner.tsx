import { useState, useEffect, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/supabaseClient";
import { toast } from "sonner";
import { 
  Camera, Search, CheckCircle2, XCircle, 
  Car, User, Clock, MapPin, Loader2, ArrowRightCircle, Calendar,
  ListTodo, History, ParkingCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Html5Qrcode } from "html5-qrcode";

const isUUID = (uuid: string) => {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid);
};

const formatTime = (isoString: string | null) => {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "—";
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const minuteStr = minutes.toString().padStart(2, "0");
  return `${hours}:${minuteStr} ${ampm}`;
};

const formatDate = (isoString: string | null) => {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatTimeRange = (start: string | null, end: string | null) => {
  const startF = formatTime(start);
  const endF = formatTime(end);
  if (startF === "—" && endF === "—") return "—";
  return `${startF} – ${endF}`;
};

export default function AdminScanner() {
  const [managerLotId, setManagerLotId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const [bookingData, setBookingData] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'expected' | 'parked' | 'history'>('expected');
  const [expectedList, setExpectedList] = useState<any[]>([]);
  const [parkedList, setParkedList] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const fetchManagerData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("admin_profiles")
          .select("lot_id")
          .eq("id", user.id)
          .single();
        if (data) setManagerLotId(data.lot_id);
      }
    };
    fetchManagerData();
  }, []);

  // Expected: booked & reserved
  const fetchExpectedArrivals = async () => {
    if (!managerLotId) return;
    try {
      const { data: expectedRaw, error } = await supabase
        .from("reservations")
        .select("id, plate_number, start_time, end_time, status, user_id")
        .eq("lot_id", managerLotId)
        .in("status", ["booked", "reserved"])
        .order("start_time", { ascending: true });
      if (error) throw error;

      let expectedWithNames: any[] = [];
      if (expectedRaw && expectedRaw.length > 0) {
        const userIds = [...new Set(expectedRaw.map(r => r.user_id).filter(Boolean))];
        let userMap = new Map();
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);
          if (profiles) profiles.forEach(p => userMap.set(p.id, p.full_name));
        }
        expectedWithNames = expectedRaw.map(r => ({
          ...r,
          profiles: { full_name: userMap.get(r.user_id) || "Guest" }
        }));
      }
      setExpectedList(expectedWithNames);
    } catch (error) {
      console.error("Error fetching expected arrivals:", error);
    }
  };

  // Parked: active
  const fetchParkedVehicles = async () => {
    if (!managerLotId) return;
    try {
      const { data: parkedRaw, error } = await supabase
        .from("reservations")
        .select("id, plate_number, start_time, end_time, status, user_id")
        .eq("lot_id", managerLotId)
        .eq("status", "active")
        .order("start_time", { ascending: true });
      if (error) throw error;

      let parkedWithNames: any[] = [];
      if (parkedRaw && parkedRaw.length > 0) {
        const userIds = [...new Set(parkedRaw.map(r => r.user_id).filter(Boolean))];
        let userMap = new Map();
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);
          if (profiles) profiles.forEach(p => userMap.set(p.id, p.full_name));
        }
        parkedWithNames = parkedRaw.map(r => ({
          ...r,
          profiles: { full_name: userMap.get(r.user_id) || "Guest" }
        }));
      }
      setParkedList(parkedWithNames);
    } catch (error) {
      console.error("Error fetching parked vehicles:", error);
    }
  };

  // Completed history
  const fetchHistory = async () => {
    if (!managerLotId) return;
    try {
      const { data: historyRaw, error } = await supabase
        .from("reservations")
        .select("id, plate_number, start_time, end_time, status, created_at, user_id")
        .eq("lot_id", managerLotId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      let historyWithNames: any[] = [];
      if (historyRaw && historyRaw.length > 0) {
        const userIds = [...new Set(historyRaw.map(r => r.user_id).filter(Boolean))];
        let userMap = new Map();
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);
          if (profiles) profiles.forEach(p => userMap.set(p.id, p.full_name));
        }
        historyWithNames = historyRaw.map(r => ({
          ...r,
          profiles: { full_name: userMap.get(r.user_id) || "Guest" }
        }));
      }
      setHistoryList(historyWithNames);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  // Initial loads
  useEffect(() => {
    if (managerLotId) {
      fetchExpectedArrivals();
      fetchParkedVehicles();
      fetchHistory();
    }
  }, [managerLotId]);

  // Refresh all when tab changes (already done via subscriptions)
  useEffect(() => {
    fetchExpectedArrivals();
    fetchParkedVehicles();
    fetchHistory();
  }, [activeTab]);

  // Real‑time subscription for all changes
  useEffect(() => {
    if (!managerLotId) return;
    const channel = supabase
      .channel('scanner-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `lot_id=eq.${managerLotId}`,
        },
        () => {
          fetchExpectedArrivals();
          fetchParkedVehicles();
          fetchHistory();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [managerLotId]);

  // Camera scanning (unchanged, uses Html5Qrcode)
  const startScanner = async () => {
    const element = document.getElementById("qr-reader");
    if (!element) {
      toast.error("Scanner element not found");
      return false;
    }
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
      } catch (e) {}
      scannerRef.current = null;
    }
    const html5QrCode = new Html5Qrcode("qr-reader");
    scannerRef.current = html5QrCode;
    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const cleanText = decodedText.trim();
          try {
            const parsed = JSON.parse(cleanText);
            const idToSearch = (parsed.id || parsed.ref || cleanText).trim();
            setSearchInput(idToSearch);
            handleManualSearch(idToSearch);
          } catch {
            setSearchInput(cleanText);
            handleManualSearch(cleanText);
          }
          if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(console.error);
          }
          setIsScanning(false);
        },
        (errorMessage) => {
          if (errorMessage && errorMessage.includes("No MultiFormat Readers")) return;
          console.debug("Scan error:", errorMessage);
        }
      );
      return true;
    } catch (err: any) {
      console.error("Start scanning error:", err);
      toast.error(err.message || "Failed to start camera");
      setCameraError(err.message || "Camera start failed");
      setIsScanning(false);
      return false;
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try { await scannerRef.current.stop(); } catch (e) {}
    }
    scannerRef.current = null;
  };

  useEffect(() => {
    if (isScanning) startScanner();
    else stopScanner();
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [isScanning]);

  const handleStartCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setIsScanning(true);
    } catch (err: any) {
      console.error("Camera permission error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (err.name === "NotFoundError") {
        toast.error("No camera found on this device.");
      } else {
        toast.error("Could not access camera: " + (err.message || "Unknown error"));
      }
      setCameraError(err.message || "Camera access failed");
    }
  };

  const handleManualSearch = async (val: string) => {
    if (!val) return;
    if (!managerLotId) {
      toast.error("Parking Lot not assigned to your account.");
      return;
    }
    setIsLoading(true);
    try {
      let query = supabase
        .from("reservations")
        .select(`
          id, status, plate_number, total_amount, start_time, end_time,
          created_at, payment_method, user_id,
          parking_slots ( id, label ),
          profiles:user_id ( full_name, phone_number )
        `)
        .eq("lot_id", managerLotId);

      if (isUUID(val)) query = query.eq("id", val);
      else query = query.ilike("plate_number", `%${val}%`);

      const { data, error } = await query
        .in("status", ["pending", "booked", "active", "reserved", "completed"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("No active or pending booking found.");
        setBookingData(null);
      } else {
        const priorityBooking = data.find(b => b.status.toLowerCase() === 'active') ||
                                data.find(b => ['pending', 'booked', 'reserved'].includes(b.status.toLowerCase())) ||
                                data[0];
        setBookingData(priorityBooking);
        toast.success(`Booking found for ${priorityBooking.plate_number}!`);
      }
    } catch (err: any) {
      console.error("Search error:", err);
      toast.error("Search failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleManualSearch(searchInput.trim());
  };

 const handleUpdateStatus = async (newStatus: 'active' | 'completed') => {
  if (!bookingData) return;
  setIsLoading(true);
  try {
    const updatePayload: any = { status: newStatus };
    // Do NOT change start_time, keep original reservation start_time
    const { error: resError } = await supabase
      .from("reservations")
      .update(updatePayload)
      .eq("id", bookingData.id);
    if (resError) throw resError;

    // Update slot status only on exit (completed)
    if (newStatus === 'completed' && bookingData.parking_slots?.id) {
      await supabase.from("parking_slots").update({ status: "available" }).eq("id", bookingData.parking_slots.id);
    }
    // On entrance (active), do NOT change slot status – keep it 'reserved'
    toast.success(`Successfully updated to ${newStatus}!`);
    await Promise.all([fetchExpectedArrivals(), fetchParkedVehicles(), fetchHistory()]);
    setBookingData((prev: any) => ({ ...prev, status: newStatus }));
  } catch (err: any) {
    console.error("Update error:", err);
    toast.error("Update failed: " + (err.message || "Unknown error"));
  } finally {
    setIsLoading(false);
  }
};
  useEffect(() => {
    if (!bookingData?.id) return;
    const subscription = supabase
      .channel(`reservation-updates-${bookingData.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reservations', filter: `id=eq.${bookingData.id}` },
        (payload) => {
          setBookingData((prev: any) => ({ ...prev, ...payload.new }));
          fetchExpectedArrivals();
          fetchParkedVehicles();
          fetchHistory();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [bookingData?.id]);

  return (
    <AdminLayout title="Operations Hub">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Manual Search & Scanner (unchanged) */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Search size={18} className="text-primary" />
                Manual Search
              </h3>
              <form onSubmit={handleSearchSubmit} className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter Booking ID or Plate No."
                  className="flex-1 h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all uppercase"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 min-w-25"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Search"}
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Camera size={18} className="text-primary" />
                  QR Scanner
                </h3>
                <button
                  onClick={handleStartCamera}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg font-bold transition-colors",
                    isScanning ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                  )}
                >
                  {isScanning ? "Stop Camera" : "Start Camera"}
                </button>
              </div>
              <div className="aspect-video bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center relative overflow-hidden">
                {isScanning ? (
                  <div id="qr-reader" className="w-full h-full"></div>
                ) : (
                  <>
                    <Camera className="w-12 h-12 text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-500">Camera is off</p>
                    {cameraError && (
                      <p className="text-xs text-rose-500 mt-2 max-w-xs text-center">{cameraError}</p>
                    )}
                  </>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                {isScanning ? "Scan the QR code from the driver's ticket" : "Press 'Start Camera' to enable scanner"}
              </p>
            </div>
          </div>

          {/* Right Column: Verification Result (unchanged) */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-border shadow-sm min-h-100 flex flex-col">
              <h3 className="text-sm font-bold text-foreground mb-4">Verification Result</h3>
              {!bookingData ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                  <Car size={48} className="text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-500">Scan a QR code or select from the list below</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-center mb-6">
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold uppercase flex items-center gap-1.5",
                      ['pending', 'booked', 'reserved', 'active'].includes(bookingData.status.toLowerCase()) ? "bg-amber-100 text-amber-700" :
                      bookingData.status.toLowerCase() === 'completed' ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {bookingData.status.toLowerCase() === 'active' ? <ArrowRightCircle size={14} /> : <Clock size={14} />}
                      {bookingData.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-5 space-y-4 mb-6 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Booking ID</p>
                        <p className="font-mono font-bold text-slate-800 leading-tight">{bookingData.id.substring(0, 8)}...</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Slot</p>
                        <p className="font-bold text-primary">{bookingData.parking_slots?.label || "N/A"}</p>
                      </div>
                      <div className="col-span-2 border-y border-slate-200 py-3">
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">
                          <Calendar size={12} /> Schedule Details
                        </p>
                        <p className="font-bold text-slate-700 flex items-center gap-2 flex-wrap">
                          <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                            {formatDate(bookingData.start_time || bookingData.created_at)}
                          </span>
                          <span className="text-slate-400 text-xs">|</span>
                          <span className="text-primary">
                            {formatTimeRange(bookingData.start_time, bookingData.end_time)}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Plate No.</p>
                        <p className="text-lg font-black bg-white border px-3 py-1 rounded-md inline-block tracking-wider">{bookingData.plate_number}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Payment Status</p>
                        <p className={cn("font-bold", bookingData.total_amount > 0 ? "text-emerald-600" : "text-slate-500")}>
                          ₱{bookingData.total_amount || 0}
                          <span className="text-[10px] ml-1 opacity-80">({bookingData.payment_method?.toUpperCase() || 'PAID'})</span>
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Customer</p>
                      <p className="font-semibold text-slate-800">{bookingData.profiles?.full_name || "Guest"}</p>
                      <p className="text-[11px] text-slate-500 italic">{bookingData.profiles?.phone_number || "No contact info"}</p>
                    </div>
                  </div>

                  <div className="mt-auto space-y-3">
                    {(['pending', 'booked', 'reserved'].includes(bookingData.status.toLowerCase())) && (
                      <button
                        onClick={() => handleUpdateStatus('active')}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md active:scale-95"
                      >
                        <ArrowRightCircle size={18} /> Confirm Entrance
                      </button>
                    )}
                    {bookingData.status.toLowerCase() === 'active' && (
                      <button
                        onClick={() => handleUpdateStatus('completed')}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md active:scale-95"
                      >
                        <CheckCircle2 size={18} /> Confirm Exit
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Three tabs: Expected, Parked, Completed History */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('expected')}
              className={cn(
                "flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors",
                activeTab === 'expected' ? "bg-primary/5 text-primary border-b-2 border-primary" : "text-muted-foreground hover:bg-slate-50"
              )}
            >
              <ListTodo size={18} /> Expected ({expectedList.length})
            </button>
            <button
              onClick={() => setActiveTab('parked')}
              className={cn(
                "flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors",
                activeTab === 'parked' ? "bg-primary/5 text-primary border-b-2 border-primary" : "text-muted-foreground hover:bg-slate-50"
              )}
            >
              <ParkingCircle size={18} /> Parked ({parkedList.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors",
                activeTab === 'history' ? "bg-primary/5 text-primary border-b-2 border-primary" : "text-muted-foreground hover:bg-slate-50"
              )}
            >
              <History size={18} /> Completed ({historyList.length})
            </button>
          </div>
          <div className="p-0">
            {activeTab === 'expected' && (
              <div className="divide-y divide-border">
                {expectedList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No expected arrivals.</div>
                ) : (
                  expectedList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => { setSearchInput(item.id); handleManualSearch(item.id); }}
                      className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                          <Car size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-foreground uppercase tracking-wide">{item.plate_number}</p>
                          <p className="text-xs text-muted-foreground">{item.profiles?.full_name || "Guest"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">{formatTime(item.start_time)}</p>
                        <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full inline-block mt-1">EXPECTED</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === 'parked' && (
              <div className="divide-y divide-border">
                {parkedList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No parked vehicles.</div>
                ) : (
                  parkedList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => { setSearchInput(item.id); handleManualSearch(item.id); }}
                      className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                          <Car size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-foreground uppercase tracking-wide">{item.plate_number}</p>
                          <p className="text-xs text-muted-foreground">{item.profiles?.full_name || "Guest"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {/* 🔥 FIX: Show raw start_time (already formatted as "2:50 PM") */}
                         <p className="text-xs text-muted-foreground">Reserved since {formatTime(item.start_time)}</p>
                        <span className="text-[10px] uppercase font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full inline-block mt-1">PARKED</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {activeTab === 'history' && (
              <div className="divide-y divide-border">
                {historyList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No completed history.</div>
                ) : (
                  historyList.map((item) => {
                    const timestamp = item.created_at;
                    return (
                      <div
                        key={item.id}
                        onClick={() => { setSearchInput(item.id); handleManualSearch(item.id); }}
                        className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                            <CheckCircle2 size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-foreground uppercase tracking-wide">{item.plate_number}</p>
                            <p className="text-xs text-muted-foreground">{item.profiles?.full_name || "Guest"}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {formatDate(timestamp)} at {formatTime(timestamp)}
                          </p>
                          <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1">COMPLETED</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}