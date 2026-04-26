/*
 * ParKada — SetPasswordPage (for newly invited managers)
 * After an invitation link is verified, the manager sets their password here.
 * After setting the password, the admin_profiles status is updated from 'Invited' to 'Active'.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/supabaseClient";

const BG_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/iparkbayan-mobile-bg-8Wgq9qnQX7R8Lyxjz9xWvm.webp";

export default function SetPasswordPage() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Session check – if no session, redirect to login (safety)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expired. Please request a new invitation.");
        setLocation("/admin");
      }
    };
    checkSession();
  }, [setLocation]);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return "";
    if (pass.length < 8) return "Weak Password";
    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pass);
    if (hasLetters && hasNumbers && hasSpecial) return "Very Strong Password";
    if (hasLetters && hasNumbers) return "Strong Password";
    return "Weak Password";
  };

  const strength = getPasswordStrength(password);
  const strengthColor =
    strength === "Weak Password" ? "text-rose-500" :
    strength === "Strong Password" ? "text-amber-600" :
    strength === "Very Strong Password" ? "text-emerald-600" : "text-transparent";

  const showMatchError = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (strength === "Weak Password") {
      toast.error("Please use a stronger password (letters and numbers).");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);

    // 1. Get current session to obtain user id
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user?.id) {
      toast.error("Unable to verify your identity. Please try the invitation link again.");
      setLocation("/admin");
      setLoading(false);
      return;
    }
    const userId = session.user.id;

    // 2. Update the user's password
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      toast.error(passwordError.message);
      setLoading(false);
      return;
    }

    // 3. Change the admin_profiles status from 'Invited' to 'Active'
    const { error: updateError } = await supabase
      .from('admin_profiles')
      .update({ status: 'Active' })
      .eq('id', userId);

    if (updateError) {
      console.warn("Could not update profile status:", updateError);
      toast.warning("Password set, but account activation status could not be updated. Please contact support.");
    } else {
      toast.success("Account activated!");
    }

    toast.success("Password set! You can now log in.");
    setLocation("/admin");
    setLoading(false);
  };

  return (
    <div className="mobile-shell flex flex-col h-screen">
      {/* Header with background */}
      <div className="relative h-48 sm:h-56 shrink-0 overflow-hidden">
        <img src={BG_IMG} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-b from-[oklch(0.18_0.06_255/0.85)] to-[oklch(0.18_0.06_255/0.95)]" />
        <div className="absolute top-4 right-4 opacity-20">
          <ShieldCheck size={48} className="text-white" />
        </div>
        <div className="absolute bottom-6 left-6 right-6">
          <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-1">
            Welcome to ParKada
          </p>
          <h1 className="text-3xl font-extrabold text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Set your password
          </h1>
        </div>
      </div>

      {/* Form Card */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-6 px-6 pt-8 pb-10 overflow-y-auto shadow-inner">
        <form onSubmit={handleSubmit} className="space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            You're almost there! Create a secure password for your manager account.
          </p>

          {/* New Password */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">New Password</Label>
            <div className="relative">
              <Input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className={`h-12 rounded-xl bg-muted/40 transition-all pr-10 ${
                  strength === "Weak Password" && password.length > 0
                    ? "border-rose-500 focus:ring-rose-500/20"
                    : "border-transparent focus:border-primary focus:ring-primary/20"
                }`}
                disabled={loading}
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {password.length > 0 && (
              <p className={`text-xs font-semibold mt-1 ${strengthColor}`}>
                {strength}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">Confirm Password</Label>
            <div className="relative">
              <Input 
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Type your password again"
                className={`h-12 rounded-xl bg-muted/40 transition-all pr-10 ${
                  showMatchError
                    ? "border-rose-500 focus:ring-rose-500/20"
                    : "border-transparent focus:border-primary focus:ring-primary/20"
                }`}
                disabled={loading}
                required
              />
              <button 
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {showMatchError && (
              <p className="text-xs font-semibold text-rose-500 mt-1">
                Passwords do not match
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || showMatchError || strength === "Weak Password"}
            className="w-full h-12 text-base font-bold rounded-xl mt-6 shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2"
            style={{ background: "oklch(0.22 0.07 255)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {loading ? "Setting password..." : "Activate account & login"}
          </Button>

          {/* Terms and Conditions Link */}
          <p className="text-xs text-center text-muted-foreground mt-4">
            By setting a password, you agree to our{" "}
            <a 
              href="/admin/terms" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Terms and Conditions
            </a>.
          </p>
        </form>
      </div>
    </div>
  );
}