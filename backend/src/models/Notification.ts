import mongoose, { Document, Schema } from 'mongoose';

export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  ISSUE_CREATED = 'ISSUE_CREATED',
  ISSUE_ASSIGNED = 'ISSUE_ASSIGNED',
  ISSUE_RESOLVED = 'ISSUE_RESOLVED',
  SPRINT_STARTED = 'SPRINT_STARTED',
  SPRINT_COMPLETED = 'SPRINT_COMPLETED',
  MEMBER_ADDED = 'MEMBER_ADDED',
  COMMENT_ADDED = 'COMMENT_ADDED',
}

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  type: NotificationType;
  message: string;
  read: boolean;
  relatedProject?: mongoose.Types.ObjectId;
  relatedTask?: mongoose.Types.ObjectId;
  relatedIssue?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    read: {
      type: Boolean,
      default: false,
    },
    relatedProject: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    relatedTask: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    relatedIssue: {
      type: Schema.Types.ObjectId,
      ref: 'Issue',
      default: null,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
