import { createHash, randomBytes, pbkdf2Sync } from 'crypto';
import { elizaLogger } from "@elizaos/core";
import { UserDatabase, type User } from '../database/users.ts';

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: Omit<User, 'password'>;
  token?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export class AuthService {
  private userDb: UserDatabase;

  constructor(userDb: UserDatabase) {
    this.userDb = userDb;
  }

  async register(request: RegisterRequest): Promise<AuthResponse> {
    try {
      // Validate input
      if (!request.username || !request.email || !request.password) {
        return {
          success: false,
          message: 'Username, email, and password are required'
        };
      }

      if (!this.isValidEmail(request.email)) {
        return {
          success: false,
          message: 'Please provide a valid email address'
        };
      }

      if (request.password.length < 6) {
        return {
          success: false,
          message: 'Password must be at least 6 characters long'
        };
      }

      // Check if user already exists
      const existingUserByEmail = await this.userDb.getUserByEmail(request.email);
      if (existingUserByEmail) {
        return {
          success: false,
          message: 'A user with this email already exists'
        };
      }

      const existingUserByUsername = await this.userDb.getUserByUsername(request.username);
      if (existingUserByUsername) {
        return {
          success: false,
          message: 'A user with this username already exists'
        };
      }

      // Hash password
      const hashedPassword = this.hashPassword(request.password);

      // Create user
      const user = await this.userDb.createUser({
        username: request.username,
        email: request.email,
        password: hashedPassword
      });

      // Generate token
      const token = this.generateToken(user.id);

      elizaLogger.info(`User registered successfully: ${user.username}`);

      return {
        success: true,
        message: 'User registered successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        token
      };
    } catch (error) {
      elizaLogger.error('Registration error:', error);
      return {
        success: false,
        message: 'Registration failed. Please try again.'
      };
    }
  }

  async login(request: LoginRequest): Promise<AuthResponse> {
    try {
      // Validate input
      if (!request.email || !request.password) {
        return {
          success: false,
          message: 'Email and password are required'
        };
      }

      // Get user by email
      const user = await this.userDb.getUserByEmail(request.email);
      if (!user) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Verify password
      if (!this.verifyPassword(request.password, user.password)) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Generate token
      const token = this.generateToken(user.id);

      elizaLogger.info(`User logged in successfully: ${user.username}`);

      return {
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        token
      };
    } catch (error) {
      elizaLogger.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed. Please try again.'
      };
    }
  }

  async verifyToken(token: string): Promise<string | null> {
    try {
      // Simple token verification - in production, use JWT
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [userId, timestamp] = decoded.split(':');
      
      // Check if token is not older than 24 hours
      const tokenTime = parseInt(timestamp);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (now - tokenTime > maxAge) {
        return null;
      }
      
      // Verify user exists
      const user = await this.userDb.getUserById(userId);
      if (!user) {
        return null;
      }
      
      return userId;
    } catch (error) {
      elizaLogger.error('Token verification error:', error);
      return null;
    }
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(32).toString('hex');
    const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, hashedPassword: string): boolean {
    try {
      const [salt, hash] = hashedPassword.split(':');
      const verifyHash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      return hash === verifyHash;
    } catch (error) {
      elizaLogger.error('Password verification error:', error);
      return false;
    }
  }

  private generateToken(userId: string): string {
    // Simple token generation - in production, use JWT
    const payload = `${userId}:${Date.now()}`;
    return Buffer.from(payload).toString('base64');
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
} 