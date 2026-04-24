/*
 * iParkBayan — AdminLogin (Multi-Tenant / Lot-Specific)
 * Design: Civic Tech / Filipino Urban Identity
 * Full-screen admin login with navy sidebar and form
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Shield, Loader2 } from "lucide-react";
import { supabase } from "@/supabaseClient";
import { Radar } from "@/components/ui/radar"; // 👈 adjust import path as needed

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (authError) throw authError;

      const userId = authData.user?.id;

      if (userId) {
        const { data: profileData, error: profileError } = await supabase
          .from("admin_profiles")
          .select("lot_id, role, status")
          .eq("id", userId)
          .single();

        if (profileError || !profileData) {
          await supabase.auth.signOut();
          throw new Error("Access Denied: Wala kang access sa admin portal.");
        }

        if (profileData.status === "Suspended") {
          await supabase.auth.signOut();
          throw new Error("Access Denied: Ang iyong account ay suspended. Makipag-ugnayan sa Super Admin.");
        }

        localStorage.setItem("admin_role", profileData.role);

        if (profileData.lot_id) {
          localStorage.setItem("admin_lot_id", profileData.lot_id);
        } else {
          localStorage.removeItem("admin_lot_id");
        }

        if (profileData.role === "guard") {
          toast.success("Welcome, Guard! Opening scanner...");
          navigate("/admin/scanner");
        } else if (profileData.role === "manager") {
          toast.success("Welcome, Lot Manager!");
          navigate("/admin/dashboard");
        } else {
          toast.success("Welcome, Super Admin!");
          navigate("/admin/dashboard");
        }
      }
    } catch (error: any) {
      console.error("Login Error:", error);
      localStorage.removeItem("admin_role");
      localStorage.removeItem("admin_lot_id");
      toast.error(error.message || "Mali ang email o password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
{/* Left Panel — BRANDING OVER PARKING LOT PHOTO */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-cover bg-center"
        style={{ 
          // 1. SET YOUR PARKING LOT BACKGROUND IMAGE HERE:
          backgroundImage: "url('https://images.unsplash.com/photo-1590674042211-f1190547b744?q=80&w=1920&auto=format&fit=crop')" 
        }}
      >
        {/* Dark overlay to ensure text readability over the photo */}
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950/95 to-navy-950/60" />

        {/* 2. THE RADAR WIDGET AREA — Centered, relative to panel */}
        <div className="flex-1 flex items-center justify-center relative p-8">
          
          {/* A circular container for the radar to look like a screen widget */}
          <div className="w-80 h-80 rounded-full border-4 border-navy-700 bg-navy-950/50 backdrop-blur-sm relative overflow-hidden shadow-2xl shadow-black/30">
            {/* The Radar itself — note scale increased to fill the smaller container */}
            <Radar
              speed={0.7}
              scale={1.5} // Increased scale slightly to fit circular view
              ringCount={10}
              spokeCount={5}
              ringThickness={0.06}
              spokeThickness={0.015}
              sweepSpeed={1.0}
              sweepWidth={6}
              sweepLobes={1}
              color="#F59E0B" // iParkBayan Amber pops better on photo
              backgroundColor="transparent" // 3. MUST BE TRANSPARENT
              falloff={1}
              brightness={1.0}
              enableMouseInteraction={true} // Mouse works only inside this circle
              mouseInfluence={0.2}
            />
          </div>
        </div>

        {/* Branding content — sits on top, mouse passes through */}
        <div className="absolute inset-0 flex flex-col justify-between p-12 z-10 pointer-events-none">
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="oklch(0.18 0.06 255)">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </div>
            <span
              className="text-xl font-extrabold text-white"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Par<span className="text-amber-400">Kada</span>
            </span>
          </div>

          {/* Text/Stats Section (Now aligned bottom left) */}
          <div>
            <h1
              className="text-4xl font-extrabold text-white leading-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Smart Parking<br/>Management
            </h1>
            <p className="text-white/80 mt-3 text-base max-w-sm">
              Monitor real-time parking availability, manage reservations, and generate reports for Lipa City Downtown.
            </p>
            <div className="grid grid-cols-3 gap-4 mt-8">
              {[
                { label: "Total Slots", value: "92" },
                { label: "Active Users", value: "156" },
                { label: "Today's Bookings", value: "28" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm border border-white/10">
                  <p className="text-2xl font-extrabold text-white">{value}</p>
                  <p className="text-[11px] text-white/70">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Text */}
          <p className="text-white/40 text-xs">De La Salle Lipa · IT3C Group 9 · 2026</p>
        </div>
      </div>
      
      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </div>
            <span
              className="text-xl font-extrabold text-foreground"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              ParKada
            </span>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} className="text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin Portal</span>
          </div>
          <h2
            className="text-3xl font-extrabold text-foreground mb-1"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Sign In
          </h2>
          <p className="text-muted-foreground text-sm mb-8">Access the parking management dashboard</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Email Address</Label>
              <Input
                type="email"
                placeholder="admin@parkada.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl bg-muted/40"
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Password</Label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl bg-muted/40 pr-12"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-bold rounded-xl mt-2 flex justify-center items-center gap-2"
              style={{ background: "oklch(0.22 0.07 255)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? "Signing in..." : "Sign In to Dashboard"}
            </Button>
          </form>

          <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-xs text-primary/80 text-center font-medium">
              Authorized personnel only. Secure login via Supabase.
            </p>
          </div>

          <button
            onClick={() => navigate("/")}
            className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors block text-center w-full"
          >
            ← Back to Driver App
          </button>
        </div>
      </div>
    </div>
  );
}