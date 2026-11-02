// How well each sign-up source keeps its subscribers. "Left within 30 days" is the one to watch: a
// source (a poster, a venue, an influencer) where many people leave right after getting their code is
// attracting people who only wanted the free massage.
const DAY = 86400_000;

export function computeSourceStats(subs) {
  const groups = new Map();
  for (const s of subs) {
    const key = s.source || "(none)";
    const g = groups.get(key) || { source: key, signups: 0, confirmed: 0, unsubscribed: 0, early: 0 };
    g.signups += 1;
    if (s.confirmed_at) g.confirmed += 1;
    if (s.unsubscribed_at) {
      g.unsubscribed += 1;
      const since = s.confirmed_at ? Date.parse(s.unsubscribed_at) - Date.parse(s.confirmed_at) : Infinity;
      if (since <= 30 * DAY) g.early += 1;
    }
    groups.set(key, g);
  }
  const rows = [...groups.values()].map((g) => ({ ...g, rate: g.confirmed > 0 ? g.unsubscribed / g.confirmed : null, earlyRate: g.confirmed > 0 ? g.early / g.confirmed : null }));
  rows.sort((a, b) => b.signups - a.signups);
  const total = rows.reduce((t, r) => ({ source: "All sources", signups: t.signups + r.signups, confirmed: t.confirmed + r.confirmed, unsubscribed: t.unsubscribed + r.unsubscribed, early: t.early + r.early }), { source: "All sources", signups: 0, confirmed: 0, unsubscribed: 0, early: 0 });
  total.rate = total.confirmed > 0 ? total.unsubscribed / total.confirmed : null;
  total.earlyRate = total.confirmed > 0 ? total.early / total.confirmed : null;
  return { rows, total };
}
