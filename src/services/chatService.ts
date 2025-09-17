import { ChatRoom, User, Message } from "../types/chat";

export class ChatService {
  private rooms: Map<string, ChatRoom> = new Map();

  // 방 생성 또는 가져오기
  getOrCreateRoom(roomId: string): ChatRoom {
    if (!this.rooms.has(roomId)) {
      const room: ChatRoom = {
        id: roomId,
        name: roomId === "general" ? "General" : roomId,
        users: new Map(),
        messages: [],
        createdAt: new Date(),
      };
      this.rooms.set(roomId, room);
      console.log(`Created new room: ${roomId}`);
    }
    return this.rooms.get(roomId)!;
  }

  // 사용자를 방에 추가
  addUserToRoom(roomId: string, user: User): User {
    const room = this.getOrCreateRoom(roomId);
    room.users.set(user.id, user);
    console.log(`User ${user.username} (${user.id}) joined room ${roomId}`);
    return user;
  }

  // 사용자를 방에서 제거
  removeUserFromRoom(roomId: string, userId: string): User | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const user = room.users.get(userId);
    if (user) {
      room.users.delete(userId);
      console.log(`User ${user.username} (${userId}) left room ${roomId}`);

      // 방이 비어있으면 정리 (나중에 구현)
      // if (room.users.size === 0) {
      //   this.rooms.delete(roomId);
      // }
    }
    return user || null;
  }

  // 방의 사용자 목록 가져오기
  getRoomUsers(roomId: string): User[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    return Array.from(room.users.values());
  }

  // 방에 메시지 추가
  addMessageToRoom(roomId: string, message: Message): void {
    const room = this.getOrCreateRoom(roomId);
    room.messages.push(message);

    // 메시지 개수 제한 (메모리 관리)
    if (room.messages.length > 100) {
      room.messages = room.messages.slice(-100);
    }
  }

  // 방의 최근 메시지 가져오기
  getRoomMessages(roomId: string, limit: number = 50): Message[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    return room.messages.slice(-limit);
  }

  // 사용자가 특정 방에 있는지 확인
  isUserInRoom(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    return room ? room.users.has(userId) : false;
  }

  // 전체 방 목록 가져오기
  getAllRooms(): ChatRoom[] {
    return Array.from(this.rooms.values()).map((room) => ({
      ...room,
      users: new Map(room.users), // 깊은 복사
    }));
  }

  // 통계 정보
  getStats() {
    const totalRooms = this.rooms.size;
    const totalUsers = Array.from(this.rooms.values()).reduce(
      (total, room) => total + room.users.size,
      0
    );
    const totalMessages = Array.from(this.rooms.values()).reduce(
      (total, room) => total + room.messages.length,
      0
    );

    return {
      totalRooms,
      totalUsers,
      totalMessages,
      rooms: Array.from(this.rooms.keys()),
    };
  }
}
