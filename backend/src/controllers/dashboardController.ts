import { Request, Response, NextFunction } from 'express';
import { Task, TaskStatus } from '../models/Task';
import { Issue, IssueStatus } from '../models/Issue';
import { Project, ProjectStatus } from '../models/Project';
import { Sprint, SprintStatus } from '../models/Sprint';
import { Comment } from '../models/Comment';
import { Activity } from '../models/Activity';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get user's projects
    const userProjects = await Project.find({
      $or: [{ createdBy: userId }, { 'members.user': userId }],
    }).select('_id');
    const projectIds = userProjects.map((p) => p._id);

    const [
      totalProjects,
      activeProjects,
      totalTasks,
      completedTasks,
      openIssues,
      tasksByStatus,
      tasksByPriority,
      issuesBySeverity,
      activeSprint,
      blockedTasks,
      overdueTasks,
      workloadByAssignee,
    ] = await Promise.all([
      Project.countDocuments({ _id: { $in: projectIds } }),
      Project.countDocuments({ _id: { $in: projectIds }, status: ProjectStatus.ACTIVE }),
      Task.countDocuments({ project: { $in: projectIds } }),
      Task.countDocuments({ project: { $in: projectIds }, status: TaskStatus.DONE }),
      Issue.countDocuments({ project: { $in: projectIds }, status: IssueStatus.OPEN }),
      Task.aggregate([
        { $match: { project: { $in: projectIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Task.aggregate([
        { $match: { project: { $in: projectIds } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Issue.aggregate([
        { $match: { project: { $in: projectIds } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      Sprint.findOne({ project: { $in: projectIds }, status: SprintStatus.ACTIVE })
        .populate('project', 'name')
        .populate({
          path: 'tasks',
          select: 'title status priority taskKey storyPoints assignedTo',
        }),
      Task.countDocuments({ project: { $in: projectIds }, isBlocked: true }),
      Task.countDocuments({ project: { $in: projectIds }, status: { $ne: TaskStatus.DONE }, dueDate: { $lt: new Date() } }),
      Task.aggregate([
        { $match: { project: { $in: projectIds }, status: { $ne: TaskStatus.DONE }, assignedTo: { $ne: null } } },
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            count: 1,
            name: { $ifNull: ['$user.name', 'Unassigned'] },
            avatar: '$user.avatar',
          },
        },
      ]),
    ]);

    // Calculate unique team members across all user's projects
    const allProjects = await Project.find({ _id: { $in: projectIds } }).select('members createdBy');
    const memberSet = new Set<string>();
    allProjects.forEach(p => {
      memberSet.add(p.createdBy.toString());
      p.members.forEach(m => memberSet.add(m.user.toString()));
    });
    const teamMemberCount = memberSet.size;

    // Recent activity scoped to user's projects
    const projectTaskIds = (await Task.find({ project: { $in: projectIds } }).select('_id')).map(t => t._id);
    const projectIssueIds = (await Issue.find({ project: { $in: projectIds } }).select('_id')).map(i => i._id);

    const recentComments = await Comment.find({
      $or: [
        { task: { $in: projectTaskIds } },
        { issue: { $in: projectIssueIds } },
      ],
    })
      .populate('author', 'name avatar')
      .populate('task', 'title project taskKey')
      .populate('issue', 'title project issueKey')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentTasks = await Task.find({ project: { $in: projectIds } })
      .populate('assignedTo', 'name avatar')
      .populate('project', 'name key')
      .sort({ updatedAt: -1 })
      .limit(6);

    const recentIssues = await Issue.find({ project: { $in: projectIds } })
      .populate('assignedTo', 'name avatar')
      .populate('project', 'name key')
      .sort({ updatedAt: -1 })
      .limit(6);

    const recentActivities = await Activity.find({ project: { $in: projectIds } })
      .populate('actor', 'name email avatar')
      .populate('project', 'name key')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalProjects,
          activeProjects,
          totalTasks,
          completedTasks,
          openIssues,
          blockedTasks,
          overdueTasks,
          teamMembers: teamMemberCount,
        },
        charts: {
          tasksByStatus,
          tasksByPriority,
          issuesBySeverity,
          workloadByAssignee,
        },
        activeSprint,
        recentActivity: {
          recentComments,
          recentTasks,
          recentIssues,
          recentActivities,
        },
        recentActivities,
      },
    });
  } catch (error) {
    next(error);
  }
};
