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
import { 
  QrCode, 
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
  const [loading, setLoading] = useState(true);

  const ticketRef = useRef<HTMLDivElement>(null);

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
      try {
        const { data, error } = await supabase
          .from("reservations")
          .select(`
            *,
            parking_lots (name, address),
            parking_slots (label)
          `)
          .eq("id", params.id)
          .single();

        if (error) throw error;
        setRes(data);
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
      // 1. Generate Blob
      const blob = await toBlob(ticketRef.current, { 
        pixelRatio: 3,
        fontEmbedCSS: '' 
      });
      
      if (!blob) throw new Error("Failed to generate image.");

      // 2. Create File
      const file = new File([blob], `iParkBayan-Ticket.png`, { type: "image/png" });

      // 3. Native Share Logic
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "iParkBayan Parking Ticket",
          text: `Here is my official ticket for ${res?.parking_lots?.name}.`,
        });
        toast.dismiss(loadingToast);
      } else {
        // Fallback kung talagang hindi supported ng browser (e.g. Chrome on Desktop or non-HTTPS)
        throw new Error("Share not supported");
      }

    } catch (error: any) {
      toast.dismiss(loadingToast);
      
      // Kung kinalimutan lang ng user yung share menu (AbortError), wag magpakita ng error
      if (error.name === 'AbortError') return;

      console.error("Share error:", error);
      
      // Isagawa ang fallback download kung nag-fail ang share
      handleSaveImage();
      toast.info("Share not supported on this browser. Saving image instead.");
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse font-bold">Generating Receipt...</div>;
  if (!res) return <MobileLayout title="Error" showBack><div className="p-10 text-center">Receipt not found.</div></MobileLayout>;

  return (
    <MobileLayout title="Digital Receipt" showBack onBack={() => navigate("/home")}>
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
            <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest">iParkBayan Official Ticket</p>
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
                 <QrCode size={120} className="text-slate-800" strokeWidth={1.5} />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-black text-foreground uppercase">{res.plate_number}</p>
              <p className="text-[9px] text-muted-foreground font-bold">Ref: {res.id.slice(0, 8).toUpperCase()}</p>
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
                  <p className="text-[11px] font-bold">{res.start_time} - {res.end_time}</p>
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