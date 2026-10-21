import request from 'supertest';
import app from '../app';
import { User, UserRole } from '../models/User';
import { Notification } from '../models/Notification';
import { recordActivity } from '../services/activityService';

describe('Activity History & Notifications', () => {
  let token: string;
  let user: any;
  let projectId: string;

  beforeEach(async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Notifier User',
      email: 'notifier@example.com',
      password: 'password123',
      role: UserRole.PROJECT_MANAGER,
    });
    token = regRes.body.data.token;
    user = regRes.body.data.user;

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Activity Project', key: 'ACT' });
    projectId = projRes.body.data.project._id;
  });

  it('should record and query project activities', async () => {
    // Record an activity via service
    await recordActivity({
      project: projectId,
      actor: user.id || user._id,
      action: 'TASK_CREATED',
      resourceType: 'TASK',
      details: 'Created task Feature A',
    });

    const res = await request(app)
      .get(`/api/activities/project/${projectId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activities.length).toBeGreaterThan(0);
    expect(res.body.data.activities[0].action).toBe('TASK_CREATED');
  });

  it('should handle notifications and read statuses', async () => {
    const userId = user.id || user._id;

    // Create notifications directly
    const notif1 = await Notification.create({
      recipient: userId,
      sender: userId,
      title: 'Task Assigned',
      message: 'You have been assigned to Task 1',
      type: 'TASK_ASSIGNED',
      read: false,
    });

    const notif2 = await Notification.create({
      recipient: userId,
      sender: userId,
      title: 'Comment Added',
      message: 'New comment on your task',
      type: 'COMMENT_ADDED',
      read: false,
    });

    // Get notifications
    const getRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.notifications).toHaveLength(2);
    expect(getRes.body.data.unread).toBe(2);

    // Mark single notification as read
    const readOneRes = await request(app)
      .patch(`/api/notifications/${notif1._id}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(readOneRes.status).toBe(200);

    // Mark all as read
    const markAllRes = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);

    expect(markAllRes.status).toBe(200);

    // Check count is now 0
    const finalGet = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(finalGet.body.data.unread).toBe(0);
  });
});
