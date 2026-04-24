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
import TrueFocus from "@/components/ui/focus";
import DarkVeil from "@/components/ui/dark-veil"; // Make sure this says 'dark-veil' and not 'focus'!

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

{/* Left Panel — TrueFocus + DarkVeil Background */}
      <div className="hidden lg:flex lg:w-[65%] relative overflow-hidden bg-black">
        
        {/* The WebGL Shader Background */}
        <div className="absolute inset-0 z-0">
          <DarkVeil
            speed={2.0}              // Slow, moody movement
            noiseIntensity={0.06}    // Subtle retro film grain
            scanlineIntensity={0.3}  // Slight CRT scanlines
            scanlineFrequency={800}
            hueShift={0}           // Shifts the shader colors towards a deep purple/blue to match your vibe
            warpAmount={0.3}
            resolutionScale={1}
          />
        </div>

        {/* The Foreground Content (Sits on top) */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full h-full">
          
          {/* Top: Branding */}
          <div className="flex items-center gap-3">
            {/* Replace src with your actual logo path (e.g., "/logo.png" or "/assets/logo.svg") */}
            <img 
              src="/ParKada.png" 
              alt="ParKada Logo" 
              className="w-10 h-10 object-contain drop-shadow-md" 
            />
            <span
              className="text-xl font-extrabold text-white"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Par<span className="text-amber-400">Kada</span>
            </span>
          </div>

          {/* Middle: The TrueFocus Hero Section */}
          <div className="flex-1 flex flex-col justify-center items-start -mt-12">
            
            {/* The TrueFocus Component */}
            <div className="text-white w-full flex justify-start mb-6">
              <TrueFocus 
                sentence="Parking Management Center"
                manualMode={false}
                blurAmount={4}
                borderColor="#0df103" 
                glowColor="rgba(13, 241, 3, 0.4)"
                animationDuration={0.6}
                pauseBetweenAnimations={1.5}
              />
            </div>

            <p className="text-white/80 mt-6 text-lg max-w-md leading-relaxed drop-shadow-md">
              Your centralized hub for managing parking reservations, occupancy, and facility operations.
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mt-12 w-full max-w-md">
              {[
                { label: "Registered Partners", value: "4" },
                { label: "Occupancy Rate", value: "86%" },
                { label: "Active Users", value: "28" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-black/30 rounded-xl p-4 text-center backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors shadow-lg">
                  <p className="text-3xl font-extrabold text-white">{value}</p>
                  <p className="text-xs text-white/70 mt-1 uppercase tracking-wider font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Footer */}
          <p className="text-white/50 text-xs tracking-wide font-medium">
             IT3C Group 9 · De La Salle Lipa · 2026
          </p>
          <p className="text-white/50 text-xs tracking-wide font-medium">
             Alcantara · Cadeliña · Lique · Mendez
          </p>
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