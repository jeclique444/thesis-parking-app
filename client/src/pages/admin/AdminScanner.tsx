/*
 * iParkBayan — AdminScanner (Manager QR & Manual Check-in)
 * Design: Civic Tech / Filipino Urban Identity
 */
import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/supabaseClient";
import { toast } from "sonner";
import { 
  Camera, Search, CheckCircle2, XCircle, 
  Car, User, Clock, MapPin, Loader2, ArrowRightCircle, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Html5QrcodeScanner } from "html5-qrcode";

// Helper function para ma-check kung UUID ba ang tinype ng user
const isUUID = (uuid: string) => {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid);
};

export default function AdminScanner() {
  const [managerLotId, setManagerLotId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Dito natin ise-save ang nahanap na reservation
  const [bookingData, setBookingData] = useState<any | null>(null);

  // 1. Kunin ang Lot ID ng naka-login na manager
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

  // 🟢 SCANNER LOGIC: Pinapagana ang camera
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;

    if (isScanning) {
      scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(
        (decodedText) => {
          try {
            const parsed = JSON.parse(decodedText);
            const idToSearch = parsed.id || parsed.ref || decodedText;
            setSearchInput(idToSearch);
            handleManualSearch(idToSearch);
          } catch (e) {
            setSearchInput(decodedText);
            handleManualSearch(decodedText);
          }
          setIsScanning(false);
          scanner?.clear();
        },
        (error) => { /* scanning... */ }
      );
    }

    return () => {
      if (scanner) scanner.clear().catch(console.error);
    };
  }, [isScanning]);

  // REALTIME LISTENER
  useEffect(() => {
    if (!bookingData?.id) return;

    const subscription = supabase
      .channel(`reservation-updates-${bookingData.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reservations',
          filter: `id=eq.${bookingData.id}`
        },
        (payload) => {
          setBookingData((prev: any) => ({ ...prev, ...payload.new }));
          toast.info(`Status updated to ${payload.new.status.toUpperCase()}`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [bookingData?.id]);

  // 2. Search Function (Manual at Auto-scan)
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
          id, 
          status, 
          plate_number,
          total_amount,
          start_time,
          end_time,
          created_at,
          payment_method,
          parking_slots ( id, label ),
          profiles:user_id ( full_name, phone_number )
        `)
        .eq("lot_id", managerLotId);

      if (isUUID(val)) {
        query = query.eq("id", val);
      } else {
        query = query.ilike("plate_number", `%${val}%`);
      }

      const { data, error } = await query.maybeSingle(); 

      if (error) throw error;
      if (!data) {
        toast.error("No booking found in your parking lot.");
        setBookingData(null);
      } else {
        setBookingData(data);
        toast.success("Booking found!");
      }
    } catch (err: any) {
      toast.error("Search failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleManualSearch(searchInput.trim());
  };

  // 3. Status Update
  const handleUpdateStatus = async (newStatus: 'active' | 'completed') => {
    if (!bookingData) return;
    setIsLoading(true);

    try {
      const { error: resError } = await supabase
        .from("reservations")
        .update({ status: newStatus })
        .eq("id", bookingData.id);

      if (resError) throw resError;

      if (bookingData.parking_slots?.id) {
        const slotStatus = newStatus === 'active' ? 'occupied' : 'available';
        await supabase
          .from("parking_slots")
          .update({ status: slotStatus })
          .eq("id", bookingData.parking_slots.id);
      }

      toast.success(`Successfully updated to ${newStatus}!`);
    } catch (err) {
      toast.error("Update failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout title="QR Scanner & Check-in">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div className="space-y-4">
            {/* Manual Input */}
            <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Search size={18} className="text-primary" />
                Manual Verification
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
                  className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 min-w-[100px]"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Search"}
                </button>
              </form>
            </div>

            {/* QR Scanner */}
            <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Camera size={18} className="text-primary" />
                  QR Scanner
                </h3>
                <button 
                  onClick={() => setIsScanning(!isScanning)}
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
                  <div id="reader" className="w-full h-full"></div>
                ) : (
                  <>
                    <QrCodeIcon className="w-12 h-12 text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-500">Camera is off</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Verification Result */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-border shadow-sm min-h-[400px] flex flex-col">
              <h3 className="text-sm font-bold text-foreground mb-4">Verification Result</h3>

              {!bookingData ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                  <Car size={48} className="text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-500">No booking selected</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-center mb-6">
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold uppercase flex items-center gap-1.5",
                      bookingData.status === 'pending' ? "bg-amber-100 text-amber-700" :
                      bookingData.status === 'active' ? "bg-emerald-100 text-emerald-700" :
                      bookingData.status === 'completed' ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {bookingData.status === 'active' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                      {bookingData.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-5 space-y-4 mb-6 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Booking ID</p>
                        <p className="font-mono font-bold text-slate-800 leading-tight">
                          {bookingData.id.substring(0, 8)}...
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Slot</p>
                        <p className="font-bold text-primary">{bookingData.parking_slots?.label || "N/A"}</p>
                      </div>

                      {/* BAGONG SECTION: Schedule */}
                    <div className="col-span-2 border-y border-slate-200 py-3">
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">
                       <Calendar size={12}/> Schedule Details
                     </p>
                    <p className="font-bold text-slate-700 flex items-center gap-2">
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                     {/* Gagamit tayo ng fallback: reservation_date o created_at */}
                   {bookingData.reservation_date 
                     ? new Date(bookingData.reservation_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                      : bookingData.created_at 
                         ? new Date(bookingData.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                         : "N/A"}
                    </span>
                     <span className="text-slate-400 text-xs">|</span>
                    <span className="text-primary">{bookingData.start_time || "00:00"} - {bookingData.end_time || "00:00"}</span>
                     </p>
                    </div>

                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Plate No.</p>
                        <p className="text-lg font-black bg-white border px-3 py-1 rounded-md inline-block tracking-wider">
                          {bookingData.plate_number}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Payment Status</p>
                        <p className={cn(
                          "font-bold",
                          bookingData.total_amount > 0 ? "text-emerald-600" : "text-slate-500"
                        )}>
                          ₱{bookingData.total_amount || 0} 
                          <span className="text-[10px] ml-1 opacity-80">
                            ({bookingData.payment_method?.toUpperCase() || 'PAID'})
                          </span>
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
                    {bookingData.status === 'pending' && (
                      <button 
                        onClick={() => handleUpdateStatus('active')}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md active:scale-95"
                      >
                        <ArrowRightCircle size={18} /> Confirm Entry
                      </button>
                    )}
                    {bookingData.status === 'active' && (
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
      </div>
    </AdminLayout>
  );
}

function QrCodeIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/>
      <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
    </svg>
  );
}