import React, { useState } from "react";
import { T, STAGE_ORDER } from "../theme.js";
import { StatusDot } from "../components/ui.jsx";
import { fmtMoney, fmtDealValue, dealValueUsd, daysBetween, TODAY } from "../lib/helpers.js";

export default function PipelinePage({ companies, goToCompany, updateCompany }) {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [movingId, setMovingId] = useState(null);

  const onDrop = async (e, stage) => {
    e.preventDefault();
    setDragOverStage(null);
    const id = e.dataTransfer.getData("text/plain");
    setDraggingId(null);
    const company = companies.find((c) => c.id === id);
    if (!company || company.stage === stage) return;
    setMovingId(id);
    try {
      await updateCompany(id, { stage });
    } finally {
      setMovingId(null);
    }
  };

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">Pipeline</h1>
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
                  return (
                    <button
                      key={c.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); setDraggingId(c.id); }}
                      onDragEnd={() => { setDraggingId(null); setDragOverStage(null); }}
                      onClick={() => goToCompany(c.id)}
                      className="text-left rounded-lg p-2.5 cursor-grab active:cursor-grabbing"
                      style={{
                        background: T.surface2, border: `1px solid ${T.borderSoft}`,
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
