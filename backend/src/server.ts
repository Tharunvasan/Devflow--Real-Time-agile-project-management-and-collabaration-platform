import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { connectDB } from './config/database';
import { config } from './config/config';
import { logger } from './utils/logger';
import { initializeSocket } from './sockets/socketManager';

const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  // Create HTTP server
  const httpServer = http.createServer(app);

  // Initialize Socket.IO
  const allowedOrigins = Array.from(new Set([
    ...config.clientUrls,
    'http://localhost:5173',
    'http://localhost:3000',
  ]));

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalizedOrigin = origin.replace(/\/+$/, '');
        if (
          allowedOrigins.includes(normalizedOrigin) ||
          allowedOrigins.includes('*') ||
          normalizedOrigin.endsWith('.vercel.app') ||
          normalizedOrigin.endsWith('.onrender.com')
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  initializeSocket(io);

  // Start listening
  httpServer.listen(config.port, () => {
    logger.info(`🚀 DevFlow Server running on port ${config.port}`);
    logger.info(`📡 Environment: ${config.nodeEnv}`);
    logger.info(`🔗 Client URL: ${config.clientUrl}`);
    logger.info(`🏥 Health: http://localhost:${config.port}/api/health`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    httpServer.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  });
};

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
