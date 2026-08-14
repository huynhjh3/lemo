import { useCallback, useEffect, useState } from "react";
import { fetchPendingApprovals } from "../lib/api/masterAdminApprovals.js";

export function useMasterAdminApprovals() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    return fetchPendingApprovals()
      .then(setApprovals)
      .catch(() => setApprovals([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { approvals, loading, refresh };
}
