import request from 'supertest';
import app from '../app';
import { User, UserRole } from '../models/User';
import { Project, ProjectStatus } from '../models/Project';

describe('Project Endpoints & Membership RBAC', () => {
  let ownerToken: string;
  let memberToken: string;
  let strangerToken: string;
  let ownerUser: any;
  let memberUser: any;
  let strangerUser: any;

  beforeEach(async () => {
    // Create Owner
    const res1 = await request(app).post('/api/auth/register').send({
      name: 'Owner User',
      email: 'owner@example.com',
      password: 'password123',
      role: UserRole.PROJECT_MANAGER,
    });
    ownerToken = res1.body.data.token;
    ownerUser = res1.body.data.user;

    // Create Member
    const res2 = await request(app).post('/api/auth/register').send({
      name: 'Member User',
      email: 'member@example.com',
      password: 'password123',
      role: UserRole.DEVELOPER,
    });
    memberToken = res2.body.data.token;
    memberUser = res2.body.data.user;

    // Create Stranger
    const res3 = await request(app).post('/api/auth/register').send({
      name: 'Stranger User',
      email: 'stranger@example.com',
      password: 'password123',
      role: UserRole.DEVELOPER,
    });
    strangerToken = res3.body.data.token;
    strangerUser = res3.body.data.user;
  });

  it('should create a project and auto-assign owner', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'DevFlow Alpha',
        key: 'DFA',
        description: 'First agile project',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.project.name).toBe('DevFlow Alpha');
    expect(res.body.data.project.key).toBe('DFA');
    expect(res.body.data.project.members).toHaveLength(1);
    expect(res.body.data.project.members[0].role).toBe('OWNER');
  });

  it('should allow members to read the project but forbid non-members', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Secured Project',
        description: 'Restricted access',
      });

    const projectId = createRes.body.data.project._id;

    // Add member to project
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        userId: memberUser.id || memberUser._id,
        role: 'DEVELOPER',
      });

    // Member can access
    const memberGet = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(memberGet.status).toBe(200);
    expect(memberGet.body.success).toBe(true);

    // Stranger cannot access
    const strangerGet = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(strangerGet.status).toBe(403);
  });

  it('should allow owner to remove a member', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Team Project' });

    const projectId = createRes.body.data.project._id;
    const memberId = memberUser.id || memberUser._id;

    // Add member
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: memberId, role: 'DEVELOPER' });

    // Remove member
    const removeRes = await request(app)
      .delete(`/api/projects/${projectId}/members/${memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.success).toBe(true);

    // Verify member is no longer in project
    const proj = await Project.findById(projectId);
    expect(proj?.members.some(m => m.user.toString() === memberId.toString())).toBe(false);
  });
});
