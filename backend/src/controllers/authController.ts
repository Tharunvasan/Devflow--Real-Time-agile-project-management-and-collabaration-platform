import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { User } from '../models/User';
import { generateToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';

// Validation rules
export const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['PROJECT_MANAGER', 'DEVELOPER', 'TESTER']).withMessage('Invalid role'),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }

    const user = await User.create({ name, email, password, role });

    const token = generateToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }
    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Contact admin.', 401);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = generateToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    // Don't expose password
    const userObj = user.toJSON();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: userObj, token },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) throw new AppError('User not found', 404);

    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, avatar } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { name, avatar },
      { new: true, runValidators: true }
    );
    if (!user) throw new AppError('User not found', 404);

    res.status(200).json({ success: true, message: 'Profile updated', data: { user } });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user!.id).select('+password');
    if (!user) throw new AppError('User not found', 404);

    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) throw new AppError('Current password is incorrect', 400);

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};
