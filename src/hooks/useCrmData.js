import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import * as companiesApi from "../lib/api/companies.js";
import * as tasksApi from "../lib/api/tasks.js";
import * as profilesApi from "../lib/api/profiles.js";
import * as activityApi from "../lib/api/activity.js";
import * as revenueCsvApi from "../lib/api/revenueCsv.js";
import * as adminUsersApi from "../lib/api/adminUsers.js";
import { transformCompany, transformTask, transformActivityEntry } from "../lib/transform.js";

export function useCrmData() {
  const { session } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [rawCompanies, rawTasks, rawProfiles, rawActivity] = await Promise.all([
        companiesApi.fetchCompanies(),
        tasksApi.fetchTasks(),
        profilesApi.fetchProfiles(),
        activityApi.fetchRecentActivity(),
      ]);
      setCompanies(rawCompanies.map(transformCompany));
      setTasks(rawTasks.map(transformTask));
      setProfiles(rawProfiles);
      setRecentActivity(rawActivity.map(transformActivityEntry));
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
    upsertPreInstallChecklist: withRefresh(companiesApi.upsertPreInstallChecklist),
    completePreInstallChecklist: withRefresh(companiesApi.completePreInstallChecklist),
    submitPreInstallChecklistForInstall: withRefresh(companiesApi.submitPreInstallChecklistForInstall),
    addNote: withRefresh(companiesApi.addNote),
    updateNote: withRefresh(companiesApi.updateNote),
    deleteNote: withRefresh(companiesApi.deleteNote),
    deleteActivity: withRefresh(companiesApi.deleteActivity),
    addRevenueEntry: withRefresh(companiesApi.addRevenueEntry),
    createTask: withRefresh(tasksApi.createTask),
    completeTask: withRefresh(tasksApi.completeTask),
    updateTask: withRefresh(tasksApi.updateTask),
    deleteTask: withRefresh(tasksApi.deleteTask),
    uploadCsvRevenue: withRefresh(revenueCsvApi.upsertCsvRevenue),
    createUser: withRefresh(adminUsersApi.createUser),
    deleteUser: withRefresh(adminUsersApi.deleteUser),
  };
}
