import mongoose, { Document, Schema } from 'mongoose';

export enum SprintStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export interface ISprint extends Document {
  name: string;
  goal?: string;
  project: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  status: SprintStatus;
  tasks: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const sprintSchema = new Schema<ISprint>(
  {
    name: {
      type: String,
      required: [true, 'Sprint name is required'],
      trim: true,
      maxlength: [100, 'Sprint name cannot exceed 100 characters'],
    },
    goal: {
      type: String,
      maxlength: [500, 'Sprint goal cannot exceed 500 characters'],
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    status: {
      type: String,
      enum: Object.values(SprintStatus),
      default: SprintStatus.PLANNED,
    },
    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

sprintSchema.index({ project: 1, status: 1 });

export const Sprint = mongoose.model<ISprint>('Sprint', sprintSchema);
