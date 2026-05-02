'use client';

import {
  ACTIVE_STATUSES,
  WsEvents,
  type WsDeploymentCompletePayload,
  type WsDeploymentLogPayload,
  type WsDeploymentStatusPayload,
} from '@liftoff/shared';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LogViewer, type DeploymentLogViewerEntry } from '@/components/deployments/log-viewer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/use-toast';
import {
  type DeploymentRecord,
  useDeployment,
  useDeploymentLogs,
  useDeployments,
  useRollbackDeployment,
} from '@/hooks/queries/use-deployments';
import { getSocket } from '@/lib/ws-client';
import { useAuthStore } from '@/store/auth.store';

const ACTIVE_STATUS_SET = new Set<string>(ACTIVE_STATUSES);

const DEPLOYMENT_PROGRESS_STEPS: Array<{
  label: string;
  activeStatuses: DeploymentRecord['status'][];
  completedStatuses: DeploymentRecord['status'][];
}> = [
  {
    label: 'Build',
    activeStatuses: ['BUILDING'],
    completedStatuses: [
      'PUSHING',
      'PROVISIONING',
      'DEPLOYING',
      'SUCCESS',
      'FAILED',
      'ROLLING_BACK',
      'ROLLED_BACK',
    ],
  },
  {
    label: 'Push',
    activeStatuses: ['PUSHING'],
    completedStatuses: ['PROVISIONING', 'DEPLOYING', 'SUCCESS', 'FAILED', 'ROLLING_BACK', 'ROLLED_BACK'],
  },
  {
    label: 'Provision',
    activeStatuses: ['PROVISIONING'],
    completedStatuses: ['DEPLOYING', 'SUCCESS', 'FAILED', 'ROLLING_BACK', 'ROLLED_BACK'],
  },
  {
    label: 'Deploy',
    activeStatuses: ['DEPLOYING', 'ROLLING_BACK'],
    completedStatuses: ['SUCCESS', 'FAILED', 'ROLLED_BACK'],
  },
];

function resolveRouteParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] ?? '';
  }

  return param ?? '';
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) {
    return '—';
  }

  const startedAtMs = new Date(startedAt).getTime();
  const completedAtMs = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffSeconds = Math.max(0, Math.floor((completedAtMs - startedAtMs) / 1000));

  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

/**
 * Deployment details page with status, metadata, live logs, and rollback action.
 */
export default function DeploymentDetailsPage(): JSX.Element {
  const params = useParams();
  const environmentId = resolveRouteParam(params.envId);
  const deploymentId = resolveRouteParam(params.deployId);
  const accessToken = useAuthStore((state) => state.accessToken);

  const deploymentQuery = useDeployment(environmentId, deploymentId);
  const deploymentLogsQuery = useDeploymentLogs(environmentId, deploymentId);
  const deploymentsQuery = useDeployments(environmentId, 1, 50);
  const rollbackMutation = useRollbackDeployment(environmentId);

  const [liveStatus, setLiveStatus] = useState<DeploymentRecord['status'] | null>(null);
  const [liveLogs, setLiveLogs] = useState<DeploymentLogViewerEntry[]>([]);
  const liveLogCounterRef = useRef(0);

  useEffect(() => {
    setLiveStatus(null);
    setLiveLogs([]);
    liveLogCounterRef.current = 0;
  }, [deploymentId]);

  useEffect(() => {
    if (!accessToken || !deploymentId) {
      return;
    }

    const socket = getSocket(accessToken);
    if (!socket.connected) {
      socket.connect();
    }

    const handleStatus = (payload: WsDeploymentStatusPayload): void => {
      if (payload.deploymentId !== deploymentId) {
        return;
      }

      setLiveStatus(payload.status as DeploymentRecord['status']);
    };

    const handleLog = (payload: WsDeploymentLogPayload): void => {
      if (payload.deploymentId !== deploymentId) {
        return;
      }

      const nextEntry: DeploymentLogViewerEntry = {
        id: `live-${payload.timestamp}-${liveLogCounterRef.current}`,
        line: payload.line,
        timestamp: payload.timestamp,
        level: payload.level,
        source: payload.source,
      };
      liveLogCounterRef.current += 1;

      setLiveLogs((previousEntries) => [...previousEntries, nextEntry]);
    };

    const handleComplete = (payload: WsDeploymentCompletePayload): void => {
      if (payload.deploymentId !== deploymentId) {
        return;
      }

      setLiveStatus(payload.status as DeploymentRecord['status']);
    };

    socket.emit(WsEvents.JOIN_DEPLOYMENT, { deploymentId });
    socket.on(WsEvents.DEPLOYMENT_STATUS, handleStatus);
    socket.on(WsEvents.DEPLOYMENT_LOG, handleLog);
    socket.on(WsEvents.DEPLOYMENT_COMPLETE, handleComplete);

    return () => {
      socket.emit(WsEvents.LEAVE_DEPLOYMENT, { deploymentId });
      socket.off(WsEvents.DEPLOYMENT_STATUS, handleStatus);
      socket.off(WsEvents.DEPLOYMENT_LOG, handleLog);
      socket.off(WsEvents.DEPLOYMENT_COMPLETE, handleComplete);
    };
  }, [accessToken, deploymentId]);

  const deployment = useMemo(() => {
    if (!deploymentQuery.data) {
      return null;
    }

    if (!liveStatus) {
      return deploymentQuery.data;
    }

    return {
      ...deploymentQuery.data,
      status: liveStatus,
    };
  }, [deploymentQuery.data, liveStatus]);

  const persistedLogEntries: DeploymentLogViewerEntry[] =
    deploymentLogsQuery.data?.map((logRecord) => ({
      id: logRecord.id,
      line: logRecord.message,
      timestamp: logRecord.timestamp,
      level: logRecord.level,
      source: logRecord.source,
    })) ?? [];

  const combinedLogs = [...persistedLogEntries, ...liveLogs];

  const hasPreviousDeployments =
    (deploymentsQuery.data?.data.filter((item) => item.id !== deploymentId).length ?? 0) > 0;

  const handleRollback = async (): Promise<void> => {
    try {
      await rollbackMutation.mutateAsync(deploymentId);
      toast({
        title: 'Rollback queued',
        description: 'Rollback has been queued for processing.',
      });
    } catch {
      toast({
        title: 'Rollback failed',
        description: 'Unable to queue rollback for this deployment.',
        variant: 'destructive',
      });
    }
  };

  if (deploymentQuery.isLoading || deploymentLogsQuery.isLoading) {
    return (
      <section className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </section>
    );
  }

  if (!deployment) {
    return (
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Deployment not found</h2>
        <p className="text-sm text-muted-foreground">
          This deployment may have been deleted or you no longer have access.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Deployment {deployment.id.slice(0, 8)}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge
              className={ACTIVE_STATUS_SET.has(deployment.status) ? 'animate-pulse' : undefined}
              variant={deployment.status === 'FAILED' ? 'destructive' : 'secondary'}
            >
              {deployment.status}
            </Badge>
            <span>{new Date(deployment.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {deployment.status === 'SUCCESS' && hasPreviousDeployments ? (
          <Button onClick={() => void handleRollback()} disabled={rollbackMutation.isPending}>
            {rollbackMutation.isPending ? <Spinner className="h-4 w-4" /> : 'Rollback'}
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>Build → Push → Provision → Deploy</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          {DEPLOYMENT_PROGRESS_STEPS.map((step) => {
            const isActive = step.activeStatuses.includes(deployment.status);
            const isCompleted = step.completedStatuses.includes(deployment.status);

            return (
              <div
                key={step.label}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span
                  className={
                    isActive
                      ? 'inline-block h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse'
                      : isCompleted
                        ? 'inline-block h-2.5 w-2.5 rounded-full bg-emerald-500'
                        : 'inline-block h-2.5 w-2.5 rounded-full bg-muted'
                  }
                />
                <span>{step.label}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <p>
            <span className="font-medium">Commit SHA:</span> {deployment.commitSha ?? '—'}
          </p>
          <p>
            <span className="font-medium">Branch:</span> {deployment.branch ?? '—'}
          </p>
          <p>
            <span className="font-medium">Triggered by:</span> {deployment.triggeredBy ?? '—'}
          </p>
          <p>
            <span className="font-medium">Duration:</span>{' '}
            {formatDuration(deployment.startedAt, deployment.completedAt)}
          </p>
          <p className="md:col-span-2">
            <span className="font-medium">Endpoint:</span> {deployment.endpoint ?? '—'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>Real-time deployment logs from queue workers and App Platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <LogViewer logs={combinedLogs} />
        </CardContent>
      </Card>
    </section>
  );
}
