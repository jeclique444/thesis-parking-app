/*
 * iParkBayan — SplashScreen / Landing
 * Design: Civic Tech / Filipino Urban Identity
 * Features: Auth Check (Auto-Login), Enhanced Navigation & Smart City Traffic Overlay
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { MapPin, Shield, Clock, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "../../supabaseClient";

const HERO_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/iparkbayan-hero-abdCRj5qo4byPYNgtsGwCp.webp";
const LOGO_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/iparkbayan-logo-bg-6aFnZw8pmN7ddSm5j3w2s6.webp";

const features = [
  { icon: MapPin, title: "Real-Time Availability", desc: "See open slots instantly as they update" },
  { icon: Shield, title: "Secure Reservations", desc: "Book your slot in advance with confidence" },
  { icon: Clock, title: "Save Time", desc: "No more circling — go straight to your spot" },
];

export default function SplashScreen() {
  const [, navigate] = useLocation();
  const [loaded, setLoaded] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          navigate("/home");
        } else {
          setCheckingAuth(false);
          setTimeout(() => setLoaded(true), 100);
        }
      } catch (error) {
        setCheckingAuth(false);
        setTimeout(() => setLoaded(true), 100);
      }
    };
    
    checkUser();
  }, [navigate]);

  if (checkingAuth) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0A1D37]">
        <Loader2 className="animate-spin text-white opacity-20" size={32} />
      </div>
    );
  }

  return (
    <div className="mobile-shell flex flex-col overflow-hidden bg-white">
      {/* MGA ASTIG NA SMART CITY ANIMATIONS */}
      <style>
        {`
          @keyframes slowPan {
            0% { transform: scale(1.05) translateX(-1%); }
            50% { transform: scale(1.1) translateX(1%) translateY(1%); }
            100% { transform: scale(1.05) translateX(-1%); }
          }
          /* Animasyon ng mga dumadaang sasakyan (Light Trails) */
          @keyframes driveLeft {
            0% { transform: translateX(150vw); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateX(-50vw); opacity: 0; }
          }
          @keyframes driveRight {
            0% { transform: translateX(-50vw); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateX(150vw); opacity: 0; }
          }
          .trail-red {
            box-shadow: 0 0 15px 3px rgba(239, 68, 68, 0.9);
            background: #ef4444;
          }
          .trail-amber {
            box-shadow: 0 0 15px 3px rgba(251, 191, 36, 0.9);
            background: #fbbf24;
          }
        `}
      </style>

      {/* Hero Section */}
      <div className="relative h-[52vh] overflow-hidden bg-[#0A1D37]">
        {/* Base Image (Umuuga nang kaunti) */}
        <img
          src={HERO_IMG}
          alt="Smart Parking"
          className="w-full h-full object-cover opacity-80 mix-blend-luminosity"
          style={{ animation: "slowPan 25s ease-in-out infinite" }}
        />
        
        {/* Gradient Overlay para umangat ang text at ilaw */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A1D37]/60 via-[#0A1D37]/30 to-[#0A1D37]" />

        {/* SMART CITY TRAFFIC OVERLAY (Dito nagaganap ang magic) */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-80" 
          style={{ transform: "rotate(-12deg) scale(1.3)" }} /* Naka-anggulo para mukhang kalsada */
        >
          {/* Lane 1: Papuntang Kaliwa (Red Taillights) */}
          <div className="absolute top-[40%] w-full h-2">
            <div className="w-16 h-1.5 rounded-full trail-red absolute" style={{ animation: "driveLeft 3s linear infinite" }} />
            <div className="w-24 h-1.5 rounded-full trail-red absolute" style={{ animation: "driveLeft 4.5s linear infinite 1.5s" }} />
            <div className="w-10 h-1.5 rounded-full trail-red absolute" style={{ animation: "driveLeft 2.5s linear infinite 3s" }} />
          </div>

          {/* Lane 2: Papuntang Kanan (Amber Headlights) */}
          <div className="absolute top-[48%] w-full h-2">
            <div className="w-20 h-1.5 rounded-full trail-amber absolute" style={{ animation: "driveRight 3.5s linear infinite 0.5s" }} />
            <div className="w-12 h-1.5 rounded-full trail-amber absolute" style={{ animation: "driveRight 2.8s linear infinite 2s" }} />
            <div className="w-32 h-1.5 rounded-full trail-amber absolute" style={{ animation: "driveRight 5s linear infinite 1s" }} />
          </div>
        </div>

        {/* Logo & Title */}
        <div className={`absolute inset-0 flex flex-col items-center justify-end pb-10 px-6 transition-all duration-1000 z-10 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <img src={LOGO_IMG} alt="iParkBayan" className="w-20 h-20 rounded-[2rem] shadow-2xl mb-6 border-4 border-white/10 relative z-10" />
          <h1 className="text-4xl font-black text-white text-center tracking-tighter" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Par<span className="text-amber-400">Kada</span>
          </h1>
          <p className="text-white/70 text-xs text-center mt-2 font-bold uppercase tracking-[0.2em]">
            Lipa City Downtown
          </p>
        </div>
      </div>

      {/* Bottom Sheet */}
      <div className={`flex-1 bg-white rounded-t-[2.5rem] -mt-8 px-8 pt-10 pb-10 flex flex-col shadow-2xl relative z-20 transition-all duration-1000 delay-300 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"}`}>
        
        {/* Features List */}
        <div className="space-y-6 mb-8">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 group-hover:scale-110 transition-transform">
                <Icon size={20} className="text-[#0A1D37]" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-800 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</p>
                <p className="text-[11px] text-slate-400 font-bold mt-0.5 leading-tight">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mt-auto">
          <Button
            onClick={() => navigate("/register")}
            className="w-full h-15 py-7 text-sm font-black rounded-[1.25rem] shadow-xl hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ 
              background: "#0A1D37", 
              color: "white",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              letterSpacing: "0.05em"
            }}
          >
            GET STARTED
            <ChevronRight size={18} />
          </Button>
          
          <Button
            onClick={() => navigate("/login")}
            variant="outline"
            className="w-full h-15 py-7 text-sm font-black rounded-[1.25rem] border-2 border-slate-100 text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "0.05em" }}
          >
            SIGN IN
          </Button>

          <button
            onClick={() => navigate("/admin")}
            className="w-full text-center text-[10px] font-black text-slate-300 hover:text-[#0A1D37] transition-colors py-2 tracking-widest uppercase mt-2"
          >
            Administrator Access →
          </button>
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-6 border-t border-slate-50">
          <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest">
            De La Salle Lipa • IT3C Group 9
          </p>
        </div>
      </div>
    </div>
  );
}