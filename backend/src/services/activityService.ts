import { Activity, ActivityAction, ResourceType, IActivity } from '../models/Activity';
import { Notification, NotificationType, INotification } from '../models/Notification';
import { getIO } from '../sockets/socketManager';
import { logger } from '../utils/logger';

export interface RecordActivityOptions {
  project: string;
  actor: string;
  action: ActivityAction | string;
  details: string;
  resourceType: ResourceType;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export interface CreateNotificationOptions {
  recipient: string;
  type: NotificationType;
  message: string;
  relatedProject?: string;
  relatedTask?: string;
  relatedIssue?: string;
}

export class ActivityService {
  /**
   * Record an activity in the database and broadcast to the project room in real time.
   */
  static async recordActivity(options: RecordActivityOptions): Promise<IActivity | null> {
    try {
      const activity = await Activity.create({
        project: options.project,
        actor: options.actor,
        action: options.action,
        details: options.details,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        metadata: options.metadata || {},
      });

      const populated = await activity.populate('actor', 'name email avatar');

      const io = getIO();
      if (io) {
        io.to(`project:${options.project}`).emit('activity:new', populated);
      }

      return populated;
    } catch (error) {
      logger.error('Failed to record activity:', error);
      return null;
    }
  }

  /**
   * Create a persistent notification and broadcast to the recipient's private room.
   */
  static async createNotification(options: CreateNotificationOptions): Promise<INotification | null> {
    try {
      const notification = await Notification.create({
        recipient: options.recipient,
        type: options.type,
        message: options.message,
        relatedProject: options.relatedProject,
        relatedTask: options.relatedTask,
        relatedIssue: options.relatedIssue,
      });

      const io = getIO();
      if (io) {
        io.to(`user:${options.recipient}`).emit('notification:new', notification);
      }

      return notification;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      return null;
    }
  }
}

export const recordActivity = ActivityService.recordActivity.bind(ActivityService);
export const createNotification = ActivityService.createNotification.bind(ActivityService);
