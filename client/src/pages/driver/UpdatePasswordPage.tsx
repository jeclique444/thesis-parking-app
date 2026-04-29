/*
 * iParkBayan - UpdatePasswordPage
 * Back arrow appears only when accessed from Profile page (?from=profile).
 * Recovery links wait for Supabase to restore the session before updateUser is allowed.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";

import { supabase } from "../../supabaseClient";

const BG_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/iparkbayan-mobile-bg-8Wgq9qnQX7R8Lyxjz9xWvm.webp";

export default function UpdatePasswordPage() {
  const [, navigate] = useLocation();
  const [showBackArrow, setShowBackArrow] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyingSession, setVerifyingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Keep the existing profile back-arrow behavior.
    const params = new URLSearchParams(window.location.search);
    const fromProfile = params.get("from") === "profile";
    setShowBackArrow(fromProfile);

    // Debug: log to console to verify
    console.log("UpdatePasswordPage - fromProfile:", fromProfile);
    console.log("window.location.search:", window.location.search);
  }, []);

  useEffect(() => {
    let mounted = true;
    let settled = false;
    let timeoutId: number | undefined;

    const hashParams = new URLSearchParams(
      window.location.hash.startsWith("#")
        ? window.location.hash.substring(1)
        : window.location.hash
    );
    const searchParams = new URLSearchParams(window.location.search);
    const hasUrlToken =
      hashParams.has("access_token") ||
      searchParams.has("access_token") ||
      searchParams.has("code");

    const finishVerification = (ready: boolean, message?: string) => {
      if (!mounted || settled) return;

      settled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      setSessionReady(ready);
      setVerifyingSession(false);

      if (message) {
        toast.error(message);
      }
    };

    // Supabase emits PASSWORD_RECOVERY after it consumes the reset-link hash.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        finishVerification(
          Boolean(session),
          session ? undefined : "Password reset link is invalid or expired."
        );
        return;
      }

      if (event === "SIGNED_IN" && session) {
        finishVerification(true);
      }
    });

    const verifyExistingSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("PASSWORD RESET SESSION ERROR:", error);
        finishVerification(false, "Unable to verify your reset link. Please request a new one.");
        return;
      }

      if (session) {
        finishVerification(true);
        return;
      }

      if (hasUrlToken) {
        // Give onAuthStateChange time to receive PASSWORD_RECOVERY from the URL.
        timeoutId = window.setTimeout(() => {
          finishVerification(false, "Password reset link is invalid or expired.");
        }, 2500);
        return;
      }

      finishVerification(false);
    };

    verifyExistingSession();

    return () => {
      mounted = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      subscription.unsubscribe();
    };
  }, []);

  // --- PASSWORD STRENGTH ---
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

  // --- PASSWORD MATCH ---
  const showMatchError = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sessionReady) {
      toast.error("Password reset session is not ready. Please open the reset link again.");
      return;
    }

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
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Password updated successfully! You can now log in.");
      navigate("/home");
    } catch (error: any) {
      console.error("UPDATE PASSWORD ERROR:", error);
      toast.error(error.message || "Failed to update password. Link might be expired.");
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    navigate("/profile");
  };

  return (
    <div className="mobile-shell flex flex-col h-screen">
      {/* Header Area */}
      <div className="relative h-56 overflow-hidden shrink-0">
        <img src={BG_IMG} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-b from-[oklch(0.18_0.06_255/0.8)] to-[oklch(0.18_0.06_255/0.95)]" />

        {/* Back Button - conditional */}
        {showBackArrow && (
          <button
            onClick={goBack}
            className="absolute top-12 left-4 z-20 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft size={22} />
          </button>
        )}

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
        {verifyingSession ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Verifying your password reset link...
            </p>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Please enter your new password below. Make sure it's at least 8 characters long.
            </p>

            {!sessionReady && (
              <p className="text-sm font-medium text-red-500">
                Your password reset session is missing or expired. Please open a fresh reset link.
              </p>
            )}

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
                  disabled={loading || !sessionReady}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700 transition-colors"
                  disabled={loading || !sessionReady}
                >
                  {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
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
                  disabled={loading || !sessionReady}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700 transition-colors"
                  disabled={loading || !sessionReady}
                >
                  {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {showMatchError && (
                <p className="text-xs font-semibold text-red-500 mt-1">
                  Passwords do not match
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !sessionReady || showMatchError || strength === "Weak Password"}
              className="w-full h-14 text-base font-bold rounded-xl mt-6 shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2"
              style={{ background: "oklch(0.22 0.07 255)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? "Updating..." : "Save New Password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
