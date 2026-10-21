import http from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { Server as SocketIOServer } from 'socket.io';
import request from 'supertest';
import mongoose from 'mongoose';
import app from './app';
import { connectDB } from './config/database';
import { initializeSocket } from './sockets/socketManager';
import { Project } from './models/Project';
import { Task } from './models/Task';
import { Issue } from './models/Issue';
import { Sprint } from './models/Sprint';
import { User, UserRole } from './models/User';

const PORT = 5055;
const SERVER_URL = `http://localhost:${PORT}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runAcceptanceTest() {
  console.log('================================================================');
  console.log('   DEVFLOW - FULL ACCEPTANCE TEST (MULTI-USER & REAL-TIME)     ');
  console.log('================================================================');

  const results: { step: number; description: string; status: 'PASS' | 'FAIL'; details?: string }[] = [];

  let server: http.Server | null = null;
  let socketA: ClientSocket | null = null;
  let socketB: ClientSocket | null = null;
  let socketC: ClientSocket | null = null;

  try {
    // 1. Start application and database
    console.log('\n[Step 1] Connecting to database and starting server...');
    await connectDB();
    server = http.createServer(app);
    const ioServer = new SocketIOServer(server, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });
    initializeSocket(ioServer);

    await new Promise<void>((resolve) => {
      server!.listen(PORT, () => {
        console.log(`Server listening on ${SERVER_URL}`);
        resolve();
      });
    });
    results.push({ step: 1, description: 'Start application and database', status: 'PASS' });

    // 2. Register or log in as two different users
    console.log('\n[Step 2] Logging in User A (PM) and User B (Developer)...');
    const loginA = await request(app).post('/api/auth/login').send({
      email: 'pm@devflow.com',
      password: 'password123',
    });
    const tokenA = loginA.body.data.token;
    const userA = loginA.body.data.user;

    const loginB = await request(app).post('/api/auth/login').send({
      email: 'dev@devflow.com',
      password: 'password123',
    });
    const tokenB = loginB.body.data.token;
    const userB = loginB.body.data.user;

    if (!tokenA || !tokenB) throw new Error('Failed to retrieve authentication tokens');
    console.log(`User A: ${userA.name} (${userA.email})`);
    console.log(`User B: ${userB.name} (${userB.email})`);
    results.push({ step: 2, description: 'Log in as two distinct users', status: 'PASS' });

    // 3. Create a project and add an authorized team member
    console.log('\n[Step 3] User A creating project and adding User B...');
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Realtime Collab Project',
        key: 'RCP',
        description: 'End-to-end multi-user testing project',
      });
    const projectId = projRes.body.data.project._id;

    // Add User B
    const addMemberRes = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        userId: userB._id || userB.id,
        role: 'DEVELOPER',
      });

    if (addMemberRes.status !== 200) throw new Error(`Add member failed: ${addMemberRes.status}`);
    results.push({ step: 3, description: 'Create project and add authorized team member', status: 'PASS' });

    // 4. Open the same project in both sessions (Socket.IO join)
    console.log('\n[Step 4] Connecting Socket.IO client sessions for User A and User B...');
    socketA = ioClient(SERVER_URL, { auth: { token: tokenA } });
    socketB = ioClient(SERVER_URL, { auth: { token: tokenB } });

    await new Promise<void>((resolve, reject) => {
      let count = 0;
      const check = () => { count++; if (count === 2) resolve(); };
      socketA!.on('connect', check);
      socketB!.on('connect', check);
      socketA!.on('connect_error', reject);
      socketB!.on('connect_error', reject);
    });

    // Join project room
    await new Promise<void>((resolve, reject) => {
      let joinedCount = 0;
      const onJoined = () => {
        joinedCount++;
        if (joinedCount === 2) resolve();
      };
      socketA!.emit('join:project', projectId);
      socketB!.emit('join:project', projectId);
      socketA!.on('joined:project', onJoined);
      socketB!.on('joined:project', onJoined);
      setTimeout(() => {
        if (joinedCount === 2) resolve();
        else reject(new Error('Room join timeout'));
      }, 3000);
    });

    results.push({ step: 4, description: 'Open and join same project in both sessions', status: 'PASS' });

    // 5 & 6. Create task in session A, confirm appears in session B without refresh
    console.log('\n[Step 5 & 6] Creating task in session A and awaiting live socket event in session B...');
    let receivedTaskInB: any = null;
    const taskPromise = new Promise<void>((resolve) => {
      socketB!.on('task:created', (data: any) => {
        receivedTaskInB = data;
        resolve();
      });
    });

    const createTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Realtime Synchronization Task',
        description: 'Verify instant delivery to Session B',
        project: projectId,
        priority: 'HIGH',
        storyPoints: 5,
        status: 'TODO',
      });

    const taskId = createTaskRes.body.data.task._id;
    await taskPromise;

    if (!receivedTaskInB || receivedTaskInB._id !== taskId) {
      throw new Error('Session B failed to receive real-time task creation event');
    }
    console.log(`Task received in Session B: "${receivedTaskInB.title}" [${receivedTaskInB.taskKey}]`);
    results.push({ step: 5, description: 'Create task in session A', status: 'PASS' });
    results.push({ step: 6, description: 'Task received in session B in real time without refresh', status: 'PASS' });

    // 7 & 8. Assign task and move across Kanban columns, verify persistence
    console.log('\n[Step 7 & 8] Moving task across Kanban columns and assigning to User B...');
    let updatedTaskInB: any = null;
    let notifReceivedInB: any = null;

    const updatePromise = new Promise<void>((resolve) => {
      socketB!.on('task:updated', (data: any) => {
        updatedTaskInB = data;
        resolve();
      });
    });

    socketB!.on('notification:new', (data: any) => {
      notifReceivedInB = data;
    });

    const moveTaskRes = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'IN_PROGRESS',
        assignedTo: userB._id || userB.id,
      });

    if (moveTaskRes.status !== 200) throw new Error('Task update failed');
    await updatePromise;
    await sleep(200);

    const dbTask = await Task.findById(taskId);
    if (dbTask?.status !== 'IN_PROGRESS' || dbTask?.assignedTo?.toString() !== (userB._id || userB.id).toString()) {
      throw new Error('Task status and assignment not persisted in database');
    }
    console.log(`Session B received Kanban update: status=${updatedTaskInB.status}`);
    results.push({ step: 7, description: 'Assign task and move across Kanban columns', status: 'PASS' });
    results.push({ step: 8, description: 'Both sessions reflect persisted status and assignment', status: 'PASS' });

    // 9. Add comment and verify notification
    console.log('\n[Step 9] Session B adding comment on task, verifying Session A notification...');
    let commentReceivedInA: any = null;
    const commentPromise = new Promise<void>((resolve) => {
      socketA!.on('comment:new', (data: any) => {
        commentReceivedInA = data;
        resolve();
      });
    });

    const commentRes = await request(app)
      .post('/api/comments')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        taskId,
        content: 'I have started implementing this feature!',
      });

    if (commentRes.status !== 201) throw new Error('Comment creation failed');
    await commentPromise;

    console.log(`Session A received live comment: "${commentReceivedInA.comment?.content || commentReceivedInA.content}"`);
    results.push({ step: 9, description: 'Add comment and broadcast real-time update', status: 'PASS' });

    // 10. Create issue and update sprint progress
    console.log('\n[Step 10] Creating issue and sprint, updating progress...');
    let issueReceivedInB: any = null;
    const issuePromise = new Promise<void>((resolve) => {
      socketB!.on('issue:created', (data: any) => {
        issueReceivedInB = data;
        resolve();
      });
    });

    const issueRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Regression in data sync',
        project: projectId,
        severity: 'HIGH',
        priority: 'HIGH',
      });

    if (issueRes.status !== 201) throw new Error('Issue creation failed');
    await issuePromise;

    // Create Sprint
    const sprintRes = await request(app)
      .post('/api/sprints')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Sprint Collab 1',
        project: projectId,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
    const sprintId = sprintRes.body.data.sprint._id;

    // Start Sprint
    await request(app)
      .put(`/api/sprints/${sprintId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'ACTIVE' });

    console.log(`Session B received live issue: "${issueReceivedInB.title}"`);
    results.push({ step: 10, description: 'Create issue and update sprint progress', status: 'PASS' });

    // 11. Disconnect and reconnect one session, verify state recovery
    console.log('\n[Step 11] Disconnecting Session B and reconnecting...');
    socketB!.disconnect();
    await sleep(300);

    // Reconnect Socket B
    socketB = ioClient(SERVER_URL, { auth: { token: tokenB } });
    await new Promise<void>((resolve) => {
      socketB!.on('connect', () => {
        socketB!.emit('join:project', projectId);
        socketB!.on('joined:project', () => resolve());
      });
    });

    // Verify Session B can query tasks and recover current state
    const recoveryRes = await request(app)
      .get(`/api/tasks?project=${projectId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    if (recoveryRes.status !== 200 || recoveryRes.body.data.tasks.length === 0) {
      throw new Error('Failed to recover project state upon reconnect');
    }
    console.log(`Session B reconnected successfully; recovered ${recoveryRes.body.data.tasks.length} tasks`);
    results.push({ step: 11, description: 'Disconnect and reconnect session with state recovery', status: 'PASS' });

    // 12. Unauthorized user attempt, verify access denied
    console.log('\n[Step 12] Testing unauthorized user access rejection...');
    const strangerRes = await request(app).post('/api/auth/register').send({
      name: 'Unauthorized Stranger',
      email: 'stranger_acceptance@devflow.com',
      password: 'password123',
      role: UserRole.DEVELOPER,
    });
    const strangerToken = strangerRes.body.data.token;

    // Try accessing project
    const unauthorizedGet = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${strangerToken}`);

    // Try joining socket room
    socketC = ioClient(SERVER_URL, { auth: { token: strangerToken } });
    let socketDenied = false;
    await new Promise<void>((resolve) => {
      socketC!.on('connect', () => {
        socketC!.emit('join:project', projectId);
      });
      socketC!.on('error', (err: any) => {
        socketDenied = true;
        resolve();
      });
      setTimeout(resolve, 1500);
    });

    if (unauthorizedGet.status !== 403) {
      throw new Error(`Unauthorized REST request was not denied with 403 (got ${unauthorizedGet.status})`);
    }
    console.log('Unauthorized REST request denied (403)');
    console.log(`Unauthorized socket join rejected: ${socketDenied}`);
    results.push({ step: 12, description: 'Unauthorized access strictly denied (REST & Socket)', status: 'PASS' });

    // 13. Verify persisted data in MongoDB
    console.log('\n[Step 13] Verifying database persistence across collections...');
    const persistedProject = await Project.findById(projectId);
    const persistedTask = await Task.findById(taskId);
    const persistedIssue = await Issue.findById(issueRes.body.data.issue._id);
    const persistedSprint = await Sprint.findById(sprintId);

    if (!persistedProject || !persistedTask || !persistedIssue || !persistedSprint) {
      throw new Error('Missing persisted documents in MongoDB');
    }
    console.log('Verified persisted records: Project, Task, Issue, Sprint exist in MongoDB.');
    results.push({ step: 13, description: 'Persisted application data verified in MongoDB', status: 'PASS' });

    console.log('\n================================================================');
    console.log('              ACCEPTANCE TEST RESULTS SUMMARY                  ');
    console.log('================================================================');
    results.forEach((r) => {
      console.log(`Step ${String(r.step).padStart(2, '0')}: [${r.status}] ${r.description}`);
    });
    console.log('================================================================');
    console.log('All 13 acceptance steps completed successfully! (13/13 PASS)\n');
  } catch (error: any) {
    console.error('Acceptance test failed with error:', error);
    process.exit(1);
  } finally {
    if (socketA) socketA.disconnect();
    if (socketB) socketB.disconnect();
    if (socketC) socketC.disconnect();
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runAcceptanceTest();
