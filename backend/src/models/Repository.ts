import mongoose, { Document, Schema } from 'mongoose';

export enum RepositorySource {
  LOCAL = 'LOCAL',
  GITHUB = 'GITHUB',
}

export interface IRepository extends Document {
  name: string;
  project: mongoose.Types.ObjectId;
  source: RepositorySource;
  url?: string; // GitHub repository URL (e.g., https://github.com/user/repo)
  path?: string; // Absolute path on the backend server for LOCAL repos
  defaultBranch: string;
  githubRepoId?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const repositorySchema = new Schema<IRepository>(
  {
    name: { type: String, required: true, trim: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    source: { type: String, enum: Object.values(RepositorySource), required: true },
    url: { type: String, trim: true },
    path: { type: String, trim: true },
    defaultBranch: { type: String, default: 'main' },
    githubRepoId: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

repositorySchema.index({ project: 1 });
repositorySchema.index({ name: 1, project: 1 }, { unique: true });

export const Repository = mongoose.model<IRepository>('Repository', repositorySchema);
