import { Request, Response, NextFunction } from 'express';
import { Notification } from '../models/Notification';
import { AppError } from '../middleware/errorHandler';

export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [notifications, total, unread] = await Promise.all([
      Notification.find({ recipient: req.user!.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Notification.countDocuments({ recipient: req.user!.id }),
      Notification.countDocuments({ recipient: req.user!.id, read: false }),
    ]);

    res.status(200).json({ success: true, data: { notifications, total, unread } });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) throw new AppError('Notification not found', 404);
    if (notif.recipient.toString() !== req.user!.id) {
      throw new AppError('Access denied', 403);
    }
    notif.read = true;
    await notif.save();
    res.status(200).json({ success: true, message: 'Marked as read', data: { notification: notif } });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await Notification.updateMany({ recipient: req.user!.id, read: false }, { read: true });
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};
