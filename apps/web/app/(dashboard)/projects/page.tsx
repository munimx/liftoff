'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/use-toast';
import { useCreateProject, useProjects } from '@/hooks/queries/use-projects';

const createProjectSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(40, 'Name must be at most 40 characters')
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Lowercase letters, numbers, hyphens only'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .default(''),
});

type CreateProjectValues = z.infer<typeof createProjectSchema>;

const PAGE_SIZE = 10;

/**
 * Projects list page with create-project dialog and pagination.
 */
export default function ProjectsPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useProjects(page, PAGE_SIZE);
  const createProjectMutation = useCreateProject();

  const form = useForm<CreateProjectValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleCreateProject = form.handleSubmit(async (values) => {
    try {
      await createProjectMutation.mutateAsync({
        name: values.name,
        description: values.description || undefined,
      });
      toast({
        title: 'Project created',
        description: `Project "${values.name}" is ready.`,
      });
      form.reset();
      setOpen(false);
    } catch {
      toast({
        title: 'Failed to create project',
        description: 'Please review the project name and try again.',
        variant: 'destructive',
      });
    }
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
          <p className="text-sm text-muted-foreground">Manage your deployable applications.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
              <DialogDescription>
                Project names must be lowercase and can include numbers and hyphens.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={(event) => void handleCreateProject(event)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project name</Label>
                <Input id="name" placeholder="my-webapp" {...form.register('name')} />
                {form.formState.errors.name?.message ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" placeholder="Optional description" {...form.register('description')} />
                {form.formState.errors.description?.message ? (
                  <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
                ) : null}
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                  className="min-w-[120px]"
                >
                  {createProjectMutation.isPending ? <Spinner className="h-4 w-4" /> : 'Create project'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex min-h-[35vh] items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data?.data.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full transition-colors hover:bg-accent/30">
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>{project.description || 'No description'}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {project._count.environments} environment
                    {project._count.environments === 1 ? '' : 's'}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
