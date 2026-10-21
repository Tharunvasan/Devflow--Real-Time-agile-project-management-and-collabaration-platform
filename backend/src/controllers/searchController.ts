import { Request, Response, NextFunction } from 'express';
import { Project } from '../models/Project';
import { Task } from '../models/Task';
import { Issue } from '../models/Issue';
import { User } from '../models/User';

export const globalSearch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const query = String(req.query.q || '').trim();

    if (!query || query.length < 2) {
      res.status(200).json({
        success: true,
        data: { projects: [], tasks: [], issues: [], members: [] },
      });
      return;
    }

    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    // Get authorized projects
    const isSystemAdmin = req.user?.role === 'ADMIN';
    const projectFilter = isSystemAdmin
      ? {}
      : { $or: [{ createdBy: userId }, { 'members.user': userId }] };

    const authorizedProjects = await Project.find(projectFilter).select('_id members createdBy');
    const projectIds = authorizedProjects.map((p) => p._id);

    // Collect team member user IDs
    const memberIdSet = new Set<string>();
    authorizedProjects.forEach((p) => {
      memberIdSet.add(p.createdBy.toString());
      p.members.forEach((m: any) => memberIdSet.add(m.user.toString()));
    });
    const memberIds = Array.from(memberIdSet);

    // Search in parallel
    const [projects, tasks, issues, members] = await Promise.all([
      Project.find({
        _id: { $in: projectIds },
        $or: [{ name: regex }, { key: regex }, { description: regex }],
      })
        .select('name key description status createdAt')
        .limit(8),

      Task.find({
        project: { $in: projectIds },
        $or: [{ title: regex }, { taskKey: regex }, { description: regex }, { labels: regex }],
      })
        .populate('project', 'name key')
        .populate('assignedTo', 'name email avatar')
        .select('title taskKey status priority project assignedTo storyPoints dueDate')
        .limit(10),

      Issue.find({
        project: { $in: projectIds },
        $or: [{ title: regex }, { issueKey: regex }, { description: regex }],
      })
        .populate('project', 'name key')
        .populate('assignedTo', 'name email avatar')
        .select('title issueKey status severity priority project assignedTo')
        .limit(10),

      User.find({
        _id: { $in: memberIds },
        $or: [{ name: regex }, { email: regex }],
      })
        .select('name email role avatar')
        .limit(6),
    ]);

    res.status(200).json({
      success: true,
      data: {
        projects,
        tasks,
        issues,
        members,
      },
    });
  } catch (error) {
    next(error);
  }
};
