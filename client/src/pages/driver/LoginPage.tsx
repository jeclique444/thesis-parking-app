/*
 * iParkBayan — LoginPage (Connected to Supabase + Forgot Password + Admin Bouncer)
 * Design: Civic Tech / Filipino Urban Identity
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";

import { supabase } from "../../supabaseClient";

const BG_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/iparkbayan-mobile-bg-8Wgq9qnQX7R8Lyxjz9xWvm.webp";

export default function LoginPage() {
  const [, navigate] = useLocation();
  
  // Views: 'login' o 'forgot'
  const [view, setView] = useState<"login" | "forgot">("login");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- LOGIC PARA SA LOGIN (WITH ADMIN BOUNCER) ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      // 1. Mag-login muna
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      const userId = authData.user?.id;

      if (userId) {
        // 2. ANG BOUNCER: I-check kung Admin ba ito
        const { data: adminData } = await supabase
          .from('admin_profiles')
          .select('id')
          .eq('id', userId)
          .single();

        // 3. Kung may record siya sa admin_profiles -> KICK OUT!
        if (adminData) {
          await supabase.auth.signOut(); // I-log out agad
          throw new Error("Access Denied: Admin accounts cannot use the Driver App. Please log in via the Admin Portal.");
        }

        // 4. Kung regular user, papasukin!
        toast.success("Login successful! Welcome back.");
        navigate("/home"); 
      }
    } catch (error: any) {
      console.error("LOGIN ERROR:", error);
      toast.error(error.message || "Invalid login credentials.");
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIC PARA SA FORGOT PASSWORD ---
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address first.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;

      toast.success("Password reset link sent! Please check your inbox.");
      setView("login"); 
      
    } catch (error: any) {
      console.error("RESET ERROR:", error);
      toast.error(error.message || "Failed to send reset link. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-shell flex flex-col h-screen">
      {/* Header Area */}
      <div className="relative h-56 overflow-hidden shrink-0">
        <img src={BG_IMG} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.18_0.06_255/0.8)] to-[oklch(0.18_0.06_255/0.95)]" />
        
        {/* Back Button */}
        <button 
          onClick={() => view === "forgot" ? setView("login") : navigate("/")} 
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="absolute bottom-8 left-6 right-6">
          <p className="text-white/70 text-sm font-medium mb-1">
            {view === "login" ? "Welcome to ParKada: Your Parking Buddy" : "Account Recovery"}
          </p>
          <h1 className="text-3xl font-extrabold text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {view === "login" ? "Sign In" : "Reset Password"}
          </h1>
        </div>
      </div>

      {/* Form Area */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-6 px-6 pt-8 pb-8 overflow-y-auto transition-all duration-300">
        
        {view === "login" ? (
          // --- LOGIN FORM ---
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Email Address</Label>
              <Input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="juan@example.com" 
                className="h-14 rounded-xl bg-muted/40 border-transparent focus:border-primary focus:ring-primary/20 transition-all" 
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              {/* Nilinis ko yung label part, inalis na yung button dito */}
              <Label className="text-sm font-semibold text-gray-700">Password</Label>
              
              <div className="relative">
                <Input 
                  type={showPass ? "text" : "password"} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Enter your password" 
                  className="h-14 rounded-xl bg-muted/40 border-transparent focus:border-primary focus:ring-primary/20 transition-all pr-12" 
                  disabled={loading}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPass(!showPass)} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700 transition-colors"
                >
                  {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {/* Dito ko inilipat ang Forgot Password sa ilalim ng input */}
              <div className="flex justify-end pt-1">
                <button 
                  type="button" 
                  onClick={() => setView("forgot")} 
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 text-base font-bold rounded-xl mt-2 shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2"
              style={{ background: "oklch(0.22 0.07 255)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <p className="text-center text-sm text-muted-foreground mt-8">
              Don't have an account yet?{" "}
              <button 
                type="button"
                onClick={() => navigate("/register")} 
                className="text-primary font-semibold hover:underline"
              >
                Create Account
              </button>
            </p>
          </form>

        ) : (
          
          // --- FORGOT PASSWORD FORM ---
          <form onSubmit={handleResetPassword} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Enter the email address associated with your account and we'll send you a link to reset your password.
            </p>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Email Address</Label>
              <Input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="juan@example.com" 
                className="h-14 rounded-xl bg-muted/40 border-transparent focus:border-primary focus:ring-primary/20 transition-all" 
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 text-base font-bold rounded-xl mt-4 shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2"
              style={{ background: "oklch(0.22 0.07 255)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? "Sending link..." : "Send Reset Link"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => setView("login")}
              className="w-full h-14 text-sm font-semibold rounded-xl mt-2 text-muted-foreground hover:text-foreground"
            >
              Back to Login
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}