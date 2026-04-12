import type { EnvironmentDto } from './environment';

export interface ProjectDto {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithEnvironmentsDto extends ProjectDto {
  environments: EnvironmentDto[];
}
