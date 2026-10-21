import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { Repository, RepositorySource } from '../models/Repository';
import { Project } from '../models/Project';
import { GitService } from '../services/gitService';
import { GitHubService } from '../services/githubService';
import fs from 'fs/promises';

/**
 * Helper to verify user access to a project
 */
const verifyProjectAccess = async (projectId: string, userId: string): Promise<void> => {
  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);
  const isMember = project.members.some(m => m.user.toString() === userId);
  const isOwner = project.createdBy.toString() === userId;
  if (!isMember && !isOwner) {
    throw new AppError('Not authorized to access repositories for this project', 403);
  }
};

export const linkRepository = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, projectId, source, path, url } = req.body;
    
    await verifyProjectAccess(projectId, req.user!.id);

    // If local, verify path exists and is a git repository
    if (source === RepositorySource.LOCAL) {
      if (!path) throw new AppError('Path is required for local repositories', 400);
      try {
        await GitService.getBranches(path);
      } catch (err) {
        throw new AppError('Invalid local git repository path', 400);
      }
    }

    const repo = await Repository.create({
      name,
      project: projectId,
      source,
      path: source === RepositorySource.LOCAL ? path : undefined,
      url: source === RepositorySource.GITHUB ? url : undefined,
      createdBy: req.user!.id,
    });

    res.status(201).json({ success: true, data: { repository: repo } });
  } catch (error) {
    next(error);
  }
};

export const getRepositories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    await verifyProjectAccess(projectId, req.user!.id);
    
    const repositories = await Repository.find({ project: projectId }).populate('createdBy', 'name email');
    res.status(200).json({ success: true, data: { repositories } });
  } catch (error) {
    next(error);
  }
};

export const getBranches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const repo = await Repository.findById(id);
    if (!repo) throw new AppError('Repository not found', 404);
    
    await verifyProjectAccess(repo.project.toString(), req.user!.id);

    if (repo.source === RepositorySource.LOCAL) {
      const branches = await GitService.getBranches(repo.path!);
      res.status(200).json({ success: true, data: { branches } });
    } else {
      // Parse GitHub URL (e.g. https://github.com/owner/repo)
      if (!repo.url) throw new AppError('GitHub URL is missing', 400);
      const parts = repo.url.replace('https://github.com/', '').split('/');
      const branches = await GitHubService.getBranches(parts[0], parts[1]);
      res.status(200).json({ success: true, data: { branches } });
    }
  } catch (error) {
    next(error);
  }
};

export const getCommits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { branch, skip, limit } = req.query;
    
    const repo = await Repository.findById(id);
    if (!repo) throw new AppError('Repository not found', 404);
    
    await verifyProjectAccess(repo.project.toString(), req.user!.id);

    if (repo.source === RepositorySource.LOCAL) {
      const commits = await GitService.getCommits(repo.path!, {
        branch: branch as string,
        skip: skip ? parseInt(skip as string) : 0,
        maxCount: limit ? parseInt(limit as string) : 50,
      });
      res.status(200).json({ success: true, data: { commits } });
    } else {
      if (!repo.url) throw new AppError('GitHub URL is missing', 400);
      const parts = repo.url.replace('https://github.com/', '').split('/');
      const page = skip ? Math.floor(parseInt(skip as string) / (limit ? parseInt(limit as string) : 50)) + 1 : 1;
      const commits = await GitHubService.getCommits(parts[0], parts[1], branch as string, undefined, limit ? parseInt(limit as string) : 50, page);
      res.status(200).json({ success: true, data: { commits } });
    }
  } catch (error) {
    next(error);
  }
};

export const getTree = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { ref = 'HEAD', path = '' } = req.query;
    
    const repo = await Repository.findById(id);
    if (!repo) throw new AppError('Repository not found', 404);
    
    await verifyProjectAccess(repo.project.toString(), req.user!.id);

    if (repo.source === RepositorySource.LOCAL) {
      const tree = await GitService.getTree(repo.path!, ref as string, path as string);
      res.status(200).json({ success: true, data: { tree } });
    } else {
      if (!repo.url) throw new AppError('GitHub URL is missing', 400);
      const parts = repo.url.replace('https://github.com/', '').split('/');
      const tree = await GitHubService.getTree(parts[0], parts[1], ref as string, path as string);
      res.status(200).json({ success: true, data: { tree } });
    }
  } catch (error) {
    next(error);
  }
};
