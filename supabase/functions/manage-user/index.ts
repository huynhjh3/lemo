// Create or delete a user account — Master Admin only.
//
// Creating/deleting a Supabase Auth login requires the service-role key,
// which can never be shipped to the browser, so this has to run server-side.
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically into every Edge Function deployed to this project — nothing
// to configure by hand.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Not scoped to one origin: the real access control is the JWT + is_master_admin
// lookup below, not CORS (a non-browser client can set any Origin header anyway,
// and pinning this to one hostname is exactly what broke when the site moved to
// a custom domain).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify the caller's own JWT (never trust a client-supplied user id).
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !caller) {
    return json({ error: "Not authenticated" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("is_master_admin")
    .eq("id", caller.id)
    .maybeSingle();
  if (!callerProfile?.is_master_admin) {
    return json({ error: "Master Admin only" }, 403);
  }

  const body = await req.json().catch(() => ({}));

  if (body.action === "create") {
    const { email, name, role, region, company_id, redirectTo } = body;
    if (!email || !name || !role) {
      return json({ error: "email, name, and role are required" }, 400);
    }
    if (role === "partner" && !company_id) {
      return json({ error: "company_id is required for a partner account" }, 400);
    }
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (inviteErr) return json({ error: inviteErr.message }, 400);

    const { error: profileErr } = await admin
      .from("profiles")
      .insert({ id: invited.user.id, name, role, region: region || null, company_id: company_id || null });
    if (profileErr) {
      // Don't leave a login with no matching profiles row behind.
      await admin.auth.admin.deleteUser(invited.user.id);
      return json({ error: profileErr.message }, 400);
    }
    return json({ ok: true, id: invited.user.id });
  }

  if (body.action === "delete") {
    const { id } = body;
    if (!id) return json({ error: "id is required" }, 400);
    if (id === caller.id) return json({ error: "You can't delete your own account" }, 400);

    const { error: deleteErr } = await admin.auth.admin.deleteUser(id);
    if (deleteErr) return json({ error: deleteErr.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
