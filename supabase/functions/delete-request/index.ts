// Supabase Edge Function: delete-request
// Sends an account deletion request notification to contact@triagepaw.com via Resend.
// Requires RESEND_API_KEY in Supabase Edge Function secrets.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_URL = "https://api.resend.com/emails";
const NOTIFY_TO = "contact@triagepaw.com";
// From must be a verified domain in Resend. Use your verified sender (e.g. contact@triagepaw.com or onboarding@resend.dev for testing).
const FROM_SENDER = "TriagePaw Account Deletion <contact@triagepaw.com>";

interface RequestBody {
  email?: string;
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ message: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set in Edge Function secrets.");
    return jsonResponse(
      { message: "Server configuration error. Please try again later." },
      500
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ message: "Invalid JSON body" }, 400);
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) {
    return jsonResponse({ message: "Email is required" }, 400);
  }

  const resendPayload = {
    from: FROM_SENDER,
    to: [NOTIFY_TO],
    subject: `[TriagePaw] Account deletion request from ${email}`,
    html: `
      <p><strong>Account deletion requested</strong></p>
      <p>User email: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
      <p>Please process this account deletion request and confirm to the user by email.</p>
      <p><em>Sent from TriagePaw deletion form.</em></p>
    `,
  };

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
    return jsonResponse(
      { message: "Failed to send request. Please try again or contact us." },
      502
    );
  }

  return jsonResponse(
    { success: true, message: "Request sent successfully" },
    200
  );
});

function jsonResponse(data: object, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
