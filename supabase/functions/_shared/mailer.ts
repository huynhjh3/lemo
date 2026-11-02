// Sends one email through Resend, from hello@<domain>. Shared so landing-intake and
// confirm-subscription send the same way. A failed send is logged (not thrown), so a
// sign-up still succeeds, but the failure shows up in the function's logs.
export type Mailer = {
  sendEmail: (to: string, subject: string, text: string, fromName?: string, html?: string, attachments?: { filename: string; content: string }[]) => Promise<boolean>;
  notify: (subject: string, lines: string[]) => Promise<boolean>;
};
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function makeMailer(o: { resendKey?: string; domain: string; notifyTo?: string }): Mailer {
  async function sendEmail(to: string, subject: string, text: string, fromName = "Lemo Wellness", html?: string, attachments?: { filename: string; content: string }[]) {
    if (!o.resendKey) { console.error("sendEmail skipped: RESEND_API_KEY is not set"); return false; }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${o.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${fromName} <hello@${o.domain}>`, to: [to], subject, text, ...(html ? { html } : {}), ...(attachments ? { attachments } : {}) }),
    });
    if (!res.ok) console.error(`sendEmail to ${to} failed: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
    return res.ok;
  }
  const notify = (subject: string, lines: string[]) =>
    o.notifyTo && EMAIL.test(o.notifyTo) ? sendEmail(o.notifyTo, subject, lines.join("\n"), "Lemo CRM") : Promise.resolve(false);
  return { sendEmail, notify };
}
