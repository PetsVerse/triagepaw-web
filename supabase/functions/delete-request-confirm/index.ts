import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_URL = "https://api.resend.com/emails";
const NOTIFY_TO = "contact@triagepaw.com";
const FROM_SENDER = "TriagePaw <contact@triagepaw.com>";

/** Expected table: account_deletion_requests (id, name, email, reason, confirmation_token, confirmed_at, created_at) */
const TABLE_NAME = "account_deletion_requests";

interface RequestBody {
  token?: string;
}

const escapeHtml = (s: string): string => {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

/** Allowed origins for CORS (comma-separated in ALLOWED_ORIGINS, or single ALLOWED_ORIGIN). Defaults to * if unset. */
function getAllowedOrigin(requestOrigin: string | null): string {
  const origins = Deno.env.get("ALLOWED_ORIGINS") ?? Deno.env.get("ALLOWED_ORIGIN") ?? "";
  const list = origins.split(",").map((o) => o.trim()).filter(Boolean);
  if (list.length === 0) return "*";
  if (requestOrigin && list.some((o) => o === requestOrigin || o === "*")) return requestOrigin;
  return list[0];
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data: object, status: number, origin: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

Deno.serve(async (req: Request) => {
  const requestOrigin = req.headers.get("Origin");
  const origin = getAllowedOrigin(requestOrigin);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ message: "Method not allowed" }, 405, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.");
    return jsonResponse({ message: "Server configuration error." }, 500, origin);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ message: "Invalid JSON body" }, 400, origin);
  }

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) {
    return jsonResponse({ message: "Token is required" }, 400, origin);
  }

  // Look up the token — must exist and not yet be confirmed
  const { data: row, error: selectError } = await supabaseAdmin
    .from(TABLE_NAME)
    .select("id, email, name, reason, confirmed_at")
    .eq("confirmation_token", token)
    .maybeSingle();

  if (selectError) {
    console.error("DB select error:", selectError);
    return jsonResponse({ message: "Server error looking up token." }, 500, origin);
  }

  if (!row || row.confirmed_at !== null) {
    return jsonResponse({ message: "Invalid or already used confirmation link" }, 400, origin);
  }

  // Mark the request as confirmed
  const confirmedAt = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from(TABLE_NAME)
    .update({ confirmed_at: confirmedAt })
    .eq("confirmation_token", token);

  if (updateError) {
    console.error("DB update error:", updateError);
    return jsonResponse({ message: "Failed to confirm request." }, 500, origin);
  }

  // Notify admin
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (apiKey) {
    const { email, name, reason } = row as { email: string; name: string | null; reason: string | null };
    const resendPayload = {
      from: FROM_SENDER,
      to: [NOTIFY_TO],
      reply_to: email,
      subject: `[TriagePaw] Confirmed account deletion request from ${email}`,
      html: `
        <p><strong>A user has confirmed their account deletion request.</strong></p>
        <p>Email: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
        ${name ? `<p>Name: ${escapeHtml(name)}</p>` : ""}
        ${reason ? `<p>Reason: ${escapeHtml(reason)}</p>` : ""}
        <p>Confirmed at: ${escapeHtml(confirmedAt)}</p>
        <p>Please process this account deletion in Supabase.</p>
        <p><em>Sent via TriagePaw Website. Record updated in ${TABLE_NAME}.</em></p>
      `,
    };
    try {
      const resendRes = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(resendPayload),
      });
      if (!resendRes.ok) {
        const errText = await resendRes.text();
        console.error("Resend API error:", resendRes.status, errText);
      }
    } catch (e) {
      console.error("Resend fetch error:", e);
    }
  }

  return jsonResponse({ success: true }, 200, origin);
});
