const RESEND_API_URL = "https://api.resend.com/emails";
const NOTIFY_TO = "contact@triagepaw.com";
const FROM_SENDER = "TriagePaw Account Deletion <contact@triagepaw.com>";

interface RequestBody {
  email?: string;
}

// 1. Helpers defined at the top
const escapeHtml = (s: string): string => {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

const jsonResponse = (data: object, status: number): Response => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};

// 2. The Native Server (Zero Imports Required)
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
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

  // Validate API Key
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set in Edge Function secrets.");
    return jsonResponse({ message: "Server configuration error." }, 500);
  }

  // Parse Body
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

  // Send via Resend
  const resendPayload = {
    from: FROM_SENDER,
    to: [NOTIFY_TO],
    reply_to: email,
    subject: `[TriagePaw] Account deletion request from ${email}`,
    html: `
      <p><strong>Account deletion requested</strong></p>
      <p>User email: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
      <p>Please process this account deletion request in Supabase and confirm to the user by email.</p>
      <p><em>Sent via TriagePaw Website Form.</em></p>
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
      return jsonResponse({ message: "Failed to send request." }, 502);
    }

    return jsonResponse({ success: true, message: "Request sent successfully" }, 200);
  } catch (error) {
    console.error("Fetch error:", error);
    return jsonResponse({ message: "Internal server error." }, 500);
  }
});