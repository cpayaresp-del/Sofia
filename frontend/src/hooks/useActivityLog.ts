import { useState, useEffect } from 'react';
import { api, type ActivityLog } from '@/lib/api';

export function useActivityLog() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    fetchLogs();
    const interval = window.setInterval(fetchLogs, 10_000);
    return () => window.clearInterval(interval);
  }, []);

  async function fetchLogs() {
    try {
      setLogs(await api.activity.list(20));
    } catch {
      setLogs([]);
    }
  }

  async function addLog(type: ActivityLog['type'], description: string) {
    try {
      const log = await api.activity.create({ type, description });
      setLogs((prev) => [log, ...prev].slice(0, 20));
    } catch {
      // Activity logging must not block hardware controls.
    }
  }

  return { logs, addLog };
}
