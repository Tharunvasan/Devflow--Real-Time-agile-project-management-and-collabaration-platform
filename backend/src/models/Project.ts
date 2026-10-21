import mongoose, { Document, Schema } from 'mongoose';

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum MemberRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  DEVELOPER = 'DEVELOPER',
  TESTER = 'TESTER',
  VIEWER = 'VIEWER',
}

export interface IProjectMember {
  user: mongoose.Types.ObjectId;
  role: MemberRole;
}

export interface IProject extends Document {
  name: string;
  key?: string;
  description?: string;
  status: ProjectStatus;
  startDate?: Date;
  endDate?: Date;
  createdBy: mongoose.Types.ObjectId;
  members: IProjectMember[];
  githubIntegration?: {
    repository?: string;
    accessToken?: string;
    connectedBy?: mongoose.Types.ObjectId;
    connectedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters'],
      maxlength: [100, 'Project name cannot exceed 100 characters'],
    },
    key: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [10, 'Project key cannot exceed 10 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: Object.values(ProjectStatus),
      default: ProjectStatus.PLANNING,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: {
          type: String,
          enum: Object.values(MemberRole),
          default: MemberRole.DEVELOPER,
        },
      },
    ],
    githubIntegration: {
      repository: { type: String, trim: true },
      accessToken: { type: String },
      connectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      connectedAt: { type: Date },
    },
  },
  { timestamps: true }
);

projectSchema.index({ createdBy: 1 });
projectSchema.index({ 'members.user': 1 });
projectSchema.index({ status: 1 });

export const Project = mongoose.model<IProject>('Project', projectSchema);
