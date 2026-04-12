export interface UserPublicDto {
  id: string;
  email: string;
  githubUsername: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}
