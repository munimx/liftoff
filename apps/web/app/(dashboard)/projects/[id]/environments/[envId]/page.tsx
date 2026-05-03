'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/use-toast';
import {
  useEnvironment,
  useUpdateConfig,
  useValidateConfig,
} from '@/hooks/queries/use-environments';
import { cn } from '@/lib/utils';

const configSchema = z.object({
  configYaml: z.string().min(1, 'Configuration YAML is required'),
});

type ConfigValues = z.infer<typeof configSchema>;

const defaultConfig = `version: "1.0"
service:
  name: test-app
  type: app
  region: nyc3
runtime:
  instance_size: apps-s-1vcpu-0.5gb
  port: 3000
  replicas: 1
healthcheck:
  path: /`;

function resolveRouteParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] ?? '';
  }

  return param ?? '';
}

/**
 * Environment detail page with config management and danger actions.
 */
export default function EnvironmentDetailPage(): JSX.Element {
  const params = useParams();
  const projectId = resolveRouteParam(params.id);
  const environmentId = resolveRouteParam(params.envId);
  const { data: environment, isLoading } = useEnvironment(projectId, environmentId);
  const updateConfigMutation = useUpdateConfig(projectId);
  const validateConfigMutation = useValidateConfig(projectId);

  const form = useForm<ConfigValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      configYaml: defaultConfig,
    },
  });

  useEffect(() => {
    if (environment?.configYaml) {
      form.setValue('configYaml', environment.configYaml);
    }
  }, [environment?.configYaml, form]);

  const handleValidateConfig = async (): Promise<void> => {
    const values = form.getValues();
    const result = await validateConfigMutation.mutateAsync({
      id: environmentId,
      configYaml: values.configYaml,
    });

    if (result.valid) {
      toast({
        title: 'Config is valid',
        description: 'No validation errors found in liftoff.yml.',
      });
      return;
    }

    const firstError = result.errors?.[0];
    toast({
      title: 'Config validation failed',
      description: firstError
        ? `${firstError.path}: ${firstError.message}`
        : 'Please review configuration values.',
      variant: 'destructive',
    });
  };

  const handleSaveConfig = form.handleSubmit(async (values) => {
    try {
      await updateConfigMutation.mutateAsync({
        id: environmentId,
        configYaml: values.configYaml,
      });
      toast({
        title: 'Configuration saved',
        description: 'Environment configuration has been updated.',
      });
    } catch {
      toast({
        title: 'Save failed',
        description: 'Configuration did not pass validation.',
        variant: 'destructive',
      });
    }
  });

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
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{environment.name}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{environment.serviceType}</Badge>
          <span>Branch: {environment.gitBranch}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>liftoff.yml configuration</CardTitle>
          <CardDescription>Validate and save environment deployment configuration.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void handleSaveConfig(event)} className="space-y-3">
            <textarea
              className={cn(
                'min-h-[280px] w-full rounded-md border border-input bg-background p-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
              {...form.register('configYaml')}
            />
            {form.formState.errors.configYaml?.message ? (
              <p className="text-xs text-destructive">{form.formState.errors.configYaml.message}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleValidateConfig()}
                disabled={validateConfigMutation.isPending}
              >
                {validateConfigMutation.isPending ? <Spinner className="h-4 w-4" /> : 'Validate config'}
              </Button>
              <Button type="submit" disabled={updateConfigMutation.isPending}>
                {updateConfigMutation.isPending ? <Spinner className="h-4 w-4" /> : 'Save config'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deployments</CardTitle>
          <CardDescription>Deployment history will expand in the next phase.</CardDescription>
        </CardHeader>
        <CardContent>
          {environment.deployments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deployments yet.</p>
          ) : (
            <div className="space-y-2">
              {environment.deployments.map((deployment) => (
                <div key={deployment.id} className="rounded-md border px-3 py-2 text-sm">
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    href={`/projects/${projectId}/environments/${environmentId}/deployments/${deployment.id}`}
                  >
                    {deployment.status}
                  </Link>
                  <span className="ml-2 text-muted-foreground">
                    {new Date(deployment.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
