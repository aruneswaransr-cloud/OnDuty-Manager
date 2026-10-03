import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(url, serviceKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await client.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: admin } = await client.from("staff_profiles").select("user_id").eq("user_id", user.id).eq("role", "admin").eq("active", true).maybeSingle();
    if (!admin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body = await req.json();
    if (typeof body.fullName !== "string" || typeof body.email !== "string" || typeof body.password !== "string" || body.password.length < 6) return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: created, error: createError } = await client.auth.admin.createUser({ email: body.email.trim(), password: body.password, email_confirm: true });
    if (createError || !created.user) return new Response(JSON.stringify({ error: "Could not create advisor" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { error: profileError } = await client.from("staff_profiles").insert({ user_id: created.user.id, full_name: body.fullName.trim(), role: "advisor", active: true });
    if (profileError) { await client.auth.admin.deleteUser(created.user.id); return new Response(JSON.stringify({ error: "Could not create advisor" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch { return new Response(JSON.stringify({ error: "Request failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
});
