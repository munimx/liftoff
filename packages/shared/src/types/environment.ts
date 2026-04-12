export interface EnvironmentDto {
  id: string;
  projectId: string;
  doAccountId: string;
  name: string;
  gitBranch: string;
  serviceType: 'APP' | 'KUBERNETES';
  createdAt: string;
  updatedAt: string;
}
