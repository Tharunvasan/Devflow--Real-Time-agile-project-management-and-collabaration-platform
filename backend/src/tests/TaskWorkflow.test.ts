import request from 'supertest';
import app from '../app';
import { User, UserRole } from '../models/User';

describe('Task Workflow, Kanban & Persistence', () => {
  let token: string;
  let strangerToken: string;
  let projectId: string;

  beforeEach(async () => {
    // Register owner
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Task Manager',
      email: 'tm@example.com',
      password: 'password123',
      role: UserRole.PROJECT_MANAGER,
    });
    token = regRes.body.data.token;

    // Register stranger
    const strRes = await request(app).post('/api/auth/register').send({
      name: 'Stranger',
      email: 'stranger2@example.com',
      password: 'password123',
      role: UserRole.DEVELOPER,
    });
    strangerToken = strRes.body.data.token;

    // Create project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Workflow Project',
        key: 'WFP',
      });
    projectId = projRes.body.data.project._id;
  });

  it('should create a task with auto-generated taskKey', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Build Authentication Module',
        description: 'Implement JWT login and registration',
        project: projectId,
        priority: 'HIGH',
        storyPoints: 5,
        status: 'TODO',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.task.title).toBe('Build Authentication Module');
    expect(res.body.data.task.storyPoints).toBe(5);
    expect(res.body.data.task.priority).toBe('HIGH');
    expect(res.body.data.task.status).toBe('TODO');
    expect(res.body.data.task.taskKey).toMatch(/WFP-\d+/);
  });

  it('should update task status across Kanban columns', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Kanban Movement Task',
        project: projectId,
        status: 'TODO',
      });

    const taskId = createRes.body.data.task._id;

    // Move to IN_PROGRESS
    const updateRes1 = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'IN_PROGRESS' });

    expect(updateRes1.status).toBe(200);
    expect(updateRes1.body.data.task.status).toBe('IN_PROGRESS');

    // Move to DONE
    const updateRes2 = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DONE' });

    expect(updateRes2.status).toBe(200);
    expect(updateRes2.body.data.task.status).toBe('DONE');
  });

  it('should support subtasks management', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Task with subtasks',
        project: projectId,
        subtasks: [
          { title: 'Subtask 1', completed: false },
          { title: 'Subtask 2', completed: true },
        ],
      });

    const taskId = createRes.body.data.task._id;
    expect(createRes.body.data.task.subtasks).toHaveLength(2);

    // Update subtask
    const updateRes = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        subtasks: [
          { title: 'Subtask 1', completed: true },
          { title: 'Subtask 2', completed: true },
          { title: 'Subtask 3', completed: false },
        ],
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.task.subtasks).toHaveLength(3);
    expect(updateRes.body.data.task.subtasks[0].completed).toBe(true);
  });

  it('should forbid unauthorized user from viewing or modifying project tasks', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Secret Task',
        project: projectId,
      });

    const taskId = createRes.body.data.task._id;

    // Stranger tries to get task
    const getRes = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(getRes.status).toBe(403);

    // Stranger tries to update task
    const putRes = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({ title: 'Hacked Title' });
    expect(putRes.status).toBe(403);
  });

  it('should delete a task and return 404 afterwards', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Task to be deleted',
        project: projectId,
      });

    const taskId = createRes.body.data.task._id;

    const delRes = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });
});
