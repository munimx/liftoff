'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useProjects } from '@/hooks/queries/use-projects';

/**
 * Dashboard landing page with project summary.
 */
export default function DashboardPage(): JSX.Element {
  const { data, isLoading } = useProjects(1, 6);

  if (isLoading) {
    return (
      <section className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </section>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome to Liftoff</h2>
        <Card>
          <CardHeader>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              Create your first project to start deploying from GitHub to DigitalOcean.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/projects">Create project</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Recent projects</h2>
        <Button asChild variant="outline">
          <Link href="/projects">View all projects</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.data.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="h-full transition-colors hover:bg-accent/30">
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
                <CardDescription>
                  {project.description || 'No description yet'}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {project._count.environments} environment
                {project._count.environments === 1 ? '' : 's'}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
