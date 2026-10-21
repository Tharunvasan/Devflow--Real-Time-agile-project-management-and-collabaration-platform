import mongoose, { Document, Schema } from 'mongoose';

export interface IComment extends Document {
  content: string;
  author: mongoose.Types.ObjectId;
  task?: mongoose.Types.ObjectId;
  issue?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      minlength: [1, 'Comment cannot be empty'],
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    issue: {
      type: Schema.Types.ObjectId,
      ref: 'Issue',
      default: null,
    },
  },
  { timestamps: true }
);

commentSchema.index({ task: 1 });
commentSchema.index({ issue: 1 });

export const Comment = mongoose.model<IComment>('Comment', commentSchema);
