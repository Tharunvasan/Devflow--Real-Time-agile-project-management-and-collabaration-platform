import { User, UserRole } from './src/models/User';
import { connectDB } from './src/config/database';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const createAdmin = async () => {
  try {
    await connectDB();
    let admin = await User.findOne({ email: 'admin@devflow.com' });
    if (!admin) {
      admin = new User({
        name: 'Admin User',
        email: 'admin@devflow.com',
        password: 'password123',
        role: UserRole.ADMIN,
      });
      await admin.save();
      console.log('Admin user created: admin@devflow.com / password123');
    } else {
      admin.password = 'password123';
      await admin.save();
      console.log('Admin password reset to: password123');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

createAdmin();
