'use client';

import { useParams } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { PlainStatus } from '@/components/simple/plain-status';
import { usePublicDeploymentStatus } from '@/hooks/queries/use-public-deployment';

/**
 * Public deployment status page — no auth required, shareable URL.
 */
export default function DeploymentStatusPage(): JSX.Element {
  const params = useParams<{ deploymentId: string }>();
  const { data, isLoading, isError } = usePublicDeploymentStatus(params.deploymentId);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md">
        {isLoading && (
          <div className="flex justify-center">
            <Spinner className="h-8 w-8" />
          </div>
        )}

        {isError && (
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">Deployment not found</p>
            <p className="mt-1 text-sm">Check the URL and try again.</p>
          </div>
        )}

        {data && (
          <PlainStatus
            status={data.status}
            endpoint={data.endpoint}
            deploymentId={data.id}
          />
        )}
      </div>
    </div>
  );
}
