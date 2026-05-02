'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { RefreshCw } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface MetricDatapoint {
  timestamp: number;
  value: number;
}

/**
 * Environment metrics page for viewing performance metrics.
 */
export default function EnvironmentMetricsPage(): JSX.Element {
  const params = useParams() as { id: string; envId: string };
  const isAuthenticated = useAuthStore((state: any) => state.isAuthenticated);

  const [cpuMetrics, setCpuMetrics] = useState<MetricDatapoint[]>([]);
  const [memoryMetrics, setMemoryMetrics] = useState<MetricDatapoint[]>([]);
  const [bandwidthMetrics, setBandwidthMetrics] = useState<MetricDatapoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    if (!isAuthenticated || !params.envId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [cpuResponse, memoryResponse, bandwidthResponse] = await Promise.all([
        apiClient.get(`/environments/${params.envId}/metrics/cpu`),
        apiClient.get(`/environments/${params.envId}/metrics/memory`),
        apiClient.get(`/environments/${params.envId}/metrics/bandwidth`),
      ]);

      setCpuMetrics(cpuResponse.data);
      setMemoryMetrics(memoryResponse.data);
      setBandwidthMetrics(bandwidthResponse.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchMetrics, 60000);
    return () => clearInterval(interval);
  }, [params.envId, isAuthenticated]);

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatChartData = (metrics: MetricDatapoint[]) => {
    return metrics.map((m) => ({
      time: formatTime(m.timestamp),
      value: Math.round(m.value * 10) / 10,
    }));
  };

  const cpuData = formatChartData(cpuMetrics);
  const memoryData = formatChartData(memoryMetrics);
  const bandwidthData = formatChartData(bandwidthMetrics);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Metrics</h1>
          <p className="text-gray-600">Monitor your application performance</p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchMetrics}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Error: {error}
        </div>
      )}

      {/* CPU Metrics */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">CPU Usage (%)</h2>
        {cpuData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cpuData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value: any) => `${value}%`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                name="CPU %"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            No CPU metrics available
          </div>
        )}
      </Card>

      {/* Memory Metrics */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Memory Usage (%)</h2>
        {memoryData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={memoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value: any) => `${value}%`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                name="Memory %"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            No memory metrics available
          </div>
        )}
      </Card>

      {/* Bandwidth Metrics */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Network Bandwidth (Mbps)</h2>
        {bandwidthData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={bandwidthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip formatter={(value: any) => `${value} Mbps`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#f59e0b"
                name="Bandwidth"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            No bandwidth metrics available
          </div>
        )}
      </Card>
    </div>
  );
}

