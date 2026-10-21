import mongoose, { Document, Schema } from 'mongoose';

export enum ActivityAction {
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED',
  TASK_DELETED = 'TASK_DELETED',
  ISSUE_CREATED = 'ISSUE_CREATED',
  ISSUE_UPDATED = 'ISSUE_UPDATED',
  ISSUE_RESOLVED = 'ISSUE_RESOLVED',
  SPRINT_STARTED = 'SPRINT_STARTED',
  SPRINT_COMPLETED = 'SPRINT_COMPLETED',
  MEMBER_ADDED = 'MEMBER_ADDED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  COMMENT_ADDED = 'COMMENT_ADDED',
}

export type ResourceType = 'TASK' | 'ISSUE' | 'SPRINT' | 'PROJECT' | 'COMMENT';

export interface IActivity extends Document {
  project: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId;
  action: ActivityAction | string;
  details: string;
  resourceType: ResourceType;
  resourceId?: mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required'],
      index: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor reference is required'],
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
    },
    details: {
      type: String,
      required: [true, 'Activity details are required'],
      maxlength: [500, 'Details cannot exceed 500 characters'],
    },
    resourceType: {
      type: String,
      enum: ['TASK', 'ISSUE', 'SPRINT', 'PROJECT', 'COMMENT'],
      required: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

activitySchema.index({ project: 1, createdAt: -1 });
activitySchema.index({ resourceId: 1, createdAt: -1 });

export const Activity = mongoose.model<IActivity>('Activity', activitySchema);
