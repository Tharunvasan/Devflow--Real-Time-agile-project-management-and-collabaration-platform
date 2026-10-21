import mongoose, { Document, Schema } from 'mongoose';

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface ISubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface ITask extends Document {
  taskKey?: string;
  order?: number;
  title: string;
  description?: string;
  project: mongoose.Types.ObjectId;
  sprint?: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  storyPoints?: number;
  estimatedHours?: number;
  isBlocked: boolean;
  blockedReason?: string;
  labels: string[];
  subtasks: ISubtask[];
  dependencies: mongoose.Types.ObjectId[];
  attachments: {
    filename: string;
    url: string;
    uploadedBy: mongoose.Types.ObjectId;
    uploadedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required'],
    },
    sprint: {
      type: Schema.Types.ObjectId,
      ref: 'Sprint',
      default: null,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.TODO,
    },
    priority: {
      type: String,
      enum: Object.values(TaskPriority),
      default: TaskPriority.MEDIUM,
    },
    taskKey: { type: String, trim: true, index: true },
    order: { type: Number, default: 0 },
    dueDate: { type: Date },
    storyPoints: { type: Number, min: 0 },
    estimatedHours: { type: Number, min: 0 },
    isBlocked: { type: Boolean, default: false },
    blockedReason: { type: String, maxlength: 500 },
    labels: [{ type: String, trim: true }],
    subtasks: [
      {
        id: { type: String, required: true },
        title: { type: String, required: true },
        completed: { type: Boolean, default: false },
      },
    ],
    dependencies: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
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

taskSchema.index({ project: 1, status: 1, order: 1 });
taskSchema.index({ project: 1, sprint: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ project: 1, priority: 1 });
taskSchema.index({ project: 1, taskKey: 1 });

export const Task = mongoose.model<ITask>('Task', taskSchema);
