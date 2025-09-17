import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  UserProfile,
  UserCredentials,
  AuthResponse,
  JWTPayload,
} from "../types/user";

// 임시로 메모리에 사용자 저장 (나중에 DB로 교체)
interface StoredUser extends UserProfile {
  passwordHash: string;
}

export class AuthService {
  private users: Map<string, StoredUser> = new Map(); // username -> user
  private usersByEmail: Map<string, string> = new Map(); // email -> username
  private JWT_SECRET =
    process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

  constructor() {
    // 테스트용 기본 사용자 생성
    this.createTestUsers();
  }

  // 테스트용 사용자들 생성
  private async createTestUsers() {
    const testUsers = [
      {
        username: "admin",
        password: "admin123",
        email: "admin@chatapp.com",
        displayName: "Administrator",
      },
      {
        username: "user1",
        password: "password123",
        email: "user1@chatapp.com",
        displayName: "User One",
      },
    ];

    for (const user of testUsers) {
      await this.register({
        username: user.username,
        password: user.password,
        email: user.email,
        displayName: user.displayName,
      });
    }

    console.log("✅ Test users created: admin/admin123, user1/password123");
  }

  // 회원가입
  async register(userData: {
    username: string;
    password: string;
    email: string;
    displayName: string;
  }): Promise<AuthResponse> {
    try {
      // 중복 사용자명 체크
      if (this.users.has(userData.username)) {
        return {
          success: false,
          error: "Username already exists",
        };
      }

      // 중복 이메일 체크
      if (this.usersByEmail.has(userData.email)) {
        return {
          success: false,
          error: "Email already exists",
        };
      }

      // 비밀번호 해싱
      const passwordHash = await bcrypt.hash(userData.password, 10);

      // 사용자 생성
      const user: StoredUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username: userData.username,
        email: userData.email,
        displayName: userData.displayName,
        isOnline: false,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordHash,
      };

      // 저장
      this.users.set(userData.username, user);
      this.usersByEmail.set(userData.email, userData.username);

      // JWT 토큰 생성
      const token = this.generateToken(user);

      console.log(`✅ User registered: ${userData.username}`);

      return {
        success: true,
        user: this.sanitizeUser(user),
        token,
      };
    } catch (error) {
      console.error("❌ Registration error:", error);
      return {
        success: false,
        error: "Registration failed",
      };
    }
  }

  // 로그인
  async login(credentials: UserCredentials): Promise<AuthResponse> {
    try {
      const user = this.users.get(credentials.username);

      if (!user) {
        return {
          success: false,
          error: "Invalid username or password",
        };
      }

      // 비밀번호 확인
      const isValidPassword = await bcrypt.compare(
        credentials.password,
        user.passwordHash
      );

      if (!isValidPassword) {
        return {
          success: false,
          error: "Invalid username or password",
        };
      }

      // 로그인 시간 업데이트
      user.isOnline = true;
      user.lastSeen = new Date();
      user.updatedAt = new Date();

      // JWT 토큰 생성
      const token = this.generateToken(user);

      console.log(`✅ User logged in: ${credentials.username}`);

      return {
        success: true,
        user: this.sanitizeUser(user),
        token,
      };
    } catch (error) {
      console.error("❌ Login error:", error);
      return {
        success: false,
        error: "Login failed",
      };
    }
  }

  // 로그아웃
  async logout(username: string): Promise<boolean> {
    try {
      const user = this.users.get(username);
      if (user) {
        user.isOnline = false;
        user.lastSeen = new Date();
        user.updatedAt = new Date();
        console.log(`✅ User logged out: ${username}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error("❌ Logout error:", error);
      return false;
    }
  }

  // JWT 토큰 생성
  private generateToken(user: StoredUser): string {
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24시간
    };

    return jwt.sign(payload, this.JWT_SECRET);
  }

  // JWT 토큰 검증
  verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      console.error("❌ Token verification failed:", error);
      return null;
    }
  }

  // 사용자 정보 조회 (토큰으로)
  getUserByToken(token: string): UserProfile | null {
    const payload = this.verifyToken(token);
    if (!payload) return null;

    const user = this.users.get(payload.username);
    return user ? this.sanitizeUser(user) : null;
  }

  // 사용자 정보 조회 (사용자명으로)
  getUserByUsername(username: string): UserProfile | null {
    const user = this.users.get(username);
    return user ? this.sanitizeUser(user) : null;
  }

  // 사용자 정보 조회 (ID로)
  getUserById(userId: string): UserProfile | null {
    for (const user of this.users.values()) {
      if (user.id === userId) {
        return this.sanitizeUser(user);
      }
    }
    return null;
  }

  // 온라인 상태 업데이트
  updateUserOnlineStatus(username: string, isOnline: boolean): boolean {
    const user = this.users.get(username);
    if (user) {
      user.isOnline = isOnline;
      user.lastSeen = new Date();
      user.updatedAt = new Date();
      return true;
    }
    return false;
  }

  // 사용자명 사용 가능 여부 체크
  isUsernameAvailable(username: string): boolean {
    return !this.users.has(username);
  }

  // 이메일 사용 가능 여부 체크
  isEmailAvailable(email: string): boolean {
    return !this.usersByEmail.has(email);
  }

  // 모든 사용자 목록 (관리자용)
  getAllUsers(): UserProfile[] {
    return Array.from(this.users.values()).map((user) =>
      this.sanitizeUser(user)
    );
  }

  // 온라인 사용자 목록
  getOnlineUsers(): UserProfile[] {
    return Array.from(this.users.values())
      .filter((user) => user.isOnline)
      .map((user) => this.sanitizeUser(user));
  }

  // 패스워드 해시 제거 (보안)
  private sanitizeUser(user: StoredUser): UserProfile {
    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  // 통계
  getStats() {
    const totalUsers = this.users.size;
    const onlineUsers = Array.from(this.users.values()).filter(
      (u) => u.isOnline
    ).length;
    const recentUsers = Array.from(this.users.values()).filter(
      (u) => Date.now() - u.lastSeen.getTime() < 24 * 60 * 60 * 1000
    ).length;

    return {
      totalUsers,
      onlineUsers,
      recentUsers,
      lastDayActive: recentUsers,
    };
  }
}
