import React, { useState } from "react";
import { T } from "../theme.js";
import Modal from "./Modal.jsx";
import { pendingChecklistTasks, fmtDate, TODAY } from "../lib/helpers.js";

// Always relative to today, not the task's existing (possibly long-stale)
// due date — "push out 1 week" should mean "due a week from now," not
// "a week later than whatever it already was," which for a badly overdue
// task wouldn't even clear it off the list.
function addDaysFromToday(days) {
  const next = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + days);
  const y = next.getFullYear(), m = String(next.getMonth() + 1).padStart(2, "0"), d = String(next.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Same list this feeds into on the Overview page's High Priority Actions
// card (pendingChecklistTasks) — bulk-pushing a due date out a week is
// literally what makes one of these go quiet until then, since that
// filter is due-date-aware.
export default function ManagePreInstallChecklistsModal({ tasks, updateTask, goToCompany, onClose }) {
  const pending = pendingChecklistTasks(tasks);
  const [selected, setSelected] = useState(new Set());
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState(null);

  const toggle = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allIds = pending.map((t) => t.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));

  const pushOutSelected = async (days) => {
    if (selected.size === 0) return;
    setPushing(true);
    setError(null);
    try {
      const newDue = addDaysFromToday(days);
      await Promise.all(
        Array.from(selected).map((id) => updateTask(id, { due_date: newDue }))
      );
      setSelected(new Set());
    } catch (err) {
      setError(err.message || "Couldn't update — try again.");
    } finally {
      setPushing(false);
    }
  };

  return (
    <Modal title="Manage Pre-Install Checklists" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {pending.length === 0 ? (
          <p className="text-sm" style={{ color: T.textFaint }}>Nothing pending right now.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <button type="button" onClick={toggleAll} className="text-xs" style={{ color: T.amber }}>
                {allSelected ? "Clear selection" : "Select all"}
              </button>
              <span className="text-xs" style={{ color: T.textFaint }}>{pending.length} pending</span>
            </div>

            <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 320 }}>
              {pending.map((t) => (
                <div key={t.id} className="flex items-start gap-2 text-sm rounded-lg px-2 py-2" style={{ background: T.surface2 }}>
                  <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="mt-1" />
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggle(t.id)}>
                    <div style={{ color: T.text }}>{t.title} <span style={{ color: T.textFaint }}>· {t.company}</span></div>
                    <div className="text-xs" style={{ color: T.textFaint }}>
                      {t.checklist ? "In progress" : "Not started"}{t.due ? ` · due ${fmtDate(t.due)}` : ""}
                    </div>
                  </div>
                  <button
                    type="button" onClick={() => { goToCompany(t.companyId); onClose(); }}
                    className="text-xs shrink-0" style={{ color: T.amber }}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
              <button
                type="button" onClick={() => pushOutSelected(7)}
                disabled={selected.size === 0 || pushing}
                className="text-sm font-medium rounded-lg px-3 py-2 flex-1"
                style={{ background: T.amber, color: T.bg, opacity: selected.size === 0 || pushing ? 0.5 : 1 }}
              >
                {pushing ? "Pushing out…" : `Push out 1 week${selected.size ? ` (${selected.size})` : ""}`}
              </button>
              <button
                type="button" onClick={() => pushOutSelected(30)}
                disabled={selected.size === 0 || pushing}
                className="text-sm font-medium rounded-lg px-3 py-2"
                style={{ border: `1px solid ${T.border}`, color: T.textDim, opacity: selected.size === 0 || pushing ? 0.5 : 1 }}
              >
                1 month
              </button>
            </div>
            {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
            <p className="text-xs" style={{ color: T.textFaint }}>
              Pushing the date out moves it off this list until the new due date arrives — it doesn't touch anything already filled in on the checklist itself.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
