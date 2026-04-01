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
  Car, User, Clock, MapPin, Loader2, ArrowRightCircle 
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  // REALTIME LISTENER: Automatic mag-u-update ang UI kapag may nagbago sa Database!
  useEffect(() => {
    if (!bookingData?.id) return;

    // Makikinig tayo sa mga pagbabago sa mismong reservation ID na naka-display
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
          console.log("Realtime Update Received:", payload);
          // I-update ang UI ng bagong status galing sa database
          setBookingData((prev: any) => ({ ...prev, ...payload.new }));
          toast.info(`Heads up! Booking status was updated to ${payload.new.status.toUpperCase()}`);
        }
      )
      .subscribe();

    // Linisin ang listener kapag nag-search ng iba o umalis sa page
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [bookingData?.id]);

  // 2. Function para mag-search ng Booking ID o Plate Number sa REAL Database
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const queryStr = searchInput.trim();
    
    if (!queryStr) {
      toast.error("Please enter a Booking ID or Plate Number");
      return;
    }

    if (!managerLotId) {
      toast.error("Error: Hindi makita ang assigned Parking Lot mo.");
      return;
    }

    setIsLoading(true);
    setBookingData(null);

    try {
      // FIX: Explicitly naming the foreign key relationship to avoid 'ambiguous' errors
     // Hanapin ang linyang ito sa handleSearch function mo:
let query = supabase
  .from("reservations")
  .select(`
    id, 
    status, 
    plate_number,
    parking_slots ( id, label ),
    profiles ( full_name, phone_number ) -- Gagana na ito dahil sa SQL fix sa itaas
  `)
        .eq("lot_id", managerLotId);

      // Kung exact UUID ang tinype (Booking ID)
      if (isUUID(queryStr)) {
        query = query.eq("id", queryStr);
      } else {
        // Kung hindi UUID, i-assume natin na Plate Number ito
        query = query.ilike("plate_number", `%${queryStr}%`);
      }

      const { data, error } = await query.maybeSingle(); 

      if (error) throw error;

      if (!data) {
        toast.error("Walang nahanap. Siguraduhing tama ang details at naka-assign ito sa iyong Parking Lot.");
      } else {
        setBookingData(data);
        toast.success("Booking found!");
      }
    } catch (err: any) {
      console.error("Search Error:", err);
      toast.error(`Error: ${err.message || "Nagkaproblema sa paghahanap sa database."}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Function para i-update ang status (Check-in o Check-out)
  const handleUpdateStatus = async (newStatus: 'active' | 'completed') => {
    if (!bookingData) return;
    setIsLoading(true);

    try {
      // A. Update Reservation Status
      const { error: resError } = await supabase
        .from("reservations")
        .update({ status: newStatus })
        .eq("id", bookingData.id);

      if (resError) throw resError;

      // B. Update Parking Slot Status
      if (bookingData.parking_slots?.id) {
        const slotStatus = newStatus === 'active' ? 'occupied' : 'available';
        const { error: slotError } = await supabase
          .from("parking_slots")
          .update({ status: slotStatus })
          .eq("id", bookingData.parking_slots.id);

        if (slotError) {
          console.warn("Failed to update slot status, but reservation was updated.", slotError);
        }
      }

      toast.success(`Successfully updated status to ${newStatus.toUpperCase()}!`);
      
    } catch (err) {
      console.error("Update Error:", err);
      toast.error("Failed to update status.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout title="QR Scanner & Check-in">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT COLUMN: Input & Scanner Area */}
          <div className="space-y-4">
            {/* Manual Input Card */}
            <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <Search size={18} className="text-primary" />
                Manual Verification
              </h3>
              <form onSubmit={handleSearch} className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter Exact Booking ID or Plate No."
                  className="flex-1 h-11 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all uppercase"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center min-w-[100px]"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Search"}
                </button>
              </form>
            </div>

            {/* Camera Scanner Placeholder */}
            <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  <Camera size={18} className="text-primary" />
                  QR Scanner
                </h3>
                <button 
                  onClick={() => setIsScanning(!isScanning)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg font-bold transition-colors",
                    isScanning ? "bg-rose-100 text-rose-700 hover:bg-rose-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  )}
                >
                  {isScanning ? "Stop Camera" : "Start Camera"}
                </button>
              </div>

              <div className="aspect-video bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
                {isScanning ? (
                  <div className="space-y-3">
                    <div className="w-48 h-48 border-4 border-emerald-500 rounded-2xl relative">
                      <div className="absolute inset-0 bg-emerald-500/20 animate-pulse" />
                      {/* Fake scanning line */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500 shadow-[0_0_10px_#10b981] animate-[scan_2s_ease-in-out_infinite]" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium animate-pulse">Position QR Code inside the frame</p>
                  </div>
                ) : (
                  <>
                    <QrCodeIcon className="w-12 h-12 text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-500">Camera is currently off</p>
                    <p className="text-xs text-slate-400 mt-1">Click "Start Camera" to scan a customer's QR code.</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Verification Result */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-border shadow-sm min-h-[400px] flex flex-col">
              <h3 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Verification Result
              </h3>

              {!bookingData ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                  <Car size={48} className="text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-500">No booking selected</p>
                  <p className="text-xs text-slate-400">Search for an ID or scan a QR code to view details.</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  {/* Status Badge */}
                  <div className="flex justify-center mb-6">
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5",
                      bookingData.status === 'pending' ? "bg-amber-100 text-amber-700" :
                      bookingData.status === 'active' ? "bg-emerald-100 text-emerald-700" :
                      bookingData.status === 'completed' ? "bg-blue-100 text-blue-700" :
                      "bg-rose-100 text-rose-700"
                    )}>
                      {bookingData.status === 'active' ? <CheckCircle2 size={14} /> : 
                       bookingData.status === 'pending' ? <Clock size={14} /> : null}
                      {bookingData.status}
                    </span>
                  </div>

                  {/* Booking Details Grid */}
                  <div className="bg-slate-50 rounded-xl p-5 space-y-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Booking ID</p>
                        <p className="text-sm font-mono font-bold text-slate-800" title={bookingData.id}>
                          {bookingData.id.substring(0, 8)}...
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Assigned Slot</p>
                        <p className="text-sm font-bold text-primary">{bookingData.parking_slots?.label || "N/A"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Vehicle Plate No.</p>
                        <p className="text-lg font-black text-slate-800 tracking-wider bg-white border border-slate-200 inline-block px-3 py-1 rounded-md">
                          {bookingData.plate_number || "NO PLATE"}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 mt-4 grid grid-cols-2 gap-4">
                       <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1"><User size={12}/> Customer</p>
                        <p className="text-xs font-semibold text-slate-800">{bookingData.profiles?.full_name || "Unknown User"}</p>
                        <p className="text-[10px] text-slate-500">{bookingData.profiles?.phone_number || "No Contact"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Amount Due</p>
                        <p className="text-sm font-bold text-emerald-600">
                          {bookingData.total_amount > 0 ? `₱${bookingData.total_amount}` : "Paid / Free"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto space-y-3">
                    {bookingData.status === 'pending' && (
                      <button 
                        onClick={() => handleUpdateStatus('active')}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all"
                      >
                        <ArrowRightCircle size={18} />
                        Confirm Entry (Check-In)
                      </button>
                    )}

                    {bookingData.status === 'active' && (
                      <button 
                        onClick={() => handleUpdateStatus('completed')}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all"
                      >
                        <CheckCircle2 size={18} />
                        Confirm Exit (Check-Out)
                      </button>
                    )}

                    {(bookingData.status === 'completed' || bookingData.status === 'cancelled') && (
                      <div className="text-center py-3 bg-slate-100 rounded-xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-500">Transaction already {bookingData.status}.</p>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          </div>

        </div>
      </div>
      
      {/* Required style for the fake scanner line animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
      `}} />
    </AdminLayout>
  );
}

// Temporary Icon component for the placeholder
function QrCodeIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="5" height="5" x="3" y="3" rx="1"/>
      <rect width="5" height="5" x="16" y="3" rx="1"/>
      <rect width="5" height="5" x="3" y="16" rx="1"/>
      <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
    </svg>
  );
}