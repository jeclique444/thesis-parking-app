import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/supabaseClient";
import { toast } from "sonner";

export default function AuthCallback() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      const hash = window.location.hash;
      if (!hash || !hash.includes("access_token")) {
        navigate("/login");
        return;
      }

      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken) {
        toast.error("Invalid invitation link");
        navigate("/admin/login");
        return;
      }

      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });

        if (error) throw error;

        if (data.session) {
          toast.success("Invitation verified! Please set your password.");
          // HARD REDIRECT – this always works
          window.location.href = "/set-password";
        } else {
          throw new Error("No session created");
        }
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Verification failed");
        navigate("/admin/login");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Verifying your invitation...</p>
      </div>
    </div>
  );
}