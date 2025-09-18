// services/userService.ts

export interface ConnectedUser {
  id: string; // socketId
  userId?: string; // Better Auth user ID (인증된 경우)
  username: string; // 표시 이름
  isOnline: boolean;
  joinedAt: Date;
  lastActivity: Date;
  currentRoom?: string;
  isTyping: boolean;
  ipAddress?: string;
}

export interface RoomInfo {
  roomId: string;
  userIds: string[]; // socketId 목록
  userCount: number;
  createdAt: Date;
}

export class UserService {
  private connectedUsers = new Map<string, ConnectedUser>(); // socketId -> user
  private userRooms = new Map<string, string>(); // socketId -> roomId
  private roomUsers = new Map<string, Set<string>>(); // roomId -> Set<socketId>
  private usernameToSocketId = new Map<string, string>(); // username -> socketId (중복 체크용)

  constructor() {
    console.log("UserService initialized");
  }

  // 사용자 추가
  addUser(
    socketId: string,
    userInfo: {
      username: string;
      userId?: string;
      ipAddress?: string;
    }
  ): ConnectedUser | null {
    // 사용자명 중복 체크
    if (this.usernameToSocketId.has(userInfo.username)) {
      console.log(`Username already taken: ${userInfo.username}`);
      return null;
    }

    const user: ConnectedUser = {
      id: socketId,
      userId: userInfo.userId,
      username: userInfo.username,
      isOnline: true,
      joinedAt: new Date(),
      lastActivity: new Date(),
      isTyping: false,
      ipAddress: userInfo.ipAddress,
    };

    this.connectedUsers.set(socketId, user);
    this.usernameToSocketId.set(userInfo.username, socketId);

    console.log(`User added: ${user.username} (${socketId})`);
    return user;
  }

  // 사용자 제거
  removeUser(socketId: string): ConnectedUser | null {
    const user = this.connectedUsers.get(socketId);
    if (!user) return null;

    // 방에서 제거
    if (user.currentRoom) {
      this.leaveRoom(socketId);
    }

    // 맵에서 제거
    this.connectedUsers.delete(socketId);
    this.usernameToSocketId.delete(user.username);

    console.log(`User removed: ${user.username} (${socketId})`);
    return user;
  }

  // 사용자 정보 조회
  getUser(socketId: string): ConnectedUser | null {
    return this.connectedUsers.get(socketId) || null;
  }

  // 사용자명으로 소켓ID 조회
  getSocketIdByUsername(username: string): string | null {
    return this.usernameToSocketId.get(username) || null;
  }

  // 사용자명 사용 가능 여부 확인
  isUsernameAvailable(username: string): boolean {
    return !this.usernameToSocketId.has(username);
  }

  // 방에 참가
  joinRoom(socketId: string, roomId: string): boolean {
    const user = this.connectedUsers.get(socketId);
    if (!user) return false;

    // 기존 방에서 나가기
    if (user.currentRoom) {
      this.leaveRoom(socketId);
    }

    // 새 방에 참가
    user.currentRoom = roomId;
    this.userRooms.set(socketId, roomId);

    // 방 사용자 목록에 추가
    if (!this.roomUsers.has(roomId)) {
      this.roomUsers.set(roomId, new Set());
    }
    this.roomUsers.get(roomId)!.add(socketId);

    this.updateUserActivity(socketId);
    console.log(`User ${user.username} joined room: ${roomId}`);
    return true;
  }

  // 방에서 나가기
  leaveRoom(socketId: string): boolean {
    const user = this.connectedUsers.get(socketId);
    if (!user || !user.currentRoom) return false;

    const roomId = user.currentRoom;

    // 방 사용자 목록에서 제거
    const roomUserSet = this.roomUsers.get(roomId);
    if (roomUserSet) {
      roomUserSet.delete(socketId);

      // 방이 비어있으면 정리
      if (roomUserSet.size === 0) {
        this.roomUsers.delete(roomId);
      }
    }

    // 사용자 정보 업데이트
    user.currentRoom = undefined;
    this.userRooms.delete(socketId);

    console.log(`User ${user.username} left room: ${roomId}`);
    return true;
  }

  // 방의 사용자 목록 조회
  getRoomUsers(roomId: string): ConnectedUser[] {
    const socketIds = this.roomUsers.get(roomId);
    if (!socketIds) return [];

    const users: ConnectedUser[] = [];
    for (const socketId of socketIds) {
      const user = this.connectedUsers.get(socketId);
      if (user) {
        users.push(user);
      }
    }

    return users;
  }

  // 사용자가 특정 방에 있는지 확인
  isUserInRoom(socketId: string, roomId: string): boolean {
    const user = this.connectedUsers.get(socketId);
    return user ? user.currentRoom === roomId : false;
  }

  // 사용자 활동 업데이트
  updateUserActivity(socketId: string): boolean {
    const user = this.connectedUsers.get(socketId);
    if (!user) return false;

    user.lastActivity = new Date();
    return true;
  }

  // 타이핑 상태 설정
  setTyping(socketId: string, isTyping: boolean): boolean {
    const user = this.connectedUsers.get(socketId);
    if (!user) return false;

    user.isTyping = isTyping;
    this.updateUserActivity(socketId);
    return true;
  }

  // 모든 연결된 사용자 조회
  getAllUsers(): ConnectedUser[] {
    return Array.from(this.connectedUsers.values());
  }

  // 방 목록 조회
  getAllRooms(): RoomInfo[] {
    const rooms: RoomInfo[] = [];

    for (const [roomId, socketIds] of this.roomUsers.entries()) {
      rooms.push({
        roomId,
        userIds: Array.from(socketIds),
        userCount: socketIds.size,
        createdAt: new Date(), // TODO: 실제 생성 시간 추적
      });
    }

    return rooms;
  }

  // 특정 방 정보 조회
  getRoomInfo(roomId: string): RoomInfo | null {
    const socketIds = this.roomUsers.get(roomId);
    if (!socketIds) return null;

    return {
      roomId,
      userIds: Array.from(socketIds),
      userCount: socketIds.size,
      createdAt: new Date(), // TODO: 실제 생성 시간 추적
    };
  }

  // 통계 정보
  getStats() {
    const totalUsers = this.connectedUsers.size;
    const totalRooms = this.roomUsers.size;
    const onlineUsers = Array.from(this.connectedUsers.values()).filter(
      (u) => u.isOnline
    ).length;
    const typingUsers = Array.from(this.connectedUsers.values()).filter(
      (u) => u.isTyping
    ).length;

    const roomStats = new Map<string, number>();
    for (const [roomId, socketIds] of this.roomUsers.entries()) {
      roomStats.set(roomId, socketIds.size);
    }

    return {
      totalUsers,
      onlineUsers,
      totalRooms,
      typingUsers,
      rooms: Object.fromEntries(roomStats),
      roomsList: Array.from(this.roomUsers.keys()),
    };
  }

  // 비활성 사용자 정리 (선택적)
  cleanupInactiveUsers(inactiveMinutes: number = 30): number {
    const now = new Date();
    const cutoff = new Date(now.getTime() - inactiveMinutes * 60 * 1000);

    let cleanedCount = 0;

    for (const [socketId, user] of this.connectedUsers.entries()) {
      if (user.lastActivity < cutoff) {
        this.removeUser(socketId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} inactive users`);
    }

    return cleanedCount;
  }
}
