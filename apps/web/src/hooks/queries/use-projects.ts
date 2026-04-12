'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface ProjectListItem {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    environments: number;
  };
}

interface TeamMemberUser {
  id: string;
  email: string;
  githubUsername: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface TeamMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER';
  createdAt: string;
  updatedAt: string;
  user: TeamMemberUser;
}

interface EnvironmentSummary {
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
}

export interface ProjectDetail {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  environments: EnvironmentSummary[];
  teamMembers: TeamMember[];
}

interface ProjectsResponse {
  data: ProjectListItem[];
  total: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface UpdateProjectInput {
  id: string;
  name?: string;
  description?: string;
}

const projectsBaseQueryKey = ['projects'] as const;

/**
 * Fetches paginated projects for the dashboard.
 */
export function useProjects(page = 1, limit = 20) {
  return useQuery({
    queryKey: [...projectsBaseQueryKey, page, limit],
    queryFn: async () => {
      const response = await apiClient.get<ProjectsResponse>('/projects', {
        params: { page, limit },
      });
      return response.data;
    },
  });
}

/**
 * Fetches one project with environments and team members.
 */
export function useProject(projectId: string) {
  return useQuery({
    queryKey: [...projectsBaseQueryKey, projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await apiClient.get<ProjectDetail>(`/projects/${projectId}`);
      return response.data;
    },
  });
}

/**
 * Creates a project.
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateProjectInput) => {
      const response = await apiClient.post<ProjectListItem>('/projects', payload);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsBaseQueryKey });
    },
  });
}

/**
 * Updates a project.
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateProjectInput) => {
      const response = await apiClient.patch<ProjectListItem>(`/projects/${id}`, payload);
      return response.data;
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectsBaseQueryKey }),
        queryClient.invalidateQueries({ queryKey: [...projectsBaseQueryKey, variables.id] }),
      ]);
    },
  });
}

/**
 * Soft-deletes a project.
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/projects/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectsBaseQueryKey });
    },
  });
}
