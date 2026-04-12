export interface RepositoryDto {
  id: string;
  projectId: string;
  githubId: number;
  fullName: string;
  cloneUrl: string;
  branch: string;
  webhookId: number | null;
  webhookStatus: 'active' | 'missing';
  workflowPath: string;
  workflowUrl: string;
  createdAt: string;
  updatedAt: string;
}
