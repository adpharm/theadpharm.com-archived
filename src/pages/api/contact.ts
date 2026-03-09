import type { APIRoute } from "astro";
import { EmailClient } from "@cdv2/email";
import { contactSchema } from "@/lib/schema.contact";

const { CDV2_EMAIL_API_KEY, CDV2_EMAIL_BASE_URL } = process.env;
if (!CDV2_EMAIL_API_KEY || !CDV2_EMAIL_BASE_URL) {
  throw new Error("CDV2_EMAIL_API_KEY and CDV2_EMAIL_BASE_URL must be set");
}

/** Module-level singleton — one client for the lifetime of the server process */
const emailClient = new EmailClient({
  apiKey: CDV2_EMAIL_API_KEY,
  baseUrl: CDV2_EMAIL_BASE_URL,
});

/** Escape user-supplied strings before interpolating into HTML */
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request }): Promise<Response> => {
  try {
    const parsed = contactSchema.safeParse(await request.json());

    if (!parsed.success) {
      return jsonResponse({ error: "Invalid form data" }, 400);
    }

    const { firstName, lastName, email, organization, message } = parsed.data;
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    const metaRows = [
      `<strong>From:</strong> ${escapeHtml(fullName)} &lt;${escapeHtml(email)}&gt;`,
      organization ? `<strong>Org:</strong> ${escapeHtml(organization)}` : null,
      `<strong>Source:</strong> theadpharm.com contact form`,
    ].filter(Boolean).map((row) => `<p style="font-size:12px;color:#888;margin:0">${row}</p>`).join("");

    const html = `
      <div style="margin-bottom:16px">${metaRows}</div>
      <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
    `;

    const text = [
      `From: ${fullName} <${email}>`,
      organization ? `Organization: ${organization}` : null,
      `Source: theadpharm.com contact form`,
      ``,
      message,
    ].filter((l) => l !== null).join("\n");

    const { error } = await emailClient.send({
      from: "theadpharm.com <hi@hq.theadpharm.com>",
      to: "ben@theadpharm.com",
      subject: `Contact form: ${fullName}`,
      html,
      text,
      replyTo: email,
    });

    if (error) {
      console.error("Email send error:", error.message);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error("Contact API error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};
