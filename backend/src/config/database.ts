import mongoose from 'mongoose';
import { config } from './config';
import { logger } from '../utils/logger';

export const connectDB = async (retries = 5): Promise<void> => {
  while (retries > 0) {
    try {
      const conn = await mongoose.connect(config.mongoUri);
      logger.info(`MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      retries -= 1;
      logger.error(`MongoDB connection failed. Retries left: ${retries}`, error);
      if (retries === 0) {
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});
