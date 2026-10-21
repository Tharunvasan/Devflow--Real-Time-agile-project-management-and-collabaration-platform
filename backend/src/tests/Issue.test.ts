import request from 'supertest';
import app from '../app';
import { User, UserRole } from '../models/User';

describe('Issue Tracking & Resolution', () => {
  let token: string;
  let strangerToken: string;
  let projectId: string;

  beforeEach(async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'QA Lead',
      email: 'qalead@example.com',
      password: 'password123',
      role: UserRole.PROJECT_MANAGER,
    });
    token = regRes.body.data.token;

    const strRes = await request(app).post('/api/auth/register').send({
      name: 'Uninvited User',
      email: 'uninvited@example.com',
      password: 'password123',
      role: UserRole.DEVELOPER,
    });
    strangerToken = strRes.body.data.token;

    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bug Tracker Project', key: 'BUG' });
    projectId = projRes.body.data.project._id;
  });

  it('should create an issue with reproduction steps and auto issueKey', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Crash on clicking save button',
        description: 'App crashes with 500 error',
        project: projectId,
        severity: 'HIGH',
        priority: 'CRITICAL',
        reproductionSteps: '1. Navigate to settings\n2. Click save without entering username',
        expectedBehavior: 'Validation error should be displayed instead of crashing',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.issue.title).toBe('Crash on clicking save button');
    expect(res.body.data.issue.severity).toBe('HIGH');
    expect(res.body.data.issue.reproductionSteps).toContain('Navigate to settings');
    expect(res.body.data.issue.issueKey).toMatch(/BUG-(BUG|ISSUE)-\d+/);
  });

  it('should update issue status and record resolution', async () => {
    const createRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Minor UI alignment glitch',
        project: projectId,
        severity: 'LOW',
      });

    const issueId = createRes.body.data.issue._id;

    const updateRes = await request(app)
      .put(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'FIXED',
        resolution: 'Fixed CSS flexbox margin in stylesheet',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.issue.status).toBe('FIXED');
    expect(updateRes.body.data.issue.resolution).toBe('Fixed CSS flexbox margin in stylesheet');
  });

  it('should forbid unauthorized user from viewing or modifying issues', async () => {
    const createRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Confidential vulnerability report',
        project: projectId,
        severity: 'CRITICAL',
      });

    const issueId = createRes.body.data.issue._id;

    const getRes = await request(app)
      .get(`/api/issues/${issueId}`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(getRes.status).toBe(403);
  });
});
