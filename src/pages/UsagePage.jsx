import React, { useState } from "react";
import { ArrowLeft, MapPin, Sparkles } from "lucide-react";
import { T } from "../theme.js";
import {
  fmtCount, groupByRegion, companiesByHistory, usageSummaryStory, projectUsageMonthEnd,
  dealSegmentComparison, corpWellnessStory,
} from "../lib/helpers.js";
import CategoryDrilldown from "../components/CategoryDrilldown.jsx";

export default function UsagePage({ companies, regionColors, goToCompany, back }) {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const byRegion = groupByRegion(companies, "usageHistory");
  const totalThisMonth = byRegion.reduce((s, r) => s + r.thisMonth, 0);
  const totalLastMonth = byRegion.reduce((s, r) => s + r.lastMonth, 0);
  const monthEndProjection = projectUsageMonthEnd(companies);
  const projectedTotal = monthEndProjection ? totalThisMonth + monthEndProjection.projectedRemaining : null;
  const story = usageSummaryStory({ totalThisMonth, totalLastMonth, byRegion, projectedTotal, companies });
  const segmentComparison = dealSegmentComparison(companies);
  const corpWellness = corpWellnessStory(companies);

  return (
    <div>
      <button onClick={back} className="flex items-center gap-1.5 text-xs mb-4" style={{ color: T.textDim }}>
        <ArrowLeft size={14} /> Revenue
      </button>
      <div className="flex items-center justify-between mb-5">
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>
          {selectedRegion ? `Usage — ${selectedRegion}` : "Usage by Region"}
        </h1>
        <div className="text-right">
          <div style={{ fontFamily: T.fontMono, fontSize: 20, color: T.teal }}>{fmtCount(totalThisMonth)} orders</div>
          <div className="text-xs" style={{ color: T.textFaint }}>total this month</div>
        </div>
      </div>

      {story && (
        <div
          className="rounded-xl p-4 mb-4 flex items-start gap-2.5"
          style={{ background: T.surface, border: `1px solid ${T.amber}40` }}
        >
          <Sparkles size={15} style={{ color: T.amber, marginTop: 1, flexShrink: 0 }} />
          <p className="text-sm" style={{ color: T.text, lineHeight: 1.5 }}>{story}</p>
        </div>
      )}

      {(segmentComparison || corpWellness) && (
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: T.surface, border: `1px solid ${T.teal}40` }}
        >
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: T.teal, fontFamily: T.fontMono }}>
            Corporate Wellness Focus
          </div>
          <div className="flex flex-col gap-1.5">
            {segmentComparison && <p className="text-sm" style={{ color: T.text, lineHeight: 1.5 }}>{segmentComparison}</p>}
            {corpWellness && <p className="text-sm" style={{ color: T.text, lineHeight: 1.5 }}>{corpWellness}</p>}
          </div>
        </div>
      )}

      <CategoryDrilldown
        title="Usage"
        groupLabel="Region"
        groupIcon={MapPin}
        getColor={(region) => regionColors?.[region]}
        companiesInGroup={(region) => companiesByHistory(companies, "usageHistory", region)}
        selectedGroup={selectedRegion}
        setSelectedGroup={setSelectedRegion}
        backLabel="All regions"
        goToCompany={goToCompany}
        fmt={fmtCount}
        byGroup={byRegion}
        emptyLabel="No usage recorded yet."
      />
    </div>
  );
}
