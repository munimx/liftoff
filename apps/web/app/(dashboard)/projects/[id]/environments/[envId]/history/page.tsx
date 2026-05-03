'use client';

import { ACTIVE_STATUSES } from '@liftoff/shared';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  GitBranch,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/use-toast';
import {
  type DeploymentRecord,
  useDeployments,
  useRollbackDeployment,
} from '@/hooks/queries/use-deployments';

const PAGE_SIZE = 20;

const ACTIVE_STATUS_SET = new Set<string>(ACTIVE_STATUSES);

function resolveRouteParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] ?? '';
  }
  return param ?? '';
}

function statusIcon(status: DeploymentRecord['status']): JSX.Element {
  if (status === 'SUCCESS') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (status === 'FAILED') {
    return <XCircle className="h-4 w-4 text-destructive" />;
  }
  if (status === 'ROLLED_BACK') {
    return <RotateCcw className="h-4 w-4 text-amber-500" />;
  }
  if (ACTIVE_STATUS_SET.has(status)) {
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  }
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function statusVariant(status: DeploymentRecord['status']): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (status === 'SUCCESS') return 'default';
  if (status === 'FAILED') return 'destructive';
  return 'secondary';
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function DeploymentHistoryPage(): JSX.Element {
  const params = useParams();
  const projectId = resolveRouteParam(params.id);
  const environmentId = resolveRouteParam(params.envId);

  const [page, setPage] = useState(1);
  const [rollbackTarget, setRollbackTarget] = useState<DeploymentRecord | null>(null);

  const { data, isLoading } = useDeployments(environmentId, page, PAGE_SIZE);
  const rollbackMutation = useRollbackDeployment(environmentId);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const baseUrl = `/projects/${projectId}/environments/${environmentId}`;

  const handleRollbackConfirm = async (): Promise<void> => {
    if (!rollbackTarget) return;
    try {
      await rollbackMutation.mutateAsync(rollbackTarget.id);
      toast({
        title: 'Rollback queued',
        description: `Rolling back to commit ${rollbackTarget.commitSha?.slice(0, 7) ?? 'unknown'}.`,
      });
      setRollbackTarget(null);
    } catch {
      toast({
        title: 'Rollback failed',
        description: 'Unable to queue rollback for this deployment.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <section className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Deployment History</h2>
        <p className="text-sm text-muted-foreground">
          {data?.total ?? 0} total deployments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Deployments</CardTitle>
          <CardDescription>Click a deployment to view logs and details.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data || data.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deployments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">Commit</th>
                    <th className="hidden pb-2 pr-3 font-medium md:table-cell">Branch</th>
                    <th className="hidden pb-2 pr-3 font-medium lg:table-cell">Triggered by</th>
                    <th className="hidden pb-2 pr-3 font-medium sm:table-cell">Duration</th>
                    <th className="pb-2 pr-3 font-medium">Created</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((deployment) => (
                    <tr key={deployment.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3">
                        <Link
                          href={`${baseUrl}/deployments/${deployment.id}`}
                          className="inline-flex items-center gap-1.5 hover:underline underline-offset-4"
                        >
                          {statusIcon(deployment.status)}
                          <Badge variant={statusVariant(deployment.status)} className="text-xs">
                            {deployment.status}
                          </Badge>
                        </Link>
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs">
                        {deployment.commitSha ? (
                          <span title={deployment.commitSha}>
                            {deployment.commitSha.slice(0, 7)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                        {deployment.commitMessage ? (
                          <p className="mt-0.5 max-w-[200px] truncate text-muted-foreground">
                            {deployment.commitMessage}
                          </p>
                        ) : null}
                      </td>
                      <td className="hidden py-3 pr-3 md:table-cell">
                        {deployment.branch ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <GitBranch className="h-3 w-3" />
                            {deployment.branch}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="hidden py-3 pr-3 lg:table-cell text-xs text-muted-foreground">
                        {deployment.triggeredBy?.startsWith('system:')
                          ? deployment.triggeredBy
                          : deployment.triggeredBy?.slice(0, 8) ?? '-'}
                      </td>
                      <td className="hidden py-3 pr-3 sm:table-cell text-xs text-muted-foreground">
                        {formatDuration(deployment.startedAt, deployment.completedAt)}
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">
                        {new Date(deployment.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`${baseUrl}/deployments/${deployment.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              Logs
                            </Button>
                          </Link>
                          {deployment.endpoint ? (
                            <a
                              href={deployment.endpoint}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="sm" className="h-7 text-xs">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </a>
                          ) : null}
                          {deployment.status === 'SUCCESS' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setRollbackTarget(deployment)}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Rollback
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={rollbackTarget !== null} onOpenChange={() => setRollbackTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Rollback</DialogTitle>
            <DialogDescription>
              Deploy image from commit{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-semibold">
                {rollbackTarget?.commitSha?.slice(0, 7) ?? 'unknown'}
              </code>
              ? The current deployment will be replaced.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleRollbackConfirm()}
              disabled={rollbackMutation.isPending}
            >
              {rollbackMutation.isPending ? <Spinner className="h-4 w-4" /> : 'Confirm Rollback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
