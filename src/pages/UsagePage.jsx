import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { T } from "../theme.js";
import { fmtCount, groupByRegion } from "../lib/helpers.js";
import RegionDrilldown from "../components/RegionDrilldown.jsx";

export default function UsagePage({ companies, regionColors, goToCompany, back }) {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const byRegion = groupByRegion(companies, "usageHistory");
  const totalThisMonth = byRegion.reduce((s, r) => s + r.thisMonth, 0);

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

      <RegionDrilldown
        title="Usage"
        companies={companies}
        historyKey="usageHistory"
        regionColors={regionColors}
        selectedRegion={selectedRegion}
        setSelectedRegion={setSelectedRegion}
        goToCompany={goToCompany}
        fmt={fmtCount}
        byRegion={byRegion}
        emptyLabel="No usage recorded yet."
      />
    </div>
  );
}
