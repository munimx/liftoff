'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface DOAccount {
  id: string;
  region: string;
  validatedAt: string | null;
  createdAt: string;
}

export interface CreateDOAccountInput {
  doToken: string;
  region: string;
}

export interface DOAccountValidationResult {
  valid: boolean;
  email?: string;
  error?: string;
}

const doAccountsQueryKey = ['do-accounts'] as const;

/**
 * Fetches connected DigitalOcean accounts for the current user.
 */
export function useDoAccounts() {
  return useQuery({
    queryKey: doAccountsQueryKey,
    queryFn: async () => {
      const response = await apiClient.get<DOAccount[]>('/do-accounts');
      return response.data;
    },
  });
}

/**
 * Creates a connected DigitalOcean account.
 */
export function useCreateDoAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateDOAccountInput) => {
      const response = await apiClient.post<DOAccount>('/do-accounts', payload);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: doAccountsQueryKey });
    },
  });
}

/**
 * Re-validates an existing DigitalOcean account token.
 */
export function useValidateDoAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<DOAccountValidationResult>(`/do-accounts/${id}/validate`);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: doAccountsQueryKey });
    },
  });
}

/**
 * Deletes a connected DigitalOcean account.
 */
export function useDeleteDoAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/do-accounts/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: doAccountsQueryKey });
    },
  });
}
