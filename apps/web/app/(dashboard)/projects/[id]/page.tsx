'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/use-toast';
import { useDoAccounts } from '@/hooks/queries/use-do-accounts';
import { useCreateEnvironment } from '@/hooks/queries/use-environments';
import { useProject } from '@/hooks/queries/use-projects';

const createEnvironmentSchema = z.object({
  name: z
    .string()
    .min(1, 'Environment name is required')
    .max(40, 'Maximum 40 characters')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
  gitBranch: z.string().min(1, 'Git branch is required').max(100),
  doAccountId: z.string().min(1, 'Select a DigitalOcean account'),
});

type CreateEnvironmentValues = z.infer<typeof createEnvironmentSchema>;

function resolveRouteParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] ?? '';
  }

  return param ?? '';
}

/**
 * Project detail page with environment list and create-environment dialog.
 */
export default function ProjectDetailPage(): JSX.Element {
  const params = useParams();
  const projectId = resolveRouteParam(params.id);
  const [open, setOpen] = useState(false);
  const { data: project, isLoading } = useProject(projectId);
  const { data: doAccounts } = useDoAccounts();
  const createEnvironmentMutation = useCreateEnvironment(projectId);

  const form = useForm<CreateEnvironmentValues>({
    resolver: zodResolver(createEnvironmentSchema),
    defaultValues: {
      name: '',
      gitBranch: 'main',
      doAccountId: '',
    },
  });

  const handleCreateEnvironment = form.handleSubmit(async (values) => {
    try {
      await createEnvironmentMutation.mutateAsync({
        name: values.name,
        gitBranch: values.gitBranch,
        doAccountId: values.doAccountId,
        serviceType: 'APP',
      });
      toast({
        title: 'Environment created',
        description: `Environment "${values.name}" is ready.`,
      });
      form.reset({
        name: '',
        gitBranch: 'main',
        doAccountId: '',
      });
      setOpen(false);
    } catch {
      toast({
        title: 'Failed to create environment',
        description: 'Check your input values and try again.',
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

  if (!project) {
    return (
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Project not found</h2>
        <p className="text-sm text-muted-foreground">
          This project may have been deleted or you no longer have access.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{project.name}</h2>
        <p className="text-sm text-muted-foreground">{project.description || 'No description provided.'}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Environments</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/repository`}>Repository</Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Environment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create environment</DialogTitle>
                <DialogDescription>
                  Environments map to project branches and deployment targets.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={(event) => void handleCreateEnvironment(event)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="environment-name">Name</Label>
                  <Input id="environment-name" placeholder="production" {...form.register('name')} />
                  {form.formState.errors.name?.message ? (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environment-branch">Git branch</Label>
                  <Input id="environment-branch" placeholder="main" {...form.register('gitBranch')} />
                  {form.formState.errors.gitBranch?.message ? (
                    <p className="text-xs text-destructive">{form.formState.errors.gitBranch.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>DigitalOcean account</Label>
                  <Select
                    value={form.watch('doAccountId')}
                    onValueChange={(value) =>
                      form.setValue('doAccountId', value, {
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {doAccounts?.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.region} • {account.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.doAccountId?.message ? (
                    <p className="text-xs text-destructive">{form.formState.errors.doAccountId.message}</p>
                  ) : null}
                  {!doAccounts || doAccounts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Connect a DigitalOcean account in{' '}
                      <Link className="underline" href="/settings">
                        Settings
                      </Link>{' '}
                      first.
                    </p>
                  ) : null}
                </div>

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createEnvironmentMutation.isPending || !doAccounts || doAccounts.length === 0}
                  >
                    {createEnvironmentMutation.isPending ? <Spinner className="h-4 w-4" /> : 'Create environment'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {project.environments.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No environments yet</CardTitle>
            <CardDescription>
              Add an environment to begin managing deployment configuration.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {project.environments.map((environment) => (
            <Link key={environment.id} href={`/projects/${projectId}/environments/${environment.id}`}>
              <Card className="h-full transition-colors hover:bg-accent/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {environment.name}
                    <Badge variant="secondary">{environment.serviceType}</Badge>
                  </CardTitle>
                  <CardDescription>Branch: {environment.gitBranch}</CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Account: {environment.doAccountId.slice(0, 8)}...
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
