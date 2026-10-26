// Shared by send-newsletter (the monthly issue) and landing-intake (the welcome
// email each new subscriber gets). Renders one issue of "The Recharge Report" as an email: table-based layout
// with inline styles, because that is what mail apps (Gmail, Outlook, Apple
// Mail) render reliably. A pure function with no Deno APIs, so it can be tested
// anywhere. Sections with no content are left out.

export type Stat = { value?: string; label?: string };
export type Story = { tag?: string; title?: string; body?: string; link_label?: string; link_url?: string; image_url?: string };
export type Pulse = { title?: string; body?: string; link_url?: string };
export type Content = {
  preheader?: string;
  issue_label?: string;
  hero_image_url?: string;
  intro?: string;
  stats_title?: string;
  stats?: Stat[];
  stories_title?: string;
  stories?: Story[];
  pulse_title?: string;
  pulse?: Pulse[];
  show_free_block?: boolean;
  closing?: string;
};
// welcome: this email IS the sign-up welcome, so it shows the subscriber's own code
// (or says it's on its way) instead of the "haven't used yours yet?" reminder.
export type Opts = { firstName?: string; unsubscribeUrl: string; logoUrl?: string; welcome?: boolean; code?: string | null };

const ORANGE = "#E8601C", INK = "#1A1512", DIM = "#6B5F55", CREAM = "#FEF1E4", LINE = "#F0DCC8", PAGE = "#EFE7DE";
const FONT = "'Poppins',Helvetica,Arial,sans-serif";
export const ADDRESS = "Lemo Inc. · 5151 California Ave, Irvine, CA 92617";

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const has = (s: unknown) => typeof s === "string" && s.trim().length > 0;
// Only http(s) links and images make it into the email.
const safeUrl = (u: unknown) => (typeof u === "string" && /^https?:\/\//i.test(u.trim()) ? esc(u.trim()) : "");
const paras = (s: string, style: string) =>
  s.split(/\n\s*\n/).map((p) => `<p style="margin:0 0 14px;${style}">${esc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");

const heading = (t: string) =>
  `<p style="margin:0;font:700 12px ${FONT};letter-spacing:2px;text-transform:uppercase;color:${ORANGE};">${esc(t)}</p>`;
const section = (inner: string, top = true) =>
  `<tr><td style="padding:${top ? "28px" : "8px"} 40px 8px;${top ? `border-top:1px solid ${LINE};` : ""}">${inner}</td></tr>`;

export function renderNewsletter(c: Content, o: Opts): { html: string; text: string } {
  const logo = safeUrl(o.logoUrl) || "https://lemocrm.lemowellness.com/lemo-logo.png";
  const stats = (c.stats ?? []).filter((s) => has(s.value));
  const stories = (c.stories ?? []).filter((s) => has(s.title) || has(s.body));
  const pulse = (c.pulse ?? []).filter((p) => has(p.title) || has(p.body));
  const hero = safeUrl(c.hero_image_url);
  const rows: string[] = [];

  // Header
  rows.push(`<tr><td align="center" bgcolor="${CREAM}" style="background:${CREAM};padding:30px 40px 26px;">
    <img src="${logo}" width="120" alt="Lemo" style="display:block;border:0;width:120px;height:auto;margin:0 auto;">
    ${has(c.issue_label) ? `<p style="margin:20px 0 0;font:600 11px ${FONT};letter-spacing:3px;text-transform:uppercase;color:${ORANGE};">${esc(c.issue_label)}</p>` : ""}
    <h1 style="margin:8px 0 0;font:800 38px/1.1 ${FONT};letter-spacing:-1px;color:${INK};">The <span style="color:${ORANGE};">Recharge</span> Report</h1>
    <p style="margin:10px 0 0;font:400 13px ${FONT};color:${DIM};">What we installed, who we met, and what’s moving in wellness</p>
  </td></tr>`);
  if (hero) rows.push(`<tr><td style="padding:0;line-height:0;"><img src="${hero}" width="600" alt="" style="display:block;border:0;width:100%;max-width:600px;height:auto;"></td></tr>`);

  // Greeting + intro
  rows.push(`<tr><td style="padding:30px 40px 6px;font:400 15px/1.65 ${FONT};color:#3A322C;">
    <p style="margin:0 0 14px;">Hi <b style="color:${INK};">${esc(o.firstName || "there")}</b>,</p>
    ${has(c.intro) ? paras(c.intro!, "") : ""}
    <p style="margin:6px 0 0;font:600 14px ${FONT};color:${INK};">Justin Huynh<br><span style="font:400 12px ${FONT};color:${DIM};">Business Operations, Lemo Wellness</span></p>
  </td></tr>`);

  // Welcome: the subscriber's one-time code
  if (o.welcome) {
    const inner = o.code
      ? `<span style="font:800 32px ${FONT};letter-spacing:4px;color:${ORANGE};">${esc(o.code)}</span><br><span style="font:400 12px ${FONT};color:${DIM};">One-time code · good for one free 10-minute massage</span>`
      : `<span style="font:700 16px ${FONT};color:${INK};">Your free code is on its way.</span><br><span style="font:400 12px ${FONT};color:${DIM};">We’ll email it to you shortly.</span>`;
    rows.push(`<tr><td style="padding:6px 40px 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${CREAM}" style="background:${CREAM};border:2px dashed ${ORANGE};border-radius:14px;padding:20px;">${inner}</td></tr></table></td></tr>`);
  }

  // Stats
  if (stats.length) {
    const w = Math.floor(100 / stats.length);
    const cells = stats.slice(0, 3).map((s) => `<td width="${w}%" valign="top" style="padding:0 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" valign="middle" height="96" bgcolor="${CREAM}" style="background:${CREAM};border-radius:14px;padding:14px 10px;height:96px;">
        <p style="margin:0;font:800 32px/1 ${FONT};color:${ORANGE};">${esc(s.value)}</p>
        <p style="margin:8px 0 0;font:400 12px/1.35 ${FONT};color:${DIM};">${esc(s.label)}</p>
      </td></tr></table></td>`).join("");
    rows.push(section(`${heading(c.stats_title || "This month by the numbers")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;"><tr>${cells}</tr></table>`));
  }

  // Stories
  if (stories.length) {
    const items = stories.slice(0, 3).map((s) => {
      const img = safeUrl(s.image_url), link = safeUrl(s.link_url);
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
        ${img ? `<tr><td style="padding:0 0 12px;line-height:0;"><img src="${img}" width="520" alt="" style="display:block;border:0;width:100%;max-width:520px;height:auto;border-radius:14px;"></td></tr>` : ""}
        <tr><td style="font:400 13px/1.6 ${FONT};color:#4A4038;">
          ${has(s.tag) ? `<span style="display:inline-block;font:700 10px ${FONT};letter-spacing:1.5px;color:#fff;background:${ORANGE};padding:4px 10px;border-radius:99px;text-transform:uppercase;">${esc(s.tag)}</span>` : ""}
          ${has(s.title) ? `<p style="margin:10px 0 0;font:700 19px/1.25 ${FONT};color:${INK};">${esc(s.title)}</p>` : ""}
          ${has(s.body) ? `<p style="margin:6px 0 0;">${esc(s.body).replace(/\n/g, "<br>")}</p>` : ""}
          ${link ? `<p style="margin:10px 0 0;"><a href="${link}" style="font:600 13px ${FONT};color:${ORANGE};text-decoration:none;">${esc(s.link_label || "Read more")} →</a></p>` : ""}
        </td></tr></table>`;
    }).join("");
    rows.push(section(`${heading(c.stories_title || "What we’ve been up to")}${items}`));
  }

  // Industry pulse
  if (pulse.length) {
    const items = pulse.slice(0, 3).map((p, i) => {
      const link = safeUrl(p.link_url);
      return `<tr>
        <td width="34" valign="top" style="padding:12px 14px 12px 0;${i ? `border-top:1px solid ${LINE};` : ""}"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="32" height="32" align="center" bgcolor="${INK}" style="background:${INK};border-radius:16px;font:700 14px ${FONT};color:#fff;">${i + 1}</td></tr></table></td>
        <td valign="top" style="padding:12px 0;${i ? `border-top:1px solid ${LINE};` : ""}font:400 13px/1.55 ${FONT};color:#4A4038;">
          ${has(p.title) ? `<b style="font:700 15px ${FONT};color:${INK};">${esc(p.title)}</b><br>` : ""}${esc(p.body)}${link ? ` <a href="${link}" style="color:${ORANGE};font-weight:600;text-decoration:none;">Read →</a>` : ""}
        </td></tr>`;
    }).join("");
    rows.push(section(`${heading(c.pulse_title || "The wellness industry pulse")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${items}</table>`));
  }

  // Free massage reminder + closing line
  const showFree = c.show_free_block !== false && !o.welcome;
  if (showFree || has(c.closing)) {
    const free = showFree ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${CREAM}" style="background:${CREAM};border-radius:16px;padding:22px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle" style="font:400 13px/1.55 ${FONT};color:#4A4038;">${heading("Haven’t used yours yet?")}
          <p style="margin:6px 0 4px;font:700 19px/1.25 ${FONT};color:${INK};">Your free 10-minute massage is waiting</p>
          Find your one-time code in your welcome email and redeem it at any Lemo chair. Visited one? Leave the venue a Google review and mention us!</td>
        <td width="96" align="center" valign="middle" style="padding-left:16px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="88" height="88" align="center" bgcolor="${ORANGE}" style="background:${ORANGE};border-radius:44px;font:800 22px/1 ${FONT};color:#fff;">FREE<br><span style="font:600 10px ${FONT};letter-spacing:1px;">10-MIN</span></td></tr></table></td>
      </tr></table></td></tr></table>` : "";
    rows.push(`<tr><td style="padding:24px 40px 10px;">${free}${has(c.closing) ? `<div style="margin-top:${free ? "22px" : "0"};font:400 14px/1.6 ${FONT};color:#3A322C;">${paras(c.closing!, "")}</div>` : ""}</td></tr>`);
  }

  // Footer
  rows.push(`<tr><td align="center" bgcolor="${INK}" style="background:${INK};padding:30px 40px;font:400 11.5px/1.7 ${FONT};color:#BFB3A6;">
    <img src="${logo}" width="84" alt="Lemo" style="display:block;border:0;width:84px;height:auto;margin:0 auto 12px;">
    <span style="font-weight:600;letter-spacing:1px;color:#fff;">LEMOWELLNESS.COM</span><br><br>
    ${esc(ADDRESS)}<br>You’re getting this because you signed up for the Lemo newsletter at one of our chairs.<br>
    <a href="${safeUrl(o.unsubscribeUrl) || "#"}" style="color:#FF8A50;">Unsubscribe</a>
  </td></tr>`);

  const pre = has(c.preheader)
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(c.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Recharge Report</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${PAGE};">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAGE}" style="background:${PAGE};"><tr><td align="center" style="padding:22px 12px 30px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;">
    ${rows.join("\n")}
  </table>
</td></tr></table></body></html>`;

  // Plain-text version (mail apps and spam filters like having one).
  const t: string[] = [`THE RECHARGE REPORT${has(c.issue_label) ? ` · ${c.issue_label}` : ""}`, "", `Hi ${o.firstName || "there"},`, ""];
  if (has(c.intro)) t.push(c.intro!.trim(), "");
  if (stats.length) t.push((c.stats_title || "This month by the numbers").toUpperCase(), ...stats.map((s) => `- ${s.value} ${s.label ?? ""}`.trim()), "");
  if (stories.length) {
    t.push((c.stories_title || "What we've been up to").toUpperCase());
    for (const s of stories) t.push(`${s.tag ? `[${s.tag}] ` : ""}${s.title ?? ""}`.trim(), s.body ?? "", s.link_url ?? "", "");
  }
  if (pulse.length) {
    t.push((c.pulse_title || "The wellness industry pulse").toUpperCase());
    pulse.forEach((p, i) => t.push(`${i + 1}. ${p.title ?? ""}`.trim(), p.body ?? "", p.link_url ?? "", ""));
  }
  if (o.welcome) t.push(o.code ? `Your free 10-minute massage code: ${o.code}` : "Your free code is on its way. We'll email it to you shortly.", "");
  if (c.show_free_block !== false && !o.welcome) t.push("Haven't used your free 10-minute massage yet? Find your one-time code in your welcome email and redeem it at any Lemo chair.", "");
  if (has(c.closing)) t.push(c.closing!.trim(), "");
  t.push("Justin Huynh, Business Operations, Lemo Wellness", "", ADDRESS, `Unsubscribe: ${o.unsubscribeUrl}`);
  return { html, text: t.join("\n").replace(/\n{3,}/g, "\n\n") };
}
