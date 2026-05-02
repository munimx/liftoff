'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LogViewer } from '@/components/deployments/log-viewer';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { Download, Pause, Play, RefreshCw } from 'lucide-react';

type LogType = 'BUILD' | 'DEPLOY' | 'RUN' | 'RUN_RESTARTED';

interface AppLogEntry {
  line: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  source: string;
}

/**
 * Environment logs page for viewing live application logs.
 */
export default function EnvironmentLogsPage(): JSX.Element {
  const params = useParams() as { id: string; envId: string };
  const isAuthenticated = useAuthStore((state: any) => state.isAuthenticated);

  const [activeLogType, setActiveLogType] = useState<LogType>('RUN');
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [isLiveTailing, setIsLiveTailing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !params.envId) {
      return;
    }

    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.get(`/environments/${params.envId}/logs`, {
          params: {
            type: activeLogType,
            limit: 200,
          },
        });

        setLogs(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();

    // Auto-refresh every 5 seconds if live tailing is enabled
    let interval: NodeJS.Timeout | null = null;
    if (isLiveTailing) {
      interval = setInterval(fetchLogs, 5000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [params.envId, activeLogType, isLiveTailing, isAuthenticated]);

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
    if (!searchQuery) {
      return true;
    }
    return log.line.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const logTypes: LogType[] = ['BUILD', 'DEPLOY', 'RUN', 'RUN_RESTARTED'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Application Logs</h1>
        <p className="text-gray-600">View live logs from your application deployment</p>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          {/* Log Type Buttons */}
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

          {/* Controls */}
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
                onClick={() => setIsLiveTailing(!isLiveTailing)}
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
                onClick={() => {
                  const fetchLogs = async () => {
                    try {
                      const response = await apiClient.get(
                        `/environments/${params.envId}/logs`,
                        {
                          params: { type: activeLogType, limit: 200 },
                        },
                      );
                      setLogs(response.data);
                    } catch {
                      // Ignore refresh errors
                    }
                  };
                  fetchLogs();
                }}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>

              <Button variant="outline" size="sm" onClick={handleExport} disabled={logs.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>

            {/* Status */}
            {error && <div className="text-sm text-red-600">Error: {error}</div>}
            {isLoading && <div className="text-sm text-gray-600">Loading logs...</div>}
            {isLiveTailing && (
              <div className="text-sm text-green-600">Live tailing enabled</div>
            )}
          </div>

          {/* Log Viewer */}
          <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
            <LogViewer
              logs={filteredLogs.map((log) => ({
                id: `${log.timestamp}-${log.line}`,
                line: log.line,
                level: log.level,
                timestamp: log.timestamp,
                source: log.source,
              }))}
            />
          </div>

          {/* Summary */}
          <div className="text-sm text-gray-600">
            {filteredLogs.length} of {logs.length} log entries displayed
          </div>
        </div>
      </Card>
    </div>
  );
}

