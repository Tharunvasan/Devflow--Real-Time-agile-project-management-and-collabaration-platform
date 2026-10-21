import mongoose from 'mongoose';
import { User, UserRole } from './models/User';
import { Project, MemberRole, ProjectStatus } from './models/Project';
import { Task, TaskPriority, TaskStatus } from './models/Task';
import { Sprint, SprintStatus } from './models/Sprint';
import { Issue, IssueSeverity } from './models/Issue';
import { connectDB } from './config/database';
import dotenv from 'dotenv';

dotenv.config();

const seedDB = async () => {
  try {
    await connectDB();
    console.log('Clearing old data...');
    await User.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});
    await Sprint.deleteMany({});
    await Issue.deleteMany({});

    console.log('Creating users...');
    const users = await Promise.all([
      User.create({ name: 'Admin', email: 'admin@devflow.com', password: 'password123', role: UserRole.ADMIN }),
      User.create({ name: 'PM Alice', email: 'pm@devflow.com', password: 'password123', role: UserRole.PROJECT_MANAGER }),
      User.create({ name: 'Dev Bob', email: 'dev@devflow.com', password: 'password123', role: UserRole.DEVELOPER }),
      User.create({ name: 'Tester Charlie', email: 'tester@devflow.com', password: 'password123', role: UserRole.TESTER }),
    ]);

    const admin = users[0];
    const pm = users[1];
    const dev = users[2];
    const tester = users[3];

    console.log('Creating project...');
    const project = await Project.create({
      name: 'E-Commerce Redesign',
      key: 'ECOMM',
      description: 'Modernizing the legacy e-commerce platform.',
      status: ProjectStatus.ACTIVE,
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
      createdBy: admin._id,
      members: [
        { user: admin._id, role: MemberRole.OWNER },
        { user: pm._id, role: MemberRole.MANAGER },
        { user: dev._id, role: MemberRole.DEVELOPER },
        { user: tester._id, role: MemberRole.TESTER },
      ]
    });

    console.log('Creating sprint...');
    const sprint = await Sprint.create({
      name: 'Sprint 1 - Foundation',
      goal: 'Setup database and auth',
      project: project._id,
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 14)),
      status: SprintStatus.ACTIVE,
      createdBy: pm._id,
    });

    console.log('Creating tasks...');
    const task1 = await Task.create({
      taskKey: 'ECOMM-1',
      title: 'Design Database Schema',
      description: 'Create ERD and Mongoose models',
      project: project._id,
      sprint: sprint._id,
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      assignedTo: dev._id,
      createdBy: pm._id,
      estimatedHours: 8,
      actualHours: 7,
      storyPoints: 5,
    });

    const task2 = await Task.create({
      taskKey: 'ECOMM-2',
      title: 'Implement JWT Auth',
      description: 'Add login and register endpoints',
      project: project._id,
      sprint: sprint._id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assignedTo: dev._id,
      createdBy: pm._id,
      estimatedHours: 12,
      storyPoints: 8,
    });

    const task3 = await Task.create({
      taskKey: 'ECOMM-3',
      title: 'Setup CI/CD',
      description: 'GitHub actions for deployment',
      project: project._id,
      sprint: sprint._id,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      createdBy: pm._id,
      storyPoints: 3,
    });

    sprint.tasks.push(task1._id, task2._id, task3._id);
    await sprint.save();

    console.log('Creating issues...');
    await Issue.create({
      issueKey: 'ECOMM-ISSUE-1',
      title: 'Auth token expires too quickly',
      description: 'Users are logged out after 1 hour',
      project: project._id,
      severity: IssueSeverity.MEDIUM,
      priority: TaskPriority.HIGH,
      reportedBy: tester._id,
      assignedTo: dev._id,
      reproductionSteps: '1. Log in\n2. Wait 1 hour\n3. Attempt to fetch tasks',
      expectedBehavior: 'Token should refresh or stay valid for configured duration',
    });

    console.log('Seeding complete!');
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedDB();
