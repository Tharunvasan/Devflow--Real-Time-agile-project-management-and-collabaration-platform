import mongoose from 'mongoose';
import { Task, TaskStatus, TaskPriority } from '../models/Task';
import { Project, ProjectStatus } from '../models/Project';
import { User, UserRole } from '../models/User';

describe('Task Model', () => {
  let userId: mongoose.Types.ObjectId;
  let projectId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: UserRole.DEVELOPER,
    });
    userId = user._id as mongoose.Types.ObjectId;

    const project = await Project.create({
      name: 'Test Project',
      status: ProjectStatus.ACTIVE,
      createdBy: userId,
      members: [{ user: userId, role: 'OWNER' }]
    });
    projectId = project._id as mongoose.Types.ObjectId;
  });

  it('should create a task successfully', async () => {
    const taskData = {
      title: 'New Feature Task',
      description: 'Implement new feature',
      project: projectId,
      createdBy: userId,
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      storyPoints: 5,
      isBlocked: false,
    };

    const task = await Task.create(taskData);
    expect(task.title).toBe(taskData.title);
    expect(task.storyPoints).toBe(5);
    expect(task.isBlocked).toBe(false);
  });
});
