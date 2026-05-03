'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { Upload, FileArchive, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDoAccounts } from '@/hooks/queries/use-do-accounts';
import { useUploadCode } from '@/hooks/queries/use-upload';
import { cn } from '@/lib/utils';
import type { WizardConfig } from './deployment-wizard';

interface CodeUploadDropzoneProps {
  wizardConfig: WizardConfig;
}

/**
 * Drag-and-drop zip upload component for Simple Mode.
 */
export function CodeUploadDropzone({ wizardConfig }: CodeUploadDropzoneProps): JSX.Element {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { data: doAccounts, isLoading: accountsLoading } = useDoAccounts();
  const uploadMutation = useUploadCode();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      if (!projectName) {
        const name = file.name.replace(/\.zip$/i, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
        setProjectName(name);
      }
    }
  }, [projectName]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/zip': ['.zip'] },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
  });

  const doAccountId = doAccounts?.[0]?.id;

  const handleDeploy = async (): Promise<void> => {
    if (!selectedFile || !projectName.trim() || !doAccountId) return;

    const result = await uploadMutation.mutateAsync({
      file: selectedFile,
      wizardConfig,
      projectName: projectName.trim(),
      doAccountId,
    });

    router.push(`/deploy/${result.deploymentId}/status`);
  };

  const canDeploy = selectedFile && projectName.trim() && doAccountId && !uploadMutation.isPending;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="project-name">Project name</Label>
        <Input
          id="project-name"
          placeholder="my-awesome-app"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="mt-1"
        />
      </div>

      <Card
        {...getRootProps()}
        className={cn(
          'cursor-pointer border-2 border-dashed transition-colors',
          isDragActive && 'border-primary bg-primary/5',
          selectedFile && 'border-green-500 bg-green-50 dark:bg-green-950/20',
        )}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <input {...getInputProps()} />
          {selectedFile ? (
            <>
              <FileArchive className="h-10 w-10 text-green-600 mb-3" />
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
              <p className="text-xs text-muted-foreground mt-2">Drop a different file to replace</p>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium">
                {isDragActive ? 'Drop your zip file here' : 'Drag & drop your .zip file here'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse (max 50MB)</p>
            </>
          )}
        </CardContent>
      </Card>

      {!accountsLoading && !doAccountId && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No DigitalOcean account connected.{' '}
            <a href="/settings" className="underline">Connect one in Settings</a> first.
          </AlertDescription>
        </Alert>
      )}

      {uploadMutation.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {uploadMutation.error instanceof Error
              ? uploadMutation.error.message
              : 'Upload failed. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      <Button
        className="w-full"
        size="lg"
        disabled={!canDeploy}
        onClick={handleDeploy}
      >
        {uploadMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Deploying...
          </>
        ) : (
          'Deploy'
        )}
      </Button>
    </div>
  );
}
