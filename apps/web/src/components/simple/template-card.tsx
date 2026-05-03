'use client';

import type { Template } from '@liftoff/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rocket } from 'lucide-react';

interface TemplateCardProps {
  template: Template;
  onDeploy: (slug: string) => void;
  isDeploying: boolean;
}

/**
 * Template gallery card for the Simple Mode template picker.
 */
export function TemplateCard({ template, onDeploy, isDeploying }: TemplateCardProps): JSX.Element {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{template.name}</CardTitle>
          <Badge variant="secondary" className="text-xs">{template.appType}</Badge>
        </div>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <Button
          className="w-full"
          size="sm"
          disabled={isDeploying}
          onClick={() => onDeploy(template.slug)}
        >
          <Rocket className="mr-2 h-4 w-4" />
          Deploy
        </Button>
      </CardContent>
    </Card>
  );
}
