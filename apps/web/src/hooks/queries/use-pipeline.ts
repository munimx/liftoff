'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PipelineGraphDto,
  PipelineValidationError,
  CompilePipelineResult,
  PipelineNode,
  PipelineEdge,
} from '@liftoff/shared';
import { apiClient } from '@/lib/api-client';

const pipelineBaseKey = ['pipeline'] as const;

/**
 * Fetches the pipeline graph for an environment.
 */
export function usePipelineGraph(environmentId: string) {
  return useQuery({
    queryKey: [...pipelineBaseKey, environmentId],
    enabled: Boolean(environmentId),
    queryFn: async () => {
      const response = await apiClient.get<PipelineGraphDto>(
        `/environments/${environmentId}/pipeline`,
      );
      return response.data;
    },
  });
}

/**
 * Saves pipeline graph (auto-validates on save).
 */
export function useSavePipeline(environmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { nodes: PipelineNode[]; edges: PipelineEdge[] }) => {
      const response = await apiClient.put<PipelineGraphDto>(
        `/environments/${environmentId}/pipeline`,
        payload,
      );
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [...pipelineBaseKey, environmentId],
      });
    },
  });
}

/**
 * Validates pipeline graph without saving.
 */
export function useValidatePipeline(environmentId: string) {
  return useMutation({
    mutationFn: async (payload: { nodes: PipelineNode[]; edges: PipelineEdge[] }) => {
      const response = await apiClient.post<{
        isValid: boolean;
        validationErrors: PipelineValidationError[];
      }>(`/environments/${environmentId}/pipeline/validate`, payload);
      return response.data;
    },
  });
}

/**
 * Compiles pipeline graph and returns YAML preview.
 */
export function useCompilePipeline(environmentId: string) {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<CompilePipelineResult>(
        `/environments/${environmentId}/pipeline/compile`,
      );
      return response.data;
    },
  });
}

/**
 * Deploys the pipeline graph (compiles + writes config + triggers deploy).
 */
export function useDeployPipeline(environmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<CompilePipelineResult>(
        `/environments/${environmentId}/pipeline/deploy`,
      );
      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...pipelineBaseKey, environmentId],
        }),
        queryClient.invalidateQueries({ queryKey: ['environments'] }),
      ]);
    },
  });
}
