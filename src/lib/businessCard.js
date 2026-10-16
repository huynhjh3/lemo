// Free, on-device business card reading: tesseract.js does the OCR in the
// browser (nothing about the photo leaves it, no API cost) and
// parseBusinessCard turns the raw text into contact fields. Emails and
// phone numbers read reliably; name/title are best-effort guesses, which is
// why the UI always shows the result for correction.

const TITLE_WORDS = /\b(ceo|cfo|coo|cto|cmo|president|vice president|vp|director|manager|owner|founder|co-founder|partner|principal|broker|agent|associate|executive|coordinator|specialist|consultant|leasing|marketing|sales|operations|administrator|supervisor|analyst|head|chief|officer|representative|realtor|attorney|engineer|designer|general manager)\b/i;
const COMPANY_WORDS = /\b(inc|llc|ltd|corp|company|group|properties|property|realty|casino|resort|hotel|center|centre|mall|plaza|partners|associates|services|solutions|studios?|fitness|gym|wellness|holdings|enterprises|international|foods|club)\b/i;

const titleCase = (s) => s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, "");
  const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw.trim();
}

export function parseBusinessCard(text) {
  const cleaned = text.replace(/\s*@\s*/g, "@").replace(/\r/g, "");
  const lines = cleaned.split("\n").map((l) => l.replace(/[|_]+/g, " ").replace(/\s+/g, " ").trim()).filter((l) => l.length >= 3);

  const email = (cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0]?.toLowerCase() || null;

  let phone = null;
  const phoneRe = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
  const phoneLines = lines.filter((l) => phoneRe.test(l) && (phoneRe.lastIndex = 0, true));
  // A number tagged M/C/cell/mobile/direct beats an office/main line, even
  // when several numbers share one line ("T 949… M (949)…").
  const tagged = cleaned.match(/\b(?:m|c|cell|mobile|direct)\b[:.\s]*((?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i);
  if (tagged) {
    phone = formatPhone(tagged[1]);
  } else if (phoneLines[0]) {
    phoneRe.lastIndex = 0;
    const m = phoneRe.exec(phoneLines[0]);
    if (m) phone = formatPhone(m[0]);
  }

  const role = lines.find((l) => TITLE_WORDS.test(l) && !/@/.test(l) && !/\d{3}/.test(l) && l.length <= 60) || null;

  const localTokens = email ? email.split("@")[0].split(/[._-]+/).filter((t) => t.length > 1) : [];
  const nameCandidates = lines
    .map((l, i) => ({ l: l.replace(/[^A-Za-z.'\- ]/g, "").replace(/\s+/g, " ").trim(), i }))
    .filter(({ l }) => {
      const words = l.split(" ");
      return words.length >= 2 && words.length <= 4 && l.length <= 40
        && words.every((w) => /^[A-Z][A-Za-z.'-]*$/.test(w))
        && !TITLE_WORDS.test(l) && !COMPANY_WORDS.test(l);
    })
    .map(({ l, i }) => {
      let score = 0;
      const lower = l.toLowerCase();
      score += localTokens.filter((t) => lower.includes(t)).length * 5;
      if (role && i < lines.indexOf(role)) score += 2;
      if (/[a-z]/.test(l) && /^[A-Z]/.test(l)) score += 1;
      return { l, score, i };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i);

  let name = nameCandidates[0] ? titleCase(nameCandidates[0].l) : null;
  let nameGuessed = false;
  if (!name && localTokens.length >= 2) { name = titleCase(localTokens.join(" ")); nameGuessed = true; }

  return { name, role, email, phone, nameGuessed };
}

let workerPromise = null;

// Lazy-loaded so the ~OCR engine only downloads the first time someone
// actually scans a card (a few MB, then cached by the browser).
export async function readBusinessCard(blobs) {
  const { createWorker } = await import("tesseract.js");
  if (!workerPromise) workerPromise = createWorker("eng");
  const worker = await workerPromise;
  let text = "";
  for (const blob of blobs) {
    const { data } = await worker.recognize(blob);
    text += "\n" + data.text;
  }
  return { text, ...parseBusinessCard(text) };
}
