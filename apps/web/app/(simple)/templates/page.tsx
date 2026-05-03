'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TEMPLATES } from '@liftoff/shared';
import { TemplateCard } from '@/components/simple/template-card';
import { useDeployTemplate } from '@/hooks/queries/use-upload';
import { useDoAccounts } from '@/hooks/queries/use-do-accounts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth.store';
import Link from 'next/link';

/**
 * Template gallery page for Simple Mode.
 */
export default function TemplatesPage(): JSX.Element {
  const router = useRouter();
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { data: doAccounts, isLoading: accountsLoading } = useDoAccounts();
  const deployTemplate = useDeployTemplate();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const doAccountId = doAccounts?.[0]?.id;

  const handleDeploy = (slug: string): void => {
    setSelectedSlug(slug);
    const template = TEMPLATES.find((t) => t.slug === slug);
    if (template) {
      setProjectName(template.slug);
    }
  };

  const handleConfirmDeploy = async (): Promise<void> => {
    if (!selectedSlug || !projectName.trim() || !doAccountId) return;

    const result = await deployTemplate.mutateAsync({
      templateSlug: selectedSlug,
      projectName: projectName.trim(),
      doAccountId,
    });

    setSelectedSlug(null);
    router.push(`/deploy/${result.deploymentId}/status`);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Start with a template</h1>
        <p className="text-muted-foreground mt-2">
          Pick a starter project and deploy it in one click
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Or{' '}
          <Link href="/deploy" className="underline hover:text-foreground transition-colors">
            upload your own code
          </Link>
        </p>
      </div>

      {!accountsLoading && !doAccountId && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No DigitalOcean account connected.{' '}
            <a href="/settings" className="underline">Connect one in Settings</a> first.
          </AlertDescription>
        </Alert>
      )}

      {deployTemplate.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {deployTemplate.error instanceof Error
              ? deployTemplate.error.message
              : 'Deployment failed. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((template) => (
          <TemplateCard
            key={template.slug}
            template={template}
            onDeploy={handleDeploy}
            isDeploying={deployTemplate.isPending}
          />
        ))}
      </div>

      <Dialog open={selectedSlug !== null} onOpenChange={(open) => !open && setSelectedSlug(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name your project</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="template-project-name">Project name</Label>
            <Input
              id="template-project-name"
              placeholder="my-app"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSlug(null)}>
              Cancel
            </Button>
            <Button
              disabled={!projectName.trim() || !doAccountId || deployTemplate.isPending}
              onClick={handleConfirmDeploy}
            >
              {deployTemplate.isPending ? 'Deploying...' : 'Deploy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
