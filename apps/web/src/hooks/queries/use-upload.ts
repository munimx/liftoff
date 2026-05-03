'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { WizardConfig } from '@/components/simple/deployment-wizard';

export interface UploadResult {
  deploymentId: string;
  repositoryUrl: string;
  statusUrl: string;
}

/**
 * Uploads a zip file with wizard config to create a project and start deployment.
 */
export function useUploadCode() {
  return useMutation({
    mutationFn: async (params: {
      file: File;
      wizardConfig: WizardConfig;
      projectName: string;
      projectDescription?: string;
      doAccountId: string;
    }) => {
      const formData = new FormData();
      formData.append('file', params.file);
      formData.append('appType', params.wizardConfig.appType);
      formData.append('size', params.wizardConfig.size);
      formData.append('database', String(params.wizardConfig.database));
      formData.append('projectName', params.projectName);
      formData.append('doAccountId', params.doAccountId);
      if (params.wizardConfig.domain) {
        formData.append('domain', params.wizardConfig.domain);
      }
      if (params.projectDescription) {
        formData.append('projectDescription', params.projectDescription);
      }

      const response = await apiClient.post<UploadResult>('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
  });
}

/**
 * Deploys a starter template from the gallery.
 */
export function useDeployTemplate() {
  return useMutation({
    mutationFn: async (params: {
      templateSlug: string;
      projectName: string;
      doAccountId: string;
    }) => {
      const response = await apiClient.post<UploadResult>('/upload/template', params);
      return response.data;
    },
  });
}
