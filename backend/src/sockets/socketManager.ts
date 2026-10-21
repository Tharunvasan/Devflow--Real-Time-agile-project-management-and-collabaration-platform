import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { Project } from '../models/Project';

let io: Server | null = null;

// Track presence: projectId -> Map<socketId, user>
const projectPresence = new Map<string, Map<string, any>>();

const emitPresenceUpdate = (projectId: string) => {
  if (io) {
    const usersInProject = projectPresence.get(projectId);
    if (usersInProject) {
      // Get unique users in the room
      const uniqueUsers = Array.from(new Map(
        Array.from(usersInProject.values()).map(u => [u.id, u])
      ).values());
      io.to(`project:${projectId}`).emit('presence:update', uniqueUsers);
    } else {
      io.to(`project:${projectId}`).emit('presence:update', []);
    }
  }
};

export const initializeSocket = (server: Server): void => {
  io = server;

  // JWT authentication middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }
    try {
      const decoded = verifyToken(token);
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    logger.info(`Socket connected: ${user?.email} (${socket.id})`);

    // Join personal notification room
    socket.join(`user:${user?.id}`);

    // Join project rooms
    socket.on('join:project', async (projectId: string) => {
      try {
        const project = await Project.findById(projectId);
        if (!project) {
          socket.emit('error', { message: 'Project not found' });
          return;
        }
        
        // Ensure user is a member or admin
        const isMember = project.members.some(m => m.user.toString() === user?.id);
        const isOwner = project.createdBy.toString() === user?.id;
        if (!isMember && !isOwner && user?.role !== 'ADMIN') {
          socket.emit('error', { message: 'Not authorized to join this project room' });
          return;
        }

        socket.join(`project:${projectId}`);
        socket.data.activeProjectId = projectId; // Keep track of current project room

        if (!projectPresence.has(projectId)) {
          projectPresence.set(projectId, new Map());
        }
        projectPresence.get(projectId)!.set(socket.id, user);
        
        logger.debug(`${user?.email} joined project room: ${projectId}`);
        socket.emit('joined:project', { projectId });
        emitPresenceUpdate(projectId);
      } catch (error) {
        logger.error(`Error joining project room: ${error}`);
        socket.emit('error', { message: 'Failed to join project room' });
      }
    });

    socket.on('leave:project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      if (socket.data.activeProjectId === projectId) {
        socket.data.activeProjectId = undefined;
      }
      const usersInProject = projectPresence.get(projectId);
      if (usersInProject) {
        usersInProject.delete(socket.id);
        if (usersInProject.size === 0) {
          projectPresence.delete(projectId);
        }
      }
      logger.debug(`${user?.email} left project room: ${projectId}`);
      emitPresenceUpdate(projectId);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${user?.email} (${socket.id})`);
      const projectId = socket.data.activeProjectId;
      if (projectId) {
        const usersInProject = projectPresence.get(projectId);
        if (usersInProject) {
          usersInProject.delete(socket.id);
          if (usersInProject.size === 0) {
            projectPresence.delete(projectId);
          }
          emitPresenceUpdate(projectId);
        }
      }
    });
  });
};

export const getIO = (): Server | null => io;
