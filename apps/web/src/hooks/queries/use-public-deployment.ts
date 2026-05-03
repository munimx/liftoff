'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { TERMINAL_STATUSES, type DeploymentStatusType } from '@liftoff/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface PublicDeploymentStatus {
  id: string;
  status: DeploymentStatusType;
  endpoint: string | null;
  createdAt: string;
}

/**
 * Fetches deployment status from the public (no-auth) endpoint. Auto-refetches every 3s while active.
 */
export function usePublicDeploymentStatus(deploymentId: string) {
  return useQuery({
    queryKey: ['public-deployment-status', deploymentId],
    enabled: Boolean(deploymentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return 3000;
    },
    queryFn: async () => {
      const response = await axios.get<PublicDeploymentStatus>(
        `${API_BASE_URL}/api/v1/deployments/${deploymentId}/status`,
      );
      return response.data;
    },
  });
}
