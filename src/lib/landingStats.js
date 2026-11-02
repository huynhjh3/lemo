// Turns raw landing_events rows into the funnel the Inbox page shows: how
// many distinct visitors (sessions) landed, how many clicked each of the
// three options, how many went on to submit, and the rates between them.

export const OPTIONS = [
  { key: "contact", label: "Talk to us", click: "click_contact", submit: "submit_contact" },
  { key: "newsletter", label: "Newsletter + free massage", click: "click_newsletter", submit: "submit_newsletter" },
  { key: "bd", label: "BD consultant", click: "click_bd", submit: "submit_bd" },
  { key: "rsvp", label: "Event RSVP", click: "click_rsvp", submit: "submit_rsvp" },
];

const rate = (n, d) => (d > 0 ? n / d : null);

function funnel(events) {
  const sessions = (name) => new Set(events.filter((e) => e.event === name).map((e) => e.session_id));
  const views = sessions("view").size;
  const options = OPTIONS.map((o) => {
    const clicks = sessions(o.click).size;
    const submits = events.filter((e) => e.event === o.submit).length;
    return { ...o, clicks, submits, clickRate: rate(clicks, views), completionRate: rate(submits, clicks), overallRate: rate(submits, views) };
  });
  const engaged = new Set(events.filter((e) => OPTIONS.some((o) => o.click === e.event)).map((e) => e.session_id)).size;
  const submitsTotal = options.reduce((s, o) => s + o.submits, 0);
  return { views, engaged, engagedRate: rate(engaged, views), submitsTotal, overallRate: rate(submitsTotal, views), options };
}

export function computeLandingStats(events, { sinceMs = null, source = null } = {}) {
  const inRange = sinceMs ? events.filter((e) => new Date(e.created_at).getTime() >= sinceMs) : events;
  const filtered = source === null ? inRange : inRange.filter((e) => (e.source || "(none)") === source);
  const sources = Array.from(new Set(inRange.map((e) => e.source || "(none)"))).sort();
  const bySource = sources.map((s) => ({ source: s, ...funnel(inRange.filter((e) => (e.source || "(none)") === s)) }))
    .sort((a, b) => b.views - a.views);
  return { ...funnel(filtered), sources, bySource };
}
