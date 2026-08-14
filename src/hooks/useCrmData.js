import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import * as companiesApi from "../lib/api/companies.js";
import * as tasksApi from "../lib/api/tasks.js";
import * as profilesApi from "../lib/api/profiles.js";
import * as activityApi from "../lib/api/activity.js";
import * as revenueCsvApi from "../lib/api/revenueCsv.js";
import * as adminUsersApi from "../lib/api/adminUsers.js";
import * as showroomBookingsApi from "../lib/api/showroomBookings.js";
import * as notesApi from "../lib/api/notes.js";
import { transformCompany, transformTask, transformActivityEntry, transformShowroomBooking, transformNote } from "../lib/transform.js";

export function useCrmData() {
  const { session } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [showroomBookings, setShowroomBookings] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [rawCompanies, rawTasks, rawProfiles, rawActivity, rawBookings, rawNotes] = await Promise.all([
        companiesApi.fetchCompanies(),
        tasksApi.fetchTasks(),
        profilesApi.fetchProfiles(),
        activityApi.fetchRecentActivity(),
        showroomBookingsApi.fetchShowroomBookings(),
        notesApi.fetchNotes(),
      ]);
      setCompanies(rawCompanies.map(transformCompany));
      setTasks(rawTasks.map(transformTask));
      setProfiles(rawProfiles);
      setRecentActivity(rawActivity.map(transformActivityEntry));
      setShowroomBookings(rawBookings.map(transformShowroomBooking));
      setNotes(rawNotes.map(transformNote));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Keyed on the user id, not the session object — see AuthContext.jsx for why:
  // Supabase swaps in a new session object (same user) on every background
  // token refresh, which would otherwise trigger a needless full refetch here.
  const userId = session?.user?.id;
  useEffect(() => {
    if (userId) refresh();
  }, [userId, refresh]);

  function withRefresh(fn) {
    return async (...args) => {
      const result = await fn(...args);
      await refresh();
      return result;
    };
  }

  return {
    companies,
    tasks,
    profiles,
    recentActivity,
    showroomBookings,
    notes,
    loading,
    error,
    refresh,
    createCompany: withRefresh(companiesApi.createCompany),
    updateCompany: withRefresh(companiesApi.updateCompany),
    deleteCompany: withRefresh(companiesApi.deleteCompany),
    createContact: withRefresh(companiesApi.createContact),
    updateContact: withRefresh(companiesApi.updateContact),
    deleteContact: withRefresh(companiesApi.deleteContact),
    createOutlet: withRefresh(companiesApi.createOutlet),
    updateOutlet: withRefresh(companiesApi.updateOutlet),
    deleteOutlet: withRefresh(companiesApi.deleteOutlet),
    createDevice: withRefresh(companiesApi.createDevice),
    updateDevice: withRefresh(companiesApi.updateDevice),
    deleteDevice: withRefresh(companiesApi.deleteDevice),
    addCommunicationLogEntry: withRefresh(companiesApi.addCommunicationLogEntry),
    updateCommunicationLogEntry: withRefresh(companiesApi.updateCommunicationLogEntry),
    deleteCommunicationLogEntry: withRefresh(companiesApi.deleteCommunicationLogEntry),
    deleteActivity: withRefresh(companiesApi.deleteActivity),
    addRevenueEntry: withRefresh(companiesApi.addRevenueEntry),
    createTask: withRefresh(tasksApi.createTask),
    completeTask: withRefresh(tasksApi.completeTask),
    updateTask: withRefresh(tasksApi.updateTask),
    deleteTask: withRefresh(tasksApi.deleteTask),
    upsertPreInstallChecklist: withRefresh(tasksApi.upsertPreInstallChecklist),
    completePreInstallChecklist: withRefresh(tasksApi.completePreInstallChecklist),
    submitPreInstallChecklistForInstall: withRefresh(tasksApi.submitPreInstallChecklistForInstall),
    approvePreInstallChecklist: withRefresh(tasksApi.approvePreInstallChecklist),
    bypassPreInstallChecklist: withRefresh(tasksApi.bypassPreInstallChecklist),
    undoBypassPreInstallChecklist: withRefresh(tasksApi.undoBypassPreInstallChecklist),
    uploadCsvRevenue: withRefresh(revenueCsvApi.upsertCsvRevenue),
    createShowroomBooking: withRefresh(showroomBookingsApi.createShowroomBooking),
    deleteShowroomBooking: withRefresh(showroomBookingsApi.deleteShowroomBooking),
    createUser: withRefresh(adminUsersApi.createUser),
    deleteUser: withRefresh(adminUsersApi.deleteUser),
    createNote: withRefresh(notesApi.createNote),
    deleteNote: withRefresh(notesApi.deleteNote),
    markNoteRead: withRefresh(notesApi.markNoteRead),
    createNoteComment: withRefresh(notesApi.createNoteComment),
    deleteNoteComment: withRefresh(notesApi.deleteNoteComment),
  };
}
