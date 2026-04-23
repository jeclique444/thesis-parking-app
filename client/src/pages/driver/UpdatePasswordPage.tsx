/*
 * iParkBayan — UpdatePasswordPage
 * Design: Civic Tech / Filipino Urban Identity
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { supabase } from "../../supabaseClient";

const BG_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/iparkbayan-mobile-bg-8Wgq9qnQX7R8Lyxjz9xWvm.webp";

export default function UpdatePasswordPage() {
  const [, navigate] = useLocation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- LOGIC PARA SA PASSWORD STRENGTH ---
  const getPasswordStrength = (pass: string) => {
    if (!pass) return "";
    if (pass.length < 8) return "Weak Password";

    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pass);

    if (hasLetters && hasNumbers && hasSpecial) {
      return "Very Strong Password";
    } else if (hasLetters && hasNumbers) {
      return "Strong Password";
    }
    return "Weak Password";
  };

  const strength = getPasswordStrength(newPassword);

  const strengthColor =
    strength === "Weak Password" ? "text-red-500" :
    strength === "Strong Password" ? "text-yellow-600" :
    strength === "Very Strong Password" ? "text-green-600" : "text-transparent";

  // --- LOGIC PARA SA PASSWORD MATCH ---
  const showMatchError = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    if (strength === "Weak Password") {
      toast.error("Please use a stronger password (must contain letters and numbers).");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // Supabase Update Password function
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Password updated successfully! You can now log in.");
      // I-redirect ang user sa login screen (usually sa "/" kung nandoon ang login mo)
      navigate("/"); 
      
    } catch (error: any) {
      console.error("UPDATE PASSWORD ERROR:", error);
      toast.error(error.message || "Failed to update password. Link might be expired.");
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
        
        <div className="absolute bottom-8 left-6 right-6">
          <p className="text-white/70 text-sm font-medium mb-1">
            Secure your account
          </p>
          <h1 className="text-3xl font-extrabold text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            New Password
          </h1>
        </div>
      </div>

      {/* Form Area */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-6 px-6 pt-8 pb-8 overflow-y-auto">
        <form onSubmit={handleUpdate} className="space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Please enter your new password below. Make sure it's at least 8 characters long.
          </p>

          {/* New Password Field */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">New Password</Label>
            <div className="relative">
              <Input 
                type={showPass ? "text" : "password"} 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                placeholder="Min. 8 characters" 
                className={`h-14 rounded-xl bg-muted/40 transition-all pr-12 ${
                  strength === "Weak Password" ? "border-red-500 focus:ring-red-500/20" : "border-transparent focus:border-primary focus:ring-primary/20"
                }`}
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
            {/* STRENGTH INDICATOR */}
            {newPassword.length > 0 && (
              <p className={`text-xs font-semibold mt-1 ${strengthColor}`}>
                {strength}
              </p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">Confirm Password</Label>
            <div className="relative">
              <Input 
                type={showConfirm ? "text" : "password"} 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="Type your password again" 
                className={`h-14 rounded-xl bg-muted/40 transition-all pr-12 ${
                  showMatchError
                    ? "border-red-500 focus:ring-red-500/20"
                    : "border-transparent focus:border-primary focus:ring-primary/20"
                }`}
                disabled={loading}
              />
              <button 
                type="button" 
                onClick={() => setShowConfirm(!showConfirm)} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700 transition-colors"
              >
                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {/* MATCH INDICATOR */}
            {showMatchError && (
              <p className="text-xs font-semibold text-red-500 mt-1">
                Passwords do not match
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || showMatchError || strength === "Weak Password"}
            className="w-full h-14 text-base font-bold rounded-xl mt-6 shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2"
            style={{ background: "oklch(0.22 0.07 255)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {loading ? "Updating..." : "Save New Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}