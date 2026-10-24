import { useState, useEffect, useCallback } from 'react';
import type { SystemStatus } from '@/types';

const CAMERA_URL = 'http://192.168.1.9';
const ARM_URL = 'http://192.168.1.7';

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>({
    camera: 'connecting',
    arm: 'connecting',
    mcp: 'connecting',
    gemini: 'connecting',
    xiaozhi: 'connecting',
  });

  const checkStatus = useCallback(async () => {
    const check = async (url: string): Promise<'online' | 'offline'> => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        await fetch(url, { signal: controller.signal, mode: 'no-cors' });
        clearTimeout(timeout);
        return 'online';
      } catch {
        return 'offline';
      }
    };

    const [camera, arm] = await Promise.all([
      check(CAMERA_URL),
      check(ARM_URL),
    ]);

    setStatus({
      camera,
      arm,
      mcp: 'online',
      gemini: 'online',
      xiaozhi: 'online',
    });
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return { status, refresh: checkStatus };
}
