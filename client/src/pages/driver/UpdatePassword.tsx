/*
 * iParkBayan — UpdatePasswordPage
 * Connected to Supabase updateUser
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { supabase } from "../../supabaseClient";

export default function UpdatePasswordPage() {
  const [, navigate] = useLocation();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
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

  // Dynamic colors para sa strength indicator
  const strengthColor =
    strength === "Weak Password" ? "text-red-500" :
    strength === "Strong Password" ? "text-yellow-600" :
    strength === "Very Strong Password" ? "text-green-600" : "text-transparent";

  // --- LOGIC PARA SA PASSWORD MATCH ---
  const passwordsMatch = newPassword === confirmPassword;
  const showMatchError = confirmPassword.length > 0 && !passwordsMatch;

  // --- SUBMIT HANDLER ---
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in both password fields.");
      return;
    }

    if (strength === "Weak Password") {
      toast.error("Please use a stronger password (at least 8 characters, with letters and numbers).");
      return;
    }

    if (!passwordsMatch) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // Supabase function para i-update yung password ng naka-log in na user 
      // (kapag na-click ang reset link, automatic na may active session si user para mag-update)
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Password updated successfully! You can now sign in.");
      navigate("/"); // I-redirect pabalik sa login page

    } catch (error: any) {
      console.error("UPDATE ERROR:", error);
      toast.error(error.message || "Failed to update password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-shell flex flex-col h-screen bg-white">
      {/* Header Area (Dark Blue based on screenshot) */}
      <div className="relative pt-12 pb-8 px-6 shrink-0" style={{ background: "oklch(0.22 0.07 255)" }}>
        <p className="text-white/70 text-sm font-medium mb-1">Secure your account</p>
        <h1 className="text-3xl font-extrabold text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          New Password
        </h1>
      </div>

      {/* Form Area */}
      <div className="flex-1 px-6 pt-6 pb-8 overflow-y-auto">
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Please enter your new password below. Make sure it's at least 8 characters long.
        </p>

        <form onSubmit={handleUpdatePassword} className="space-y-5">
          
          {/* NEW PASSWORD FIELD */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">New Password</Label>
            <div className="relative">
              <Input
                type={showNewPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="h-14 rounded-xl bg-muted/40 border-transparent focus:border-primary focus:ring-primary/20 transition-all pr-12"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700 transition-colors"
              >
                {showNewPass ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {/* STRENGTH INDICATOR */}
            {newPassword.length > 0 && (
              <p className={`text-xs font-semibold mt-1 ${strengthColor}`}>
                {strength}
              </p>
            )}
          </div>

          {/* CONFIRM PASSWORD FIELD */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">Confirm Password</Label>
            <div className="relative">
              <Input
                type={showConfirmPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type your password"
                className={`h-14 rounded-xl bg-muted/40 transition-all pr-12 ${
                  showMatchError
                    ? "border-red-500 focus:ring-red-500/20"
                    : "border-transparent focus:border-primary focus:ring-primary/20"
                }`}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700 transition-colors"
              >
                {showConfirmPass ? <EyeOff size={20} /> : <Eye size={20} />}
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
            {loading ? "Saving..." : "Save New Password"}
          </Button>

        </form>
      </div>
    </div>
  );
}