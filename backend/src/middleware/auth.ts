import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { User, UserRole } from '../models/User';
import { AppError } from './errorHandler';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { _id: string };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Please login.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Check user still exists and is active
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      throw new AppError('User no longer exists.', 401);
    }
    if (!user.isActive) {
      throw new AppError('Your account has been deactivated.', 401);
    }

    req.user = { ...decoded, _id: user._id.toString() };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid or expired token.', 401));
    }
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required.', 401));
      return;
    }
    if (!roles.includes(req.user.role as UserRole)) {
      next(new AppError('You do not have permission to perform this action.', 403));
      return;
    }
    next();
  };
};
