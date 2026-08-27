import React, { useState } from "react";
import { T, STAGE_ORDER } from "../theme.js";
import { StatusDot } from "../components/ui.jsx";
import { fmtMoney, fmtDealValue, dealValueUsd, daysBetween, TODAY } from "../lib/helpers.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function PipelinePage({ companies, regionColors, goToCompany, updateCompany }) {
  const { profile } = useAuth();
  const isGeoPartner = profile?.role === "geo_partner";
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [movingId, setMovingId] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = async (e, stage) => {
    e.preventDefault();
    setDragOverStage(null);
    const id = e.dataTransfer.getData("text/plain");
    setDraggingId(null);
    const company = companies.find((c) => c.id === id);
    if (!company || company.stage === stage) return;
    setMovingId(id);
    setError(null);
    try {
      await updateCompany(id, { stage });
    } catch (err) {
      // e.g. the Installed-stage gate (migration 037) rejecting a company
      // whose Pre-Install Checklist isn't approved or bypassed yet — the
      // card stays put since the underlying company.stage never changed.
      setError(err.message || "Couldn't move that company — try again.");
    } finally {
      setMovingId(null);
    }
  };

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>Pipeline</h1>
      <p className="text-sm mb-3" style={{ color: T.textDim }}>Drag and drop a company card into another column to move it through the pipeline.</p>
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        {Object.entries(regionColors).map(([region, color]) => (
          <span key={region} className="flex items-center gap-1.5 text-xs" style={{ color: T.textFaint }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: color }} />
            {region}
          </span>
        ))}
        {isGeoPartner && (
          <span className="flex items-center gap-1.5 text-xs" style={{ color: T.textFaint }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: T.amber }} />
            Your region
          </span>
        )}
      </div>
      {error && <p className="text-sm mb-4" style={{ color: T.red }}>{error}</p>}
      <div className="grid grid-cols-6 gap-3 items-start">
        {STAGE_ORDER.map((stage) => {
          const deals = companies.filter((c) => c.stage === stage);
          const total = deals.reduce((s, c) => s + dealValueUsd(c), 0);
          const isDragOver = dragOverStage === stage;
          return (
            <div
              key={stage}
              onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage); }}
              onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => onDrop(e, stage)}
              className="rounded-xl p-3 transition-colors"
              style={{ background: T.surface, border: `1px solid ${isDragOver ? T.amber : T.border}`, minHeight: 200 }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: T.text, fontFamily: T.fontDisplay }}>{stage}</span>
                <span className="text-[11px]" style={{ color: T.textFaint, fontFamily: T.fontMono }}>{deals.length}</span>
              </div>
              <div className="text-[11px] mb-3" style={{ color: T.textFaint, fontFamily: T.fontMono }}>{fmtMoney(total)}</div>
              <div className="flex flex-col gap-2">
                {deals.map((c) => {
                  const days = daysBetween(c.createdDate, TODAY);
                  // A Strategic Partner sees every region's companies here
                  // now (migration 039) — an amber edge marks which ones
                  // are actually theirs (their own region), overriding the
                  // region-color legend, vs. read-only visibility into
                  // everyone else's.
                  const isMine = isGeoPartner && c.region === profile.region;
                  const edgeColor = isMine ? T.amber : regionColors[c.region];
                  return (
                    <button
                      key={c.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); setDraggingId(c.id); }}
                      onDragEnd={() => { setDraggingId(null); setDragOverStage(null); }}
                      onClick={() => goToCompany(c.id)}
                      className="text-left rounded-lg p-2.5 cursor-grab active:cursor-grabbing"
                      style={{
                        background: T.surface2, border: `1px solid ${edgeColor || T.borderSoft}`,
                        boxShadow: edgeColor ? `0 0 0 1px ${edgeColor}` : undefined,
                        opacity: draggingId === c.id || movingId === c.id ? 0.4 : 1,
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <StatusDot status={c.status} size={6} />
                        <span className="text-xs font-medium truncate" style={{ color: T.text }}>{c.name}</span>
                      </div>
                      <div className="text-[11px]" style={{ color: T.teal, fontFamily: T.fontMono }}>{fmtDealValue(c)}</div>
                      <div className="text-[10px] mt-1" style={{ color: T.textFaint }}>{days}d in pipeline · {c.rep}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
