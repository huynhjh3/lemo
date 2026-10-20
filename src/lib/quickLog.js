// Turns one typed line ("Spoke with Dalton at LV Chamber, interested, follow
// up next week") into a draft communications-log entry: which company, what
// kind of contact, whether they responded, and a follow-up date. Plain
// pattern matching, no AI — the Quick Log card always shows the result for
// the user to correct before anything is saved.

const STOP = new Set(["the", "inc", "llc", "ltd", "co", "corp", "company", "group", "and", "of", "at", "a", "an"]);
const toks = (s) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));

// Companies (best first) whose name — or a contact's name — shows up in the text.
export function matchCompanies(text, companies) {
  const textToks = toks(text);
  const textSet = new Set(textToks);
  const textJoined = ` ${textToks.join(" ")} `;
  const out = [];
  // A bare first name ("Dalton") counts as a contact match only when it's
  // unambiguous across every company's contacts.
  const firstNameCount = {};
  companies.forEach((c) => (c.contacts || []).forEach((p) => {
    const f = toks(p.name || "")[0];
    if (f) firstNameCount[f] = (firstNameCount[f] || 0) + 1;
  }));
  companies.forEach((c) => {
    const nameToks = toks(c.name);
    let score = 0;
    let contact = null;
    if (nameToks.length) {
      const hits = nameToks.filter((w) => textSet.has(w)).length;
      if (textJoined.includes(` ${nameToks.join(" ")} `)) score = 100 + nameToks.length;
      else if (hits === nameToks.length) score = 80 + hits;
      else if (nameToks.length >= 3 && hits / nameToks.length >= 0.67) score = 50 + hits;
      else if (hits >= 1 && nameToks.some((w) => textSet.has(w) && w.length >= 4)) score = 40;
    }
    (c.contacts || []).forEach((p) => {
      const parts = toks(p.name || "");
      const firstOnly = parts.length >= 2 && parts[0].length >= 3 && firstNameCount[parts[0]] === 1 && textSet.has(parts[0]);
      if (parts.length && (parts.every((w) => textSet.has(w)) || firstOnly)) {
        if (score < 70) score = 70;
        contact = p;
      }
    });
    if (score > 0) out.push({ company: c, score, contact });
  });
  return out.sort((a, b) => b.score - a.score || b.company.name.length - a.company.name.length);
}

export function detectType(text) {
  const t = text.toLowerCase();
  if (/\b(cold call)\b/.test(t)) return "cold_call";
  if (/\b(met|meeting|visited|visit|demo|lunch|coffee|in person|onsite|on-site|walkthrough|toured|tour)\b/.test(t)) return "meeting";
  if (/\b(texted|text|messaged|dm|whatsapp|wechat|imessage)\b/.test(t)) return "text_message";
  if (/\b(emailed|email|e-mail|sent (?:an? )?(?:info|deck|proposal|quote|pdf|link))\b/.test(t)) return "email";
  return "follow_up";
}

// Did the other side actually engage? (Drives the Lead -> Contacted
// suggestion — a Lead is someone we've reached out to who hasn't answered.)
export function detectResponded(text) {
  const t = text.toLowerCase();
  if (/(voicemail|no answer|no response|didn'?t answer|haven'?t heard|hasn'?t responded|left a (message|vm)|not yet heard|no reply)/.test(t)) return false;
  return /\b(spoke|talked|met|meeting|replied|responded|got back|called back|interested|they said|she said|he said|told me|agreed|confirmed|wants|want to|excited)\b/.test(t);
}

const MONTHS = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
const DOW = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, few: 3, couple: 2 };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// A future follow-up date from phrases like "tomorrow", "next week", "in 3
// days", "follow up Friday", "in January 2027", "10/25". Returns YYYY-MM-DD
// or null.
export function detectFollowUp(text, today = new Date()) {
  const t = text.toLowerCase();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const cue = /(follow|revisit|check back|circle back|reach out|touch base|ping|call back|remind|reconnect|get back)/.test(t);

  if (/\btomorrow\b/.test(t)) return iso(addDays(base, 1));
  let m = t.match(/\bin (\d+|a|an|one|two|three|four|a few|a couple of?|few|couple) ?(day|week|month)s?\b/);
  if (m) {
    const word = m[1].replace(/^a (few|couple)( of)?$/, "$1");
    const n = /^\d+$/.test(word) ? Number(word) : (NUM[word] || 1);
    return iso(addDays(base, n * (m[2] === "day" ? 1 : m[2] === "week" ? 7 : 30)));
  }
  if (/\bnext week\b/.test(t)) return iso(addDays(base, 7));
  if (/\bnext month\b/.test(t)) return iso(addDays(base, 30));
  if (/\bend of (the )?week\b/.test(t)) return iso(addDays(base, ((5 - base.getDay() + 7) % 7) || 7));

  m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m) {
    const month = Number(m[1]) - 1, day = Number(m[2]);
    let year = m[3] ? Number(m[3]) : base.getFullYear();
    if (year < 100) year += 2000;
    let d = new Date(year, month, day);
    if (!m[3] && d < base) d = new Date(year + 1, month, day);
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) return iso(d);
  }

  m = t.match(/\b(?:in|by|around|early|late|mid)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b(?:,?\s+(\d{4}))?/)
    || (cue && t.match(/\b(january|february|march|april|june|july|august|september|october|november|december)\b(?:,?\s+(\d{4}))?/));
  if (m) {
    const month = MONTHS[m[1]];
    let year = m[2] ? Number(m[2]) : base.getFullYear();
    let d = new Date(year, month, 1);
    if (!m[2] && d <= base) d = new Date(year + 1, month, 1);
    return iso(d);
  }

  if (cue) {
    m = t.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (m) return iso(addDays(base, ((DOW[m[1]] - base.getDay() + 7) % 7) || 7));
  }
  return null;
}

export function parseQuickLog(text, companies, today = new Date()) {
  const matches = matchCompanies(text, companies);
  const best = matches[0] && matches[0].score >= 40 ? matches[0] : null;
  return {
    candidates: matches.slice(0, 5).map((m) => m.company),
    company: best?.company || null,
    contact: best?.contact || null,
    type: detectType(text),
    responded: detectResponded(text),
    followUp: detectFollowUp(text, today),
  };
}
