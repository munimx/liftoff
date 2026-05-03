'use client';

import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/use-toast';
import { useDeleteEnvironment, useEnvironment } from '@/hooks/queries/use-environments';
import { useDeployments, useTriggerDeployment } from '@/hooks/queries/use-deployments';

function resolveRouteParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] ?? '';
  }
  return param ?? '';
}

export default function EnvironmentSettingsPage(): JSX.Element {
  const router = useRouter();
  const params = useParams();
  const projectId = resolveRouteParam(params.id);
  const environmentId = resolveRouteParam(params.envId);
  const { data: environment, isLoading } = useEnvironment(projectId, environmentId);
  const deleteEnvironmentMutation = useDeleteEnvironment(projectId);
  const triggerDeploymentMutation = useTriggerDeployment(environmentId);
  const { data: deploymentsData } = useDeployments(environmentId, 1, 1);

  const handleTriggerDeployment = async (): Promise<void> => {
    try {
      await triggerDeploymentMutation.mutateAsync(undefined);
      toast({
        title: 'Deployment triggered',
        description: 'A new deployment has been queued.',
      });
    } catch {
      toast({
        title: 'Failed to trigger deployment',
        description: 'There may be an active deployment already running.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteEnvironment = async (): Promise<void> => {
    const confirmed = window.confirm('Delete this environment? This action can be undone only by recreating it.');
    if (!confirmed) return;

    try {
      await deleteEnvironmentMutation.mutateAsync(environmentId);
      toast({
        title: 'Environment deleted',
        description: 'The environment has been soft-deleted.',
      });
      router.push(`/projects/${projectId}`);
    } catch {
      toast({
        title: 'Delete failed',
        description: 'Unable to delete this environment right now.',
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

  if (!environment) {
    return (
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Environment not found</h2>
        <p className="text-sm text-muted-foreground">
          This environment may have been deleted or you no longer have access.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Environment configuration and management
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment Details</CardTitle>
          <CardDescription>Core settings for this environment.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Name</p>
            <p className="font-medium">{environment.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Git Branch</p>
            <p className="font-medium">{environment.gitBranch}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Service Type</p>
            <Badge variant="secondary">{environment.serviceType}</Badge>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">DO Account</p>
            <p className="font-mono text-xs">{environment.doAccountId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
            <p className="text-muted-foreground">{new Date(environment.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Deployments</p>
            <p className="text-muted-foreground">{deploymentsData?.total ?? 0}</p>
          </div>
          {environment.pulumiStack?.outputs && (
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Infrastructure Stack</p>
              <p className="font-mono text-xs text-muted-foreground">{environment.pulumiStack.stackName}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manually trigger a deployment or manage infrastructure.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            onClick={() => void handleTriggerDeployment()}
            disabled={triggerDeploymentMutation.isPending}
          >
            {triggerDeploymentMutation.isPending ? <Spinner className="h-4 w-4" /> : 'Trigger Deployment'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>Deleting an environment only soft-deletes metadata in Liftoff. Infrastructure in your DO account is not automatically removed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => void handleDeleteEnvironment()}
            disabled={deleteEnvironmentMutation.isPending}
          >
            {deleteEnvironmentMutation.isPending ? <Spinner className="h-4 w-4" /> : 'Delete Environment'}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
