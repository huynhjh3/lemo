import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Copy, Check } from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "./ui.jsx";
import { fmtMoney, fmtCount, dailyTotals, dailyUpdateText, toDateKey, TODAY } from "../lib/helpers.js";
import * as dailyUpdatesApi from "../lib/api/dailyUpdates.js";

const FEED_DAYS = 14;

function daysAgoKey(n) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return toDateKey(d);
}

const shortLabel = (key) => {
  const d = new Date(key + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// The daily message the owner posts to the team chat. Owners get live
// auto-written numbers plus a context box, and Save publishes both (the
// numbers as a snapshot — daily_updates.summary, migrations 057/058).
// Everyone else reads that published snapshot only: their `companies` is
// region/rep-scoped, so numbers recomputed in their browser would differ
// from the owner's.
export default function DailyUpdateCard({ companies, canEdit }) {
  const [dateKey, setDateKey] = useState(daysAgoKey(1));
  const [saved, setSaved] = useState({});
  const [draft, setDraft] = useState("");
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    dailyUpdatesApi.fetchDailyUpdates(daysAgoKey(90))
      .then((rows) => {
        if (cancelled) return;
        setSaved(Object.fromEntries(rows.map((r) => [r.update_date, { context: r.context || "", summary: r.summary || "" }])));
        setLoadError(null);
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || "Couldn't load saved updates."); });
    return () => { cancelled = true; };
  }, []);

  const entry = saved[dateKey];
  useEffect(() => { setDraft(entry?.context || ""); setSaveError(null); }, [dateKey, entry]);

  const auto = useMemo(() => (canEdit ? dailyUpdateText(companies, dateKey) : null), [canEdit, companies, dateKey]);
  const feed = useMemo(
    () => Array.from({ length: FEED_DAYS }, (_, i) => {
      const key = daysAgoKey(i + 1);
      return { key, ...(canEdit ? dailyTotals(companies, key) : {}) };
    }),
    [canEdit, companies],
  );

  // What's shown/copied: owners preview the live version they're about to
  // publish; everyone else sees what was published.
  const bodyParts = canEdit
    ? [auto.text, draft.trim()]
    : [entry?.summary, entry?.context];
  const body = bodyParts.filter(Boolean).join("\n\n");
  const fullText = body ? `${shortLabel(dateKey)} Update\n\n${body}` : "";

  const published = !!entry;
  const upToDate = published && entry.context === draft.trim() && entry.summary === auto?.text;

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await dailyUpdatesApi.saveDailyUpdate(dateKey, draft.trim(), auto.text);
      setSaved((s) => ({ ...s, [dateKey]: { context: draft.trim(), summary: auto.text } }));
    } catch (e) {
      setSaveError(e.message || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setSaveError("Couldn't copy automatically — select the text and copy it.");
    }
  };

  const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };
  const errorHint = loadError && `Run migrations 057 and 058 in the Supabase SQL editor (${loadError})`;

  const preview = (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-wide" style={{ color: T.textFaint }}>
        {canEdit ? "Preview — what gets shared" : "Posted update"}
      </div>
      {fullText ? (
        <div className="rounded-lg p-3 text-sm whitespace-pre-wrap" style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, color: T.text, lineHeight: 1.5 }}>
          {fullText}
        </div>
      ) : (
        <div className="rounded-lg p-3 text-sm" style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, color: T.textFaint }}>
          {loadError && !canEdit ? "Updates aren't available yet." : "No update was posted for this day."}
        </div>
      )}
      {fullText && (
        <div className="flex items-center gap-3">
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: T.amber, color: "#1a1208", fontWeight: 600 }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy update"}
          </button>
          {canEdit && <span className="text-[11px]" style={{ color: T.textFaint }}>Numbers refresh from live data until you save.</span>}
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardTitle
        icon={CalendarDays}
        right={(
          <input
            type="date"
            value={dateKey}
            max={toDateKey(TODAY)}
            onChange={(e) => e.target.value && setDateKey(e.target.value)}
            className="text-xs rounded-lg px-2 py-1 outline-none"
            style={inputStyle}
          />
        )}
      >
        Daily Update
      </CardTitle>

      {canEdit ? (
        <div className="flex flex-col gap-4">
          {preview}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-wide" style={{ color: T.textFaint }}>Your context for this day</div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              placeholder="Anything the numbers don't say — a chair that was down, a deal that moved, who to focus on…"
              className="text-sm rounded-lg px-3 py-2 outline-none w-full"
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={save}
                disabled={saving || upToDate || !!loadError}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, opacity: saving || upToDate || loadError ? 0.5 : 1 }}
              >
                {saving ? "Saving…" : upToDate ? "Shared with everyone" : published ? "Update shared version" : "Save & share"}
              </button>
              {errorHint && <span className="text-[11px]" style={{ color: T.red }}>{errorHint}</span>}
              {saveError && <span className="text-[11px]" style={{ color: T.red }}>{saveError}</span>}
            </div>
          </div>
        </div>
      ) : (
        preview
      )}

      <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: T.textFaint }}>Last {FEED_DAYS} days</div>
        <div className="flex flex-col">
          {feed.map((d) => {
            const date = new Date(d.key + "T00:00:00");
            const e = saved[d.key];
            const note = e?.context || (e ? e.summary : "");
            return (
              <button
                key={d.key}
                onClick={() => setDateKey(d.key)}
                className="grid items-baseline gap-2 py-2 text-left text-[11px] w-full"
                style={{
                  gridTemplateColumns: canEdit ? "64px 56px 48px 1fr" : "64px 1fr",
                  borderBottom: `1px solid ${T.borderSoft}`,
                  background: d.key === dateKey ? `${T.amber}10` : undefined,
                }}
              >
                <span style={{ color: T.text }}>{`${date.toLocaleDateString("en-US", { weekday: "short" })} ${date.getMonth() + 1}/${date.getDate()}`}</span>
                {canEdit && <span style={{ fontFamily: T.fontMono, color: d.hasData ? T.teal : T.textFaint }}>{d.hasData ? fmtMoney(d.amount) : "no data"}</span>}
                {canEdit && <span style={{ fontFamily: T.fontMono, color: T.textFaint }}>{d.hasData ? `${fmtCount(d.orders)} ord` : ""}</span>}
                <span className="truncate" style={{ color: note ? T.textDim : T.textFaint }}>{note || (canEdit ? "—" : "No update")}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
