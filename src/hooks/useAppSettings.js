import { useCallback, useEffect, useState } from "react";
import { fetchAppSettings } from "../lib/api/appSettings.js";

// Fetches independently of auth state — the login screen itself needs to
// know we're in maintenance mode before it renders.
export function useAppSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    return fetchAppSettings()
      .then(setSettings)
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { settings, loading, refresh };
}
