'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface DeploymentSummary {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface PulumiStackSummary {
  id: string;
  stackName: string;
  stateSpacesKey: string;
  outputs: object | null;
  lastUpdated: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentListItem {
  id: string;
  projectId: string;
  doAccountId: string;
  name: string;
  gitBranch: string;
  serviceType: 'APP' | 'KUBERNETES';
  configYaml: string | null;
  configParsed: object | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  _count: {
    deployments: number;
  };
}

export interface EnvironmentDetail {
  id: string;
  projectId: string;
  doAccountId: string;
  name: string;
  gitBranch: string;
  serviceType: 'APP' | 'KUBERNETES';
  configYaml: string | null;
  configParsed: object | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  pulumiStack: PulumiStackSummary | null;
  deployments: DeploymentSummary[];
}

export interface ConfigValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors?: ConfigValidationIssue[];
}

export interface CreateEnvironmentInput {
  name: string;
  gitBranch: string;
  doAccountId: string;
  serviceType?: 'APP';
}

export interface UpdateEnvironmentInput {
  id: string;
  name?: string;
  gitBranch?: string;
  doAccountId?: string;
  serviceType?: 'APP';
}

export interface UpdateConfigInput {
  id: string;
  configYaml: string;
}

const environmentBaseKey = ['environments'] as const;

/**
 * Fetches environments for a project.
 */
export function useEnvironments(projectId: string) {
  return useQuery({
    queryKey: [...environmentBaseKey, projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await apiClient.get<EnvironmentListItem[]>(
        `/projects/${projectId}/environments`,
      );
      return response.data;
    },
  });
}

/**
 * Fetches one environment detail.
 */
export function useEnvironment(projectId: string, environmentId: string) {
  return useQuery({
    queryKey: [...environmentBaseKey, projectId, environmentId],
    enabled: Boolean(projectId && environmentId),
    queryFn: async () => {
      const response = await apiClient.get<EnvironmentDetail>(
        `/projects/${projectId}/environments/${environmentId}`,
      );
      return response.data;
    },
  });
}

/**
 * Creates an environment.
 */
export function useCreateEnvironment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateEnvironmentInput) => {
      const response = await apiClient.post<EnvironmentListItem>(
        `/projects/${projectId}/environments`,
        payload,
      );
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...environmentBaseKey, projectId] });
    },
  });
}

/**
 * Updates an environment.
 */
export function useUpdateEnvironment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateEnvironmentInput) => {
      const response = await apiClient.patch<EnvironmentListItem>(
        `/projects/${projectId}/environments/${id}`,
        payload,
      );
      return response.data;
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...environmentBaseKey, projectId] }),
        queryClient.invalidateQueries({
          queryKey: [...environmentBaseKey, projectId, variables.id],
        }),
      ]);
    },
  });
}

/**
 * Soft-deletes an environment.
 */
export function useDeleteEnvironment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (environmentId: string) => {
      await apiClient.delete(`/projects/${projectId}/environments/${environmentId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...environmentBaseKey, projectId] });
    },
  });
}

/**
 * Updates and stores environment liftoff.yml content.
 */
export function useUpdateConfig(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, configYaml }: UpdateConfigInput) => {
      const response = await apiClient.put<EnvironmentDetail>(
        `/projects/${projectId}/environments/${id}/config`,
        { configYaml },
      );
      return response.data;
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...environmentBaseKey, projectId, variables.id],
        }),
        queryClient.invalidateQueries({ queryKey: [...environmentBaseKey, projectId] }),
      ]);
    },
  });
}

/**
 * Validates environment config without persisting changes.
 */
export function useValidateConfig(projectId: string) {
  return useMutation({
    mutationFn: async ({ id, configYaml }: UpdateConfigInput) => {
      const response = await apiClient.post<ConfigValidationResult>(
        `/projects/${projectId}/environments/${id}/config/validate`,
        { configYaml },
      );
      return response.data;
    },
  });
}
