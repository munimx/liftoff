'use client';

import {
  DeploymentStatus,
  DEPLOYMENT_STATUS_LABELS,
  DEPLOYMENT_STATUS_STEP,
  TERMINAL_STATUSES,
  type DeploymentStatusType,
} from '@liftoff/shared';
import { CheckCircle2, Loader2, Circle, XCircle, ExternalLink, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PlainStatusProps {
  status: DeploymentStatusType;
  endpoint: string | null;
  deploymentId: string;
}

const STEPS = [
  { key: 'upload', label: 'Code uploaded' },
  { key: 'build', label: 'Building your app' },
  { key: 'server', label: 'Setting up your server' },
  { key: 'live', label: 'Making it live' },
] as const;

/**
 * Friendly deployment status display for non-developers.
 */
export function PlainStatus({ status, endpoint, deploymentId }: PlainStatusProps): JSX.Element {
  const label = DEPLOYMENT_STATUS_LABELS[status] ?? status;
  const currentStep = DEPLOYMENT_STATUS_STEP[status] ?? 0;
  const isSuccess = status === DeploymentStatus.SUCCESS;
  const isFailed = status === DeploymentStatus.FAILED;
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const progressPercent = isSuccess ? 100 : (currentStep / 4) * 100;

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        {isSuccess && <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />}
        {isFailed && <XCircle className="mx-auto h-12 w-12 text-destructive" />}
        {!isTerminal && <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />}

        <h2 className="text-2xl font-bold">{label}</h2>
        {!isTerminal && (
          <p className="text-muted-foreground">Usually takes 2–3 minutes</p>
        )}
      </div>

      {!isFailed && (
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isSuccess ? 'bg-green-500' : 'bg-primary',
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {!isTerminal && (
            <p className="text-sm text-muted-foreground text-right">
              Step {currentStep}/4
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = currentStep > index || isSuccess;
          const isActive = currentStep === stepNumber && !isTerminal;

          return (
            <div key={step.key} className="flex items-center gap-3">
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              ) : isActive ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <span
                className={cn(
                  'text-sm',
                  isCompleted && 'text-foreground',
                  isActive && 'text-foreground font-medium',
                  !isCompleted && !isActive && 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {isSuccess && endpoint && (
        <Button asChild size="lg" className="w-full">
          <a href={endpoint} target="_blank" rel="noopener noreferrer">
            Open My App
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      )}

      {isFailed && (
        <Button asChild variant="outline" size="lg" className="w-full">
          <a
            href={`mailto:support@liftoff.dev?subject=Deployment%20failed&body=Deployment%20ID:%20${deploymentId}`}
          >
            <Mail className="mr-2 h-4 w-4" />
            Get help
          </a>
        </Button>
      )}
    </div>
  );
}
