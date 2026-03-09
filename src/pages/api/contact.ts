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

    const html = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      ${organization ? `<p><strong>Organization:</strong> ${escapeHtml(organization)}</p>` : ""}
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
    `;

    const text = [
      `Name: ${fullName}`,
      `Email: ${email}`,
      organization ? `Organization: ${organization}` : null,
      `Message:\n${message}`,
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await emailClient.send({
      from: "hi@hq.theadpharm.com",
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
