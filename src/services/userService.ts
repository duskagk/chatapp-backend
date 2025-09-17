import { User } from '../types/chat';

export interface ExtendedUser extends User {
  socketId: string;
  currentRoom: string | null;
  lastSeen: Date;
  isTyping: boolean;
  connectionCount: number;
  ipAddress?: string;
}

export class UserService {
  private users: Map<string, ExtendedUser> = new Map(); // socketId -> User
  private usernameToSocketId: Map<string, string> = new Map(); // username -> socketId
  private roomUsers: Map<string, Set<string>> = new Map(); // roomId -> Set<socketId>

  // 사용자 추가
  addUser(socketId: string, userData: Omit<User, 'id'>, ipAddress?: string): ExtendedUser | null {
    // 중복 사용자명 체크
    if (this.usernameToSocketId.has(userData.username)) {
      return null; // 중복 사용자명
    }

    const user: ExtendedUser = {
      id: socketId,
      socketId,
      username: userData.username,
      isOnline: true,
      joinedAt: userData.joinedAt || new Date(),
      currentRoom: null,
      lastSeen: new Date(),
      isTyping: false,
      connectionCount: 1,
      ipAddress
    };

    this.users.set(socketId, user);
    this.usernameToSocketId.set(userData.username, socketId);

    console.log(`✅ User added: ${user.username} (${socketId})`);
    return user;
  }

  // 사용자 제거
  removeUser(socketId: string): ExtendedUser | null {
    const user = this.users.get(socketId);
    if (!user) return null;

    // 현재 방에서 제거
    if (user.currentRoom) {
      this.leaveRoom(socketId, user.currentRoom);
    }

    // 매핑에서 제거
    this.users.delete(socketId);
    this.usernameToSocketId.delete(user.username);

    console.log(`❌ User removed: ${user.username} (${socketId})`);
    return user;
  }

  // 사용자 정보 가져오기
  getUser(socketId: string): ExtendedUser | null {
    return this.users.get(socketId) || null;
  }

  // 사용자명으로 사용자 찾기
  getUserByUsername(username: string): ExtendedUser | null {
    const socketId = this.usernameToSocketId.get(username);
    return socketId ? this.users.get(socketId) || null : null;
  }

  // 사용자명 중복 체크
  isUsernameAvailable(username: string): boolean {
    return !this.usernameToSocketId.has(username);
  }

  // 방에 참가
  joinRoom(socketId: string, roomId: string): boolean {
    const user = this.users.get(socketId);
    if (!user) return false;

    // 기존 방에서 나가기
    if (user.currentRoom && user.currentRoom !== roomId) {
      this.leaveRoom(socketId, user.currentRoom);
    }

    // 새 방에 참가
    user.currentRoom = roomId;
    user.lastSeen = new Date();

    if (!this.roomUsers.has(roomId)) {
      this.roomUsers.set(roomId, new Set());
    }
    this.roomUsers.get(roomId)!.add(socketId);

    console.log(`🏠 ${user.username} joined room: ${roomId}`);
    return true;
  }

  // 방에서 나가기
  leaveRoom(socketId: string, roomId: string): boolean {
    const user = this.users.get(socketId);
    if (!user) return false;

    const roomUsersSet = this.roomUsers.get(roomId);
    if (roomUsersSet) {
      roomUsersSet.delete(socketId);
      
      // 방이 비어있으면 삭제
      if (roomUsersSet.size === 0) {
        this.roomUsers.delete(roomId);
        console.log(`🗑️ Empty room deleted: ${roomId}`);
      }
    }

    if (user.currentRoom === roomId) {
      user.currentRoom = null;
    }

    console.log(`🚪 ${user.username} left room: ${roomId}`);
    return true;
  }

  // 방의 사용자 목록 가져오기
  getRoomUsers(roomId: string): ExtendedUser[] {
    const socketIds = this.roomUsers.get(roomId);
    if (!socketIds) return [];

    return Array.from(socketIds)
      .map(socketId => this.users.get(socketId))
      .filter((user): user is ExtendedUser => user !== undefined)
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  // 온라인 사용자 목록
  getOnlineUsers(): ExtendedUser[] {
    return Array.from(this.users.values())
      .filter(user => user.isOnline)
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  // 타이핑 상태 설정
  setTyping(socketId: string, isTyping: boolean): boolean {
    const user = this.users.get(socketId);
    if (!user) return false;

    user.isTyping = isTyping;
    user.lastSeen = new Date();
    return true;
  }

  // 방의 타이핑 중인 사용자들
  getTypingUsers(roomId: string): ExtendedUser[] {
    const socketIds = this.roomUsers.get(roomId);
    if (!socketIds) return [];

    return Array.from(socketIds)
      .map(socketId => this.users.get(socketId))
      .filter((user): user is ExtendedUser => user !== undefined && user.isTyping);
  }

  // 사용자 활동 업데이트
  updateUserActivity(socketId: string): void {
    const user = this.users.get(socketId);
    if (user) {
      user.lastSeen = new Date();
      user.isOnline = true;
    }
  }

  // 비활성 사용자 정리 (선택사항)
  cleanupInactiveUsers(inactiveThreshold: number = 30 * 60 * 1000): ExtendedUser[] {
    const now = new Date();
    const removedUsers: ExtendedUser[] = [];

    for (const [socketId, user] of this.users.entries()) {
      const timeSinceLastSeen = now.getTime() - user.lastSeen.getTime();
      
      if (timeSinceLastSeen > inactiveThreshold) {
        const removedUser = this.removeUser(socketId);
        if (removedUser) {
          removedUsers.push(removedUser);
        }
      }
    }

    if (removedUsers.length > 0) {
      console.log(`🧹 Cleaned up ${removedUsers.length} inactive users`);
    }

    return removedUsers;
  }

  // 통계
  getStats() {
    const totalUsers = this.users.size;
    const onlineUsers = Array.from(this.users.values()).filter(u => u.isOnline).length;
    const totalRooms = this.roomUsers.size;
    const typingUsers = Array.from(this.users.values()).filter(u => u.isTyping).length;

    return {
      totalUsers,
      onlineUsers,
      totalRooms,
      typingUsers,
      rooms: Array.from(this.roomUsers.keys()),
      usernames: Array.from(this.usernameToSocketId.keys()).sort()
    };
  }

  // 방별 통계
  getRoomStats(roomId: string) {
    const users = this.getRoomUsers(roomId);
    const onlineCount = users.filter(u => u.isOnline).length;
    const typingCount = users.filter(u => u.isTyping).length;

    return {
      roomId,
      totalUsers: users.length,
      onlineUsers: onlineCount,
      typingUsers: typingCount,
      users: users.map(u => ({
        username: u.username,
        isOnline: u.isOnline,
        isTyping: u.isTyping,
        lastSeen: u.lastSeen
      }))
    };
  }
}