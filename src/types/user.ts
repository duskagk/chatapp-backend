export interface UserCredentials {
  username: string;
  password: string;
  email?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar?: string;
  statusMessage?: string;
  isOnline: boolean;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedUser extends UserProfile {
  socketId?: string;
  currentRoom?: string;
  isTyping?: boolean;
  connectionCount?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  token?: string;
  message?: string;
  error?: string;
}

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  iat: number;
  exp: number;
}
