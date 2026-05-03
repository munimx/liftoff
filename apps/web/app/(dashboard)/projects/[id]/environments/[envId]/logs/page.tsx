'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LogViewer, type DeploymentLogViewerEntry } from '@/components/deployments/log-viewer';
import { apiClient } from '@/lib/api-client';
import { getSocket } from '@/lib/ws-client';
import { useAuthStore } from '@/store/auth.store';
import { Download, Pause, Play, RefreshCw } from 'lucide-react';

type LogType = 'BUILD' | 'DEPLOY' | 'RUN' | 'RUN_RESTARTED';

interface AppLogEntry {
  line: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  source: string;
}

export default function EnvironmentLogsPage(): JSX.Element {
  const params = useParams() as { id: string; envId: string };
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);

  const [activeLogType, setActiveLogType] = useState<LogType>('RUN');
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [isLiveTailing, setIsLiveTailing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const liveLogIdRef = useRef(0);

  const fetchLogs = useCallback(async () => {
    if (!isAuthenticated || !params.envId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/environments/${params.envId}/logs`, {
        params: { type: activeLogType, limit: 200 },
      });
      setLogs(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, params.envId, activeLogType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!isLiveTailing || !accessToken || !params.envId) return;

    const socket = getSocket(accessToken);
    if (!socket.connected) {
      socket.connect();
    }

    const handleLogLine = (payload: { line: string; timestamp: string }): void => {
      liveLogIdRef.current += 1;
      const entry: AppLogEntry = {
        line: payload.line,
        timestamp: payload.timestamp,
        level: 'INFO',
        source: 'live',
      };
      setLogs((prev) => [...prev, entry]);
    };

    socket.emit('start:log-stream', { environmentId: params.envId });
    socket.on('log-line', handleLogLine);

    return () => {
      socket.off('log-line', handleLogLine);
    };
  }, [isLiveTailing, accessToken, params.envId]);

  const handleExport = () => {
    const content = logs.map((log) => `[${log.timestamp}] ${log.level} ${log.line}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${activeLogType.toLowerCase()}-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    return log.line.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const logTypes: LogType[] = ['BUILD', 'DEPLOY', 'RUN', 'RUN_RESTARTED'];

  const logViewerEntries: DeploymentLogViewerEntry[] = filteredLogs.map((log, i) => ({
    id: `${log.timestamp}-${i}`,
    line: log.line,
    level: log.level,
    timestamp: log.timestamp,
    source: log.source,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Application Logs</h1>
        <p className="text-gray-600">View live logs from your application deployment</p>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex gap-2 border-b pb-4">
            {logTypes.map((type) => (
              <Button
                key={type}
                variant={activeLogType === type ? 'default' : 'outline'}
                onClick={() => setActiveLogType(type)}
              >
                {type === 'RUN_RESTARTED' ? 'Run Restarted' : type}
              </Button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isLiveTailing) {
                    setIsLiveTailing(false);
                  } else {
                    setIsLiveTailing(true);
                  }
                }}
              >
                {isLiveTailing ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Live Tail
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchLogs()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>

              <Button variant="outline" size="sm" onClick={handleExport} disabled={logs.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>

            {error && <div className="text-sm text-red-600">Error: {error}</div>}
            {isLoading && <div className="text-sm text-gray-600">Loading logs...</div>}
            {isLiveTailing && (
              <div className="text-sm text-green-600">Live tailing via WebSocket</div>
            )}
          </div>

          <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
            <LogViewer logs={logViewerEntries} />
          </div>

          <div className="text-sm text-gray-600">
            {filteredLogs.length} of {logs.length} log entries displayed
          </div>
        </div>
      </Card>
    </div>
  );
}
