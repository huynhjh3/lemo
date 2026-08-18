// Client-side search across companies, their contacts, and notes — all
// three are already fetched and RLS-scoped in useCrmData, so this is a
// plain in-memory filter, not a new round trip. Fast enough at this
// team's scale, and instant-as-you-type beats a dedicated search page.
const matches = (q, ...fields) => fields.filter(Boolean).some((v) => String(v).toLowerCase().includes(q));

export function searchEntities(query, companies, notes, limit = 8) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const results = [];
  for (const c of companies) {
    if (matches(q, c.name, c.code, c.industry, c.city, c.region)) {
      results.push({ type: "company", key: `company-${c.id}`, label: c.name, sub: c.industry || c.city || "Company", companyId: c.id });
    }
    for (const p of c.contacts || []) {
      if (matches(q, p.name, p.email, p.phone)) {
        results.push({ type: "contact", key: `contact-${p.id}`, label: p.name, sub: `Contact at ${c.name}`, companyId: c.id });
      }
    }
  }
  for (const n of notes) {
    if (matches(q, n.body)) {
      results.push({
        type: "note", key: `note-${n.id}`,
        label: n.body.length > 60 ? n.body.slice(0, 60) + "…" : n.body,
        sub: `Note by ${n.authorName}`, companyId: n.companyId,
      });
    }
  }
  return results.slice(0, limit);
}
