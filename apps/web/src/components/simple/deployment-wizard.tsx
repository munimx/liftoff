'use client';

import { useState } from 'react';
import {
  APP_TYPES,
  APP_TYPE_DEFAULTS,
  APP_TYPE_INFO,
  SIZE_TIERS,
  SIZE_TIER_INFO,
  SIZE_TIER_INSTANCE_SIZES,
  type AppType,
  type SizeTier,
} from '@liftoff/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Check, Globe, Database, Cpu, Layout } from 'lucide-react';

export interface WizardConfig {
  appType: AppType;
  size: SizeTier;
  database: boolean;
  domain: string | null;
}

interface DeploymentWizardProps {
  onComplete: (config: WizardConfig) => void;
}

const TOTAL_STEPS = 4;

/**
 * 4-step deployment wizard for Simple Mode.
 */
export function DeploymentWizard({ onComplete }: DeploymentWizardProps): JSX.Element {
  const [step, setStep] = useState(1);
  const [appType, setAppType] = useState<AppType>('nextjs');
  const [size, setSize] = useState<SizeTier>('small');
  const [database, setDatabase] = useState(false);
  const [domain, setDomain] = useState('');
  const [usesCustomDomain, setUsesCustomDomain] = useState(false);

  const canAdvance = (): boolean => {
    if (step === 4 && usesCustomDomain && !domain.trim()) return false;
    return true;
  };

  const handleNext = (): void => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      onComplete({
        appType,
        size,
        database,
        domain: usesCustomDomain && domain.trim() ? domain.trim() : null,
      });
    }
  };

  const handleBack = (): void => {
    if (step > 1) setStep(step - 1);
  };

  const stepIcons = [Layout, Cpu, Database, Globe];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => {
          const StepIcon = stepIcons[i] ?? Layout;
          const stepNum = i + 1;
          const isActive = stepNum === step;
          const isCompleted = stepNum < step;
          return (
            <div key={stepNum} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={cn(
                    'h-px w-8',
                    isCompleted || isActive ? 'bg-primary' : 'bg-muted',
                  )}
                />
              )}
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                  isActive && 'border-primary bg-primary text-primary-foreground',
                  isCompleted && 'border-primary bg-primary/10 text-primary',
                  !isActive && !isCompleted && 'border-muted text-muted-foreground',
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <StepIcon className="h-4 w-4" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold">What kind of app is this?</h2>
            <p className="text-muted-foreground mt-1">We&apos;ll set up the right defaults for you</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {APP_TYPES.map((type) => {
              const info = APP_TYPE_INFO[type];
              const defaults = APP_TYPE_DEFAULTS[type];
              return (
                <Card
                  key={type}
                  className={cn(
                    'cursor-pointer transition-all hover:border-primary/50',
                    appType === type && 'border-primary ring-2 ring-primary/20',
                  )}
                  onClick={() => setAppType(type)}
                >
                  <CardContent className="p-4 text-center">
                    <p className="font-semibold">{info.label}</p>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">Port {defaults.port}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold">How much power does it need?</h2>
            <p className="text-muted-foreground mt-1">You can change this later</p>
          </div>
          <div className="grid gap-3">
            {SIZE_TIERS.map((tier) => {
              const info = SIZE_TIER_INFO[tier];
              return (
                <Card
                  key={tier}
                  className={cn(
                    'cursor-pointer transition-all hover:border-primary/50',
                    size === tier && 'border-primary ring-2 ring-primary/20',
                  )}
                  onClick={() => setSize(tier)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold">{info.label} &mdash; {info.description}</p>
                      <p className="text-sm text-muted-foreground">{info.priceHint}</p>
                    </div>
                    <div
                      className={cn(
                        'h-4 w-4 rounded-full border-2',
                        size === tier ? 'border-primary bg-primary' : 'border-muted-foreground',
                      )}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Does it need a database?</h2>
            <p className="text-muted-foreground mt-1">We&apos;ll provision a managed PostgreSQL instance</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Card
              className={cn(
                'cursor-pointer transition-all hover:border-primary/50',
                !database && 'border-primary ring-2 ring-primary/20',
              )}
              onClick={() => setDatabase(false)}
            >
              <CardContent className="p-6 text-center">
                <p className="text-lg font-semibold">No</p>
                <p className="text-sm text-muted-foreground">No database needed</p>
              </CardContent>
            </Card>
            <Card
              className={cn(
                'cursor-pointer transition-all hover:border-primary/50',
                database && 'border-primary ring-2 ring-primary/20',
              )}
              onClick={() => setDatabase(true)}
            >
              <CardContent className="p-6 text-center">
                <p className="text-lg font-semibold">Yes &mdash; PostgreSQL</p>
                <p className="text-sm text-muted-foreground">Managed database</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold">What&apos;s the web address for your app?</h2>
            <p className="text-muted-foreground mt-1">You can always add a custom domain later</p>
          </div>
          <div className="grid gap-3">
            <Card
              className={cn(
                'cursor-pointer transition-all hover:border-primary/50',
                !usesCustomDomain && 'border-primary ring-2 ring-primary/20',
              )}
              onClick={() => setUsesCustomDomain(false)}
            >
              <CardContent className="p-4">
                <p className="font-semibold">Use the free address Liftoff gives me</p>
                <p className="text-sm text-muted-foreground">your-app.ondigitalocean.app</p>
              </CardContent>
            </Card>
            <Card
              className={cn(
                'cursor-pointer transition-all hover:border-primary/50',
                usesCustomDomain && 'border-primary ring-2 ring-primary/20',
              )}
              onClick={() => setUsesCustomDomain(true)}
            >
              <CardContent className="space-y-3 p-4">
                <div>
                  <p className="font-semibold">I have my own domain</p>
                  <p className="text-sm text-muted-foreground">e.g. myapp.com</p>
                </div>
                {usesCustomDomain && (
                  <div>
                    <Label htmlFor="custom-domain">Domain name</Label>
                    <Input
                      id="custom-domain"
                      placeholder="myapp.com"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} disabled={step === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <span className="text-sm text-muted-foreground">
          Step {step} of {TOTAL_STEPS}
        </span>
        <Button onClick={handleNext} disabled={!canAdvance()}>
          {step === TOTAL_STEPS ? 'Continue' : 'Next'}
          {step < TOTAL_STEPS && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
