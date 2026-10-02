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

// A copy-ready version of the daily message the owner posts to the team
// chat: auto-written numbers (recomputed from live data) plus whatever
// context they type in. Only the typed context is stored (daily_updates,
// migration 057) — if that table doesn't exist yet the card still works,
// it just can't remember the context between visits.
export default function DailyUpdateCard({ companies }) {
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
        setSaved(Object.fromEntries(rows.map((r) => [r.update_date, r.context])));
        setLoadError(null);
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || "Couldn't load saved context."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setDraft(saved[dateKey] || ""); setSaveError(null); }, [dateKey, saved]);

  const auto = useMemo(() => dailyUpdateText(companies, dateKey), [companies, dateKey]);
  const feed = useMemo(
    () => Array.from({ length: FEED_DAYS }, (_, i) => {
      const key = daysAgoKey(i + 1);
      return { key, ...dailyTotals(companies, key) };
    }),
    [companies],
  );

  const fullText = `${auto.label} Update\n\n${auto.text}${draft.trim() ? `\n\n${draft.trim()}` : ""}`;
  const dirty = draft !== (saved[dateKey] || "");

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await dailyUpdatesApi.saveDailyUpdate(dateKey, draft.trim());
      setSaved((s) => ({ ...s, [dateKey]: draft.trim() }));
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
      setSaveError("Couldn't copy automatically — select the preview text and copy it.");
    }
  };

  const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

  return (
    <Card className="mb-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: T.textFaint }}>Preview — ready to paste</div>
          <div className="rounded-lg p-3 text-sm whitespace-pre-wrap" style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, color: T.text, lineHeight: 1.5 }}>
            {fullText}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: T.amber, color: "#1a1208", fontWeight: 600 }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy update"}
            </button>
            <span className="text-[11px]" style={{ color: T.textFaint }}>Numbers refresh from live data each time.</span>
          </div>
        </div>

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
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving || !dirty || !!loadError}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, opacity: saving || !dirty || loadError ? 0.5 : 1 }}
            >
              {saving ? "Saving…" : dirty ? "Save context" : "Saved"}
            </button>
            {loadError && (
              <span className="text-[11px]" style={{ color: T.red }}>
                Can't save yet — run migration 057 in the Supabase SQL editor ({loadError})
              </span>
            )}
            {saveError && <span className="text-[11px]" style={{ color: T.red }}>{saveError}</span>}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: T.textFaint }}>Last {FEED_DAYS} days</div>
        <div className="flex flex-col">
          {feed.map((d) => {
            const date = new Date(d.key + "T00:00:00");
            const note = saved[d.key];
            return (
              <button
                key={d.key}
                onClick={() => setDateKey(d.key)}
                className="grid items-baseline gap-3 py-2 text-left text-xs w-full"
                style={{
                  gridTemplateColumns: "84px 90px 70px 1fr",
                  borderBottom: `1px solid ${T.borderSoft}`,
                  background: d.key === dateKey ? `${T.amber}10` : undefined,
                }}
              >
                <span style={{ color: T.text }}>{date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                <span style={{ fontFamily: T.fontMono, color: d.hasData ? T.teal : T.textFaint }}>{d.hasData ? fmtMoney(d.amount) : "no data"}</span>
                <span style={{ fontFamily: T.fontMono, color: T.textFaint }}>{d.hasData ? `${fmtCount(d.orders)} ord` : ""}</span>
                <span className="truncate" style={{ color: note ? T.textDim : T.textFaint }}>{note || "—"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
