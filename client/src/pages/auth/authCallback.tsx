import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/supabaseClient";
import { toast } from "sonner";

export default function AuthCallback() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(
        hash.startsWith("#") ? hash.substring(1) : hash
      );
      const type = searchParams.get("type") || hashParams.get("type");

      // Password recovery links belong to the regular user reset flow.
      // Preserve the hash because Supabase stores access_token/refresh_token there.
      if (type === "recovery") {
        window.location.replace(`/update-password${window.location.search}${hash}`);
        return;
      }

      if (!hash || !hash.includes("access_token")) {
        navigate("/login");
        return;
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

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
          // Manager invitations keep their existing destination.
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
