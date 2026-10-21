import request from 'supertest';
import app from '../app';
import { User, UserRole } from '../models/User';
import { Task } from '../models/Task';

describe('Agile Sprint Management & Metrics', () => {
  let token: string;
  let projectId: string;

  beforeEach(async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Sprint Lead',
      email: 'lead@example.com',
      password: 'password123',
      role: UserRole.PROJECT_MANAGER,
    });
    token = regRes.body.data.token;

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Agile Project', key: 'AGL' });
    projectId = projRes.body.data.project._id;
  });

  it('should create a sprint, start it, and calculate burndown metrics', async () => {
    // 1. Create 2 tasks
    const t1 = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Task 1', project: projectId, storyPoints: 5, status: 'TODO' });

    const t2 = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Task 2', project: projectId, storyPoints: 8, status: 'DONE' });

    const task1Id = t1.body.data.task._id;
    const task2Id = t2.body.data.task._id;

    await request(app)
      .put(`/api/tasks/${task2Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DONE' });

    // 2. Create sprint
    const startDate = new Date();
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days later

    const sprintRes = await request(app)
      .post('/api/sprints')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Sprint 1',
        project: projectId,
        goal: 'Complete MVP modules',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

    expect(sprintRes.status).toBe(201);
    expect(sprintRes.body.success).toBe(true);
    const sprintId = sprintRes.body.data.sprint._id;
    expect(sprintRes.body.data.sprint.status).toBe('PLANNED');

    // Add tasks to sprint
    await request(app)
      .post(`/api/sprints/${sprintId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ taskId: task1Id });

    await request(app)
      .post(`/api/sprints/${sprintId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ taskId: task2Id });

    // 3. Start sprint
    const startRes = await request(app)
      .put(`/api/sprints/${sprintId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' });

    expect(startRes.status).toBe(200);
    expect(startRes.body.data.sprint.status).toBe('ACTIVE');

    // 4. Check burndown and metrics
    const detailRes = await request(app)
      .get(`/api/sprints/${sprintId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.success).toBe(true);
    expect(detailRes.body.data.stats.totalStoryPoints).toBe(13); // 5 + 8
    expect(detailRes.body.data.burndown.length).toBeGreaterThan(0);
    expect(detailRes.body.data.burndown[0]).toHaveProperty('ideal');
    expect(detailRes.body.data.burndown[0]).toHaveProperty('actual');
  });

  it('should complete sprint, eject incomplete tasks, and update team velocity', async () => {
    // Create 1 incomplete task and 1 complete task
    const t1 = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Incomplete Task', project: projectId, storyPoints: 5, status: 'IN_PROGRESS' });

    const t2 = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Completed Task', project: projectId, storyPoints: 8, status: 'DONE' });

    const task1Id = t1.body.data.task._id;
    const task2Id = t2.body.data.task._id;

    await request(app)
      .put(`/api/tasks/${task2Id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DONE' });

    // Create sprint
    const sprintRes = await request(app)
      .post('/api/sprints')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Sprint Alpha',
        project: projectId,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      });

    const sprintId = sprintRes.body.data.sprint._id;

    // Add tasks
    await request(app)
      .post(`/api/sprints/${sprintId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ taskId: task1Id });

    await request(app)
      .post(`/api/sprints/${sprintId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ taskId: task2Id });

    // Start sprint
    await request(app)
      .put(`/api/sprints/${sprintId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' });

    // Complete sprint
    const completeRes = await request(app)
      .put(`/api/sprints/${sprintId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'COMPLETED' });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.sprint.status).toBe('COMPLETED');

    // Verify task1 (incomplete) had sprint reference removed (ejected to backlog)
    const task1 = await Task.findById(task1Id);
    expect(task1?.sprint == null).toBe(true);

    // Verify task2 (completed) retained sprint reference
    const task2 = await Task.findById(task2Id);
    expect(task2?.sprint?.toString()).toBe(sprintId.toString());

    // Check project velocity
    const velocityRes = await request(app)
      .get(`/api/sprints/project/${projectId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(velocityRes.status).toBe(200);
    expect(velocityRes.body.success).toBe(true);
    expect(velocityRes.body.data.metrics.velocityHistory).toHaveLength(1);
    expect(velocityRes.body.data.metrics.velocityHistory[0].completedPoints).toBe(8);
  });
});
