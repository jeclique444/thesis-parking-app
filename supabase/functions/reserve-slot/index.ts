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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { slot_id, user_id, lot_id, plate_number, start_time, end_time, duration, total_amount, payment_method } = await req.json();

    if (!slot_id || !user_id || !lot_id || !plate_number || !start_time || !end_time) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for overlapping active reservations
    const { data: conflicts, error: checkError } = await supabaseAdmin
      .from("reservations")
      .select("id")
      .eq("slot_id", slot_id)
      .in("status", ["active", "confirmed", "reserved"])
      .filter("start_time", "lt", end_time)
      .filter("end_time", "gt", start_time)
      .limit(1);

    if (checkError) throw checkError;

    if (conflicts && conflicts.length > 0) {
      // 🔥 User‑friendly message
      return new Response(JSON.stringify({ error: "Slot reservation failed. This slot has just been taken by another user. Please choose a different slot or time." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert reservation
    const { data: newRes, error: insertError } = await supabaseAdmin
      .from("reservations")
      .insert({
        user_id,
        lot_id,
        slot_id,
        plate_number: plate_number.toUpperCase(),
        start_time,
        end_time,
        duration,
        total_amount,
        payment_method,
        status: "active",
        extension_count: 0,
        extension_fee: 0,
        fine_amount: 0,
        fine_paid: false,
        original_end_time: end_time,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update slot status
    await supabaseAdmin
      .from("parking_slots")
      .update({ status: "reserved" })
      .eq("id", slot_id);

    return new Response(JSON.stringify({ success: true, reservation: newRes }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});