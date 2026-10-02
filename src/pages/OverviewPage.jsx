import React, { useState } from "react";
import { Flame, Activity, Sparkles, ListChecks, ClipboardList } from "lucide-react";
import { T, ACTIVITY_ICON } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import { fmtDate, TODAY, pipelineStory, highPriorityActions } from "../lib/helpers.js";
import { useMasterAdminApprovals } from "../hooks/useMasterAdminApprovals.js";
import ManageFollowUpsModal from "../components/ManageFollowUpsModal.jsx";
import ManagePreInstallChecklistsModal from "../components/ManagePreInstallChecklistsModal.jsx";
import DailyUpdateCard from "../components/DailyUpdateCard.jsx";

export default function OverviewPage({
  companies, tasks, notes, recentActivity, goToCompany, goToCompanyAndLogFollowUp, updateCompany, updateTask, firstName, profile,
}) {
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const story = pipelineStory(companies, profile);
  // RLS-scoped to Master Admins only (master_admin_approvals_select) — a
  // harmless empty fetch for everyone else, so calling it unconditionally
  // here (rather than threading a single instance down as a prop) is safe;
  // unlike useAppSettings/subscribeToTables (see project infra notes), this
  // hook is a plain one-shot fetch with no realtime channel to double-join.
  const { approvals } = useMasterAdminApprovals();
  const priorities = highPriorityActions(tasks, companies, notes, profile, approvals);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 600, color: T.text }}>
          Good morning{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm mt-1" style={{ color: T.textDim }}>
          {TODAY.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} — here's what needs your attention today.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="sm:col-span-2">
          <CardTitle
            icon={Flame}
            right={(
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowChecklistModal(true)}
                  className="flex items-center gap-1 text-xs"
                  style={{ color: T.textFaint }}
                  title="Bulk-push pre-install checklist due dates out"
                >
                  <ClipboardList size={12} /> Manage Checklists
                </button>
                <button
                  onClick={() => setShowFollowUpModal(true)}
                  className="flex items-center gap-1 text-xs"
                  style={{ color: T.textFaint }}
                  title="Bulk-dismiss follow-up flags that don't need action"
                >
                  <ListChecks size={12} /> Manage Follow-Ups
                </button>
              </div>
            )}
          >
            High Priority Actions
          </CardTitle>

          {story && (
            <div
              className="flex items-start gap-2 text-xs mb-3 pb-3"
              style={{ borderBottom: `1px solid ${T.borderSoft}` }}
            >
              <Sparkles size={13} style={{ color: T.amber, marginTop: 1, flexShrink: 0 }} />
              <p style={{ color: T.textDim, lineHeight: 1.5 }}>{story}</p>
            </div>
          )}

          {priorities.length === 0 ? (
            <p className="text-xs" style={{ color: T.textFaint }}>Nothing urgent right now.</p>
          ) : (
            <div className="flex flex-col divide-y overflow-y-auto" style={{ borderColor: T.borderSoft, maxHeight: 480 }}>
              {priorities.map((p) => {
                const Row = p.companyId ? "button" : "div";
                return (
                  <Row
                    key={p.key}
                    onClick={p.companyId ? () => (p.action === "openCommsLog" ? goToCompanyAndLogFollowUp(p.companyId) : goToCompany(p.companyId)) : undefined}
                    className="flex items-center gap-3 py-2.5 text-left w-full"
                    style={{ borderTop: `1px solid ${T.borderSoft}` }}
                  >
                    <p.icon size={15} style={{ color: p.urgency === 3 ? T.red : T.amber, flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate" style={{ color: T.text }}>{p.title}</div>
                      <div className="text-xs" style={{ color: T.textFaint }}>{p.sub}</div>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0"
                      style={{ color: p.urgency === 3 ? T.red : T.amber, background: `${p.urgency === 3 ? T.red : T.amber}14`, fontFamily: T.fontMono }}
                    >
                      {p.kind}
                    </span>
                  </Row>
                );
              })}
            </div>
          )}
        </Card>

        {/* On sm+ the card is pinned to the grid row's own height (set by
            High Priority Actions) and scrolls inside it, instead of a long
            feed stretching the row and leaving a blank gap under the
            priorities list. */}
        <div className="relative sm:min-h-[420px]">
          <div className="sm:absolute sm:inset-0">
            <DailyUpdateCard companies={companies} canEdit={profile?.role === "owner"} />
          </div>
        </div>
      </div>

      <Card>
        <CardTitle icon={Activity}>Recent Activity</CardTitle>
        {recentActivity.length === 0 ? (
          <p className="text-xs" style={{ color: T.textFaint }}>Nothing logged yet.</p>
        ) : (
          <div className="flex flex-col divide-y overflow-y-auto" style={{ borderColor: T.borderSoft, maxHeight: 480 }}>
            {recentActivity.map((a) => {
              const Icon = ACTIVITY_ICON[a.type] || Activity;
              const Row = a.companyId ? "button" : "div";
              return (
                <Row
                  key={a.id}
                  onClick={a.companyId ? () => goToCompany(a.companyId) : undefined}
                  className="flex items-center gap-3 py-2.5 text-left w-full"
                  style={{ borderTop: `1px solid ${T.borderSoft}` }}
                >
                  <div
                    className="rounded-full flex items-center justify-center shrink-0"
                    style={{ width: 22, height: 22, background: T.surface2, border: `1px solid ${T.border}` }}
                  >
                    <Icon size={11} style={{ color: T.amber }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: T.text }}>{a.summary}</div>
                    <div className="text-xs truncate" style={{ color: T.textFaint }}>{a.userName} · {a.companyName}</div>
                  </div>
                  <span className="text-[11px] shrink-0" style={{ color: T.textFaint, fontFamily: T.fontMono }}>{fmtDate(a.date)}</span>
                </Row>
              );
            })}
          </div>
        )}
      </Card>

      {showFollowUpModal && (
        <ManageFollowUpsModal
          companies={companies} tasks={tasks} profile={profile}
          updateCompany={updateCompany} goToCompany={goToCompany}
          onClose={() => setShowFollowUpModal(false)}
        />
      )}

      {showChecklistModal && (
        <ManagePreInstallChecklistsModal
          tasks={tasks} updateTask={updateTask} goToCompany={goToCompany}
          onClose={() => setShowChecklistModal(false)}
        />
      )}
    </div>
  );
}
