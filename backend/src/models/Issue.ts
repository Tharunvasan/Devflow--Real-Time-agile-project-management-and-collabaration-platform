import mongoose, { Document, Schema } from 'mongoose';

export enum IssueSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum IssuePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum IssueStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  FIXED = 'FIXED',
  VERIFIED = 'VERIFIED',
  CLOSED = 'CLOSED',
}

export interface IIssue extends Document {
  issueKey?: string;
  title: string;
  description?: string;
  reproductionSteps?: string;
  expectedBehavior?: string;
  resolution?: string;
  relatedTask?: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  reportedBy: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  severity: IssueSeverity;
  priority: IssuePriority;
  status: IssueStatus;
  attachments: {
    filename: string;
    url: string;
    uploadedBy: mongoose.Types.ObjectId;
    uploadedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const issueSchema = new Schema<IIssue>(
  {
    issueKey: { type: String, trim: true, index: true },
    title: {
      type: String,
      required: [true, 'Issue title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    reproductionSteps: {
      type: String,
      maxlength: [2000, 'Reproduction steps cannot exceed 2000 characters'],
    },
    expectedBehavior: {
      type: String,
      maxlength: [1000, 'Expected behavior cannot exceed 1000 characters'],
    },
    resolution: {
      type: String,
      maxlength: [1000, 'Resolution cannot exceed 1000 characters'],
    },
    relatedTask: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required'],
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    severity: {
      type: String,
      enum: Object.values(IssueSeverity),
      default: IssueSeverity.MEDIUM,
    },
    priority: {
      type: String,
      enum: Object.values(IssuePriority),
      default: IssuePriority.MEDIUM,
    },
    status: {
      type: String,
      enum: Object.values(IssueStatus),
      default: IssueStatus.OPEN,
    },
    attachments: [
      {
        filename: { type: String, required: true },
        url: { type: String, required: true },
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

issueSchema.index({ project: 1, status: 1 });
issueSchema.index({ project: 1, severity: 1 });
issueSchema.index({ assignedTo: 1 });
issueSchema.index({ project: 1, issueKey: 1 });

export const Issue = mongoose.model<IIssue>('Issue', issueSchema);
