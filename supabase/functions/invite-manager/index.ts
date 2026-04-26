// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const { email, lot_id, role } = await req.json();
    if (!email || !lot_id || !role) {
      return new Response(
        JSON.stringify({ error: "Missing email, lot_id, or role" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Invite user via Supabase Admin API
    const { data: invitedUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError) {
      // If email already exists (even invited but not accepted), return a conflict error
      if (inviteError.message && (inviteError.message.includes("already been invited") || inviteError.message.includes("already registered") || inviteError.message.includes("already exists"))) {
        return new Response(
          JSON.stringify({ error: "This email has already been invited or registered." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
        );
      }
      throw inviteError;
    }

    const userId = invitedUser.user.id;

    // Insert into admin_profiles with status 'Invited' (instead of 'Active')
    const { error: profileError } = await supabaseAdmin
      .from("admin_profiles")
      .insert({ id: userId, role: role, lot_id: lot_id, status: "Invited" });
    if (profileError) throw profileError;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});