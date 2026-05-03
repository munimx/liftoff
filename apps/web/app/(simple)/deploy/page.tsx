'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeploymentWizard, type WizardConfig } from '@/components/simple/deployment-wizard';
import { CodeUploadDropzone } from '@/components/simple/code-upload-dropzone';
import { Spinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/store/auth.store';
import Link from 'next/link';

/**
 * Simple Mode deploy page — wizard then upload.
 */
export default function SimpleDeployPage(): JSX.Element {
  const router = useRouter();
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [wizardConfig, setWizardConfig] = useState<WizardConfig | null>(null);

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

  if (!wizardConfig) {
    return (
      <div className="px-6 py-12 space-y-6">
        <DeploymentWizard onComplete={setWizardConfig} />
        <p className="text-center text-sm text-muted-foreground">
          Or{' '}
          <Link href="/templates" className="underline hover:text-foreground transition-colors">
            start from a template
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Upload your code</h2>
        <p className="text-muted-foreground mt-1">
          Drop a .zip file with your project — we&apos;ll handle the rest
        </p>
      </div>
      <CodeUploadDropzone wizardConfig={wizardConfig} />
      <button
        type="button"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto block"
        onClick={() => setWizardConfig(null)}
      >
        &larr; Back to wizard
      </button>
    </div>
  );
}
