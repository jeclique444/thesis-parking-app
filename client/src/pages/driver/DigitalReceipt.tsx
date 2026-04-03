/*
 * iParkBayan — DigitalReceiptPage
 * Design: Civic Tech / Official Ticket Aesthetic
 */
import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "../../supabaseClient";
import { toPng, toBlob } from "html-to-image";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react"; // <-- IMPORT ITO PARA SA TOTOONG QR CODE
import { 
  MapPin, 
  Clock, 
  Car, 
  Download, 
  Share2, 
  ShieldCheck, 
  CircleCheck 
} from "lucide-react";

export default function DigitalReceiptPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [res, setRes] = useState<any>(null);
  // ==========================================
  // 🟢 BAGONG STATE PARA KUNIN ANG TOTOONG REF NUMBER 🟢
  // ==========================================
  const [receiptRef, setReceiptRef] = useState<string>("PROCESSING"); 
  const [loading, setLoading] = useState(true);

  const ticketRef = useRef<HTMLDivElement>(null);

  // KUNIN ANG QUERY PARAMETER
  const searchParams = new URLSearchParams(window.location.search);
  const fromRoute = searchParams.get("from");

  // DYNAMIC BACK HANDLER
  const handleBack = () => {
    if (fromRoute === "reservations") {
      navigate("/home"); // Babalik sa My Home
    } else {
      navigate("/reservations"); // Babalik sa Reservation (after successful booking)
    }
  };

  useEffect(() => {
    const fixGoogleFontsCORS = () => {
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      links.forEach(link => {
        const l = link as HTMLLinkElement;
        if (l.href.includes('fonts.googleapis.com') && !l.hasAttribute('crossorigin')) {
          l.setAttribute('crossorigin', 'anonymous');
        }
      });
    };
    fixGoogleFontsCORS();

    const fetchReceipt = async () => {
      // PREVENT SUPABASE ERROR KUNG WALANG ID
      if (!params.id || params.id === "undefined" || params.id === "null") {
        setLoading(false);
        return;
      }

      try {
        // 1. KUNIN ANG RESERVATION DETAILS
        const { data: resData, error: resError } = await supabase
          .from("reservations")
          .select(`
            *,
            parking_lots (name, address),
            parking_slots (label)
          `)
          .eq("id", params.id)
          .single();

        if (resError) throw resError;
        setRes(resData);

        // ==========================================
        // 🟢 2. KUNIN ANG TOTOONG REFERENCE NUMBER SA RECEIPTS TABLE 🟢
        // ==========================================
        const { data: receiptData } = await supabase
          .from("receipts")
          .select("reference_no")
          .eq("reservation_id", params.id)
          .single();

        if (receiptData) {
            setReceiptRef(receiptData.reference_no);
        }

      } catch (err) {
        console.error("Receipt error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReceipt();
  }, [params.id]);

  const handleSaveImage = async () => {
    if (!ticketRef.current) return;
    
    toast.loading("Saving ticket to gallery...");
    try {
      const dataUrl = await toPng(ticketRef.current, { 
        pixelRatio: 3,
        fontEmbedCSS: '' 
      });
      
      const link = document.createElement("a");
      link.setAttribute("download", `iParkBayan-Ticket-${res?.plate_number || 'Receipt'}.png`);
      link.setAttribute("href", dataUrl);
      link.click();
      
      toast.dismiss();
      toast.success("Ticket saved successfully!");
    } catch (error) {
      toast.dismiss();
      console.error("Save Error:", error);
      toast.error("Failed to save image.");
    }
  };

  const handleShare = async () => {
    if (!ticketRef.current) return;
    
    const loadingToast = toast.loading("Opening share menu...");
    
    try {
      const blob = await toBlob(ticketRef.current, { 
        pixelRatio: 3,
        fontEmbedCSS: '' 
      });
      
      if (!blob) throw new Error("Failed to generate image.");

      const file = new File([blob], `iParkBayan-Ticket.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "iParkBayan Parking Ticket",
          text: `Here is my official ticket for ${res?.parking_lots?.name}.`,
        });
        toast.dismiss(loadingToast);
      } else {
        throw new Error("Share not supported");
      }

    } catch (error: any) {
      toast.dismiss(loadingToast);
      if (error.name === 'AbortError') return;
      console.error("Share error:", error);
      handleSaveImage();
      toast.info("Share not supported on this browser. Saving image instead.");
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold">Generating Receipt...</div>;
  
  if (!res) return (
    <MobileLayout title="Error" showBack onBack={handleBack}>
      <div className="p-10 text-center">Receipt not found.</div>
    </MobileLayout>
  );

  // DATA NA NASA LOOB NG QR CODE
  const qrData = JSON.stringify({
  id: res.id, // Booking ID (UUID) - Ito ang pinaka-reliable na search key
  plate: res.plate_number,
  ref: receiptRef
});


  const bookingDate = new Date(res.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <MobileLayout title="Digital Receipt" showBack onBack={handleBack}>
      <div className="page-enter p-6 space-y-6 bg-slate-50 min-h-screen">
        
        {/* TICKET CONTAINER */}
        <div ref={ticketRef} className="relative bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          
          <div className="bg-primary p-6 text-white text-center space-y-1">
            <div className="flex justify-center mb-2">
               <div className="bg-white/20 p-2 rounded-full">
                  <ShieldCheck size={24} className="text-white" />
               </div>
            </div>
            <h2 className="text-xl font-black uppercase tracking-widest">Confirmed Booking</h2>
            <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest">ECPark Official Ticket</p>
          </div>

          <div className="p-8 text-center space-y-6 bg-white">
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mb-1">Your Reserved Slot</p>
              <h1 className="text-6xl font-black text-primary tracking-tighter">
                {res.parking_slots?.label}
              </h1>
            </div>

            <div className="flex justify-center">
              <div className="p-4 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                  {/* TOTOONG SCANNABLE QR CODE */}
                 <QRCodeSVG value={qrData} size={120} level="M" />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-black text-foreground uppercase">{res.plate_number}</p>
              <p className="text-[9px] text-muted-foreground font-bold">Ref: {receiptRef}</p>
            </div>
          </div>

          <div className="relative h-px border-t-2 border-dashed border-gray-200 mx-4 bg-white z-10">
             <div className="absolute -left-6 -top-3 w-6 h-6 bg-slate-50 rounded-full border-r border-gray-100" />
             <div className="absolute -right-6 -top-3 w-6 h-6 bg-slate-50 rounded-full border-l border-gray-100" />
          </div>

          <div className="p-6 space-y-4 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex gap-3">
                <MapPin size={16} className="text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-muted-foreground uppercase">Location</p>
                  <p className="text-[11px] font-bold truncate">{res.parking_lots?.name}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Clock size={16} className="text-primary shrink-0" />
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase">Schedule</p>
                  {/* 👇 Pinalitan natin ito para ipakita ang Date at Time */}
                  <p className="text-[11px] font-bold">{bookingDate}</p>
                  <p className="text-[10px] font-medium text-muted-foreground">{res.start_time} - {res.end_time}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Car size={16} className="text-primary shrink-0" />
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase">Vehicle</p>
                  <p className="text-[11px] font-bold uppercase">{res.plate_number}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <CircleCheck size={16} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase">Payment</p>
                  <p className="text-[11px] font-bold uppercase text-emerald-600">₱{res.total_amount} ({res.payment_method})</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4">
           <Button onClick={handleSaveImage} variant="outline" className="h-12 rounded-2xl gap-2 font-bold border-gray-200">
              <Download size={16} /> Save Image
           </Button>
           <Button onClick={handleShare} variant="outline" className="h-12 rounded-2xl gap-2 font-bold border-gray-200 bg-white shadow-sm hover:bg-gray-50">
              <Share2 size={16} /> Share
           </Button>
        </div>
      </div>
    </MobileLayout>
  );
}