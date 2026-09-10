import React, { useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { T } from "../theme.js";
import { fmtCount, groupByRegion, companiesByHistory } from "../lib/helpers.js";
import CategoryDrilldown from "../components/CategoryDrilldown.jsx";

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
