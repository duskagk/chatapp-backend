// services/socketService.ts

import { Server, Socket } from "socket.io";
import { UserService } from "./userService";
import { ChatService } from "./chatService";

export interface JoinRoomData {
  username: string;
  roomId?: string;
}

export interface SendMessageData {
  content: string;
  type?: "user" | "system";
}

export interface TypingData {
  username: string;
  isTyping: boolean;
}

export class SocketService {
  private userService: UserService;
  private chatService: ChatService;

  constructor(userService: UserService, chatService: ChatService) {
    this.userService = userService;
    this.chatService = chatService;
    console.log("SocketService initialized");
  }

  // Socket.IO 연결 처리
  handleConnection(socket: Socket, io: Server): void {
    console.log(`User connected: ${socket.id}`);

    // 방 참가 이벤트
    socket.on("join-room", (data: JoinRoomData) => {
      this.handleJoinRoom(socket, io, data);
    });

    // 메시지 전송 이벤트
    socket.on("send-message", (data: SendMessageData) => {
      this.handleSendMessage(socket, io, data);
    });

    // 타이핑 상태 이벤트
    socket.on("user-typing", (data: TypingData) => {
      this.handleUserTyping(socket, io, data);
    });

    // 방 목록 요청 이벤트
    socket.on("get-rooms", () => {
      this.handleGetRooms(socket);
    });

    // 특정 방 정보 요청 이벤트
    socket.on("get-room-info", (roomId: string) => {
      this.handleGetRoomInfo(socket, roomId);
    });

    // 연결 해제 이벤트
    socket.on("disconnect", (reason) => {
      this.handleDisconnect(socket, io, reason);
    });
  }

  // 방 참가 처리
  private handleJoinRoom(socket: Socket, io: Server, data: JoinRoomData): void {
    try {
      const { username, roomId = "general" } = data;
      console.log(`${username} requesting to join room: ${roomId}`);

      // 사용자명 중복 체크
      if (!this.userService.isUsernameAvailable(username)) {
        socket.emit("join-error", {
          message: "Username already taken",
          code: "USERNAME_TAKEN",
        });
        return;
      }

      // 사용자 추가
      const user = this.userService.addUser(socket.id, {
        username,
        ipAddress: socket.request.connection.remoteAddress,
      });

      if (!user) {
        socket.emit("join-error", {
          message: "Failed to add user",
          code: "ADD_USER_FAILED",
        });
        return;
      }

      // Socket.IO 방에 참가
      socket.join(roomId);

      // UserService에 방 참가 등록
      this.userService.joinRoom(socket.id, roomId);

      // ChatService에 사용자 추가
      this.chatService.addUserToRoom(roomId, {
        id: user.id,
        username: user.username,
        isOnline: user.isOnline,
        joinedAt: user.joinedAt,
      });

      // 참가 성공 알림
      socket.emit("join-success", {
        user: {
          id: user.id,
          username: user.username,
          isOnline: user.isOnline,
          joinedAt: user.joinedAt,
        },
        roomId,
      });

      // 방의 다른 사용자들에게 새 사용자 알림
      socket.to(roomId).emit("user-joined", {
        id: user.id,
        username: user.username,
        isOnline: user.isOnline,
        joinedAt: user.joinedAt,
      });

      // 현재 방의 사용자 목록 전송 (모든 사용자에게)
      const roomUsers = this.userService.getRoomUsers(roomId);
      const userList = roomUsers.map((u) => ({
        id: u.id,
        username: u.username,
        isOnline: u.isOnline,
        joinedAt: u.joinedAt,
      }));
      io.to(roomId).emit("room-users", userList);

      // 시스템 메시지 전송
      const systemMessage = {
        id: `system_${Date.now()}`,
        user: "System",
        content: `${username} joined the chat`,
        timestamp: new Date(),
        type: "system" as const,
      };

      // 메시지를 채팅 서비스에 저장
      this.chatService.addMessageToRoom(roomId, systemMessage);
      io.to(roomId).emit("message-received", systemMessage);

      console.log(`${username} successfully joined ${roomId}`);
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("join-error", {
        message: "Server error occurred",
        code: "SERVER_ERROR",
      });
    }
  }

  // 메시지 전송 처리
  private handleSendMessage(
    socket: Socket,
    io: Server,
    messageData: SendMessageData
  ): void {
    try {
      const user = this.userService.getUser(socket.id);
      if (!user || !user.currentRoom) {
        console.error("User not found or not in a room:", socket.id);
        socket.emit("message-error", { message: "Not in a room" });
        return;
      }

      const message = {
        id: `msg_${Date.now()}_${socket.id}`,
        user: user.username,
        content: messageData.content,
        timestamp: new Date(),
        type: messageData.type || ("user" as const),
      };

      // 사용자 활동 업데이트
      this.userService.updateUserActivity(socket.id);

      // 메시지를 채팅 서비스에 저장
      this.chatService.addMessageToRoom(user.currentRoom, message);

      // 방의 모든 사용자에게 메시지 전송
      io.to(user.currentRoom).emit("message-received", message);

      console.log(
        `Message from ${user.username} in ${user.currentRoom}: ${message.content}`
      );
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("message-error", { message: "Failed to send message" });
    }
  }

  // 타이핑 상태 처리
  private handleUserTyping(socket: Socket, io: Server, data: TypingData): void {
    try {
      const user = this.userService.getUser(socket.id);
      if (!user || !user.currentRoom) return;

      // 타이핑 상태 업데이트
      this.userService.setTyping(socket.id, data.isTyping);

      // 방의 다른 사용자들에게 타이핑 상태 전송
      socket.to(user.currentRoom).emit("user-typing-update", {
        username: user.username,
        isTyping: data.isTyping,
      });

      if (data.isTyping) {
        console.log(`${user.username} is typing in ${user.currentRoom}`);
      }
    } catch (error) {
      console.error("Error handling typing:", error);
    }
  }

  // 방 목록 요청 처리
  private handleGetRooms(socket: Socket): void {
    try {
      const stats = this.userService.getStats();
      socket.emit("rooms-list", {
        rooms: stats.rooms,
        totalRooms: stats.totalRooms,
        roomsList: stats.roomsList,
      });
    } catch (error) {
      console.error("Error getting rooms:", error);
      socket.emit("rooms-error", { message: "Failed to get rooms" });
    }
  }

  // 특정 방 정보 요청 처리
  private handleGetRoomInfo(socket: Socket, roomId: string): void {
    try {
      const roomInfo = this.userService.getRoomInfo(roomId);
      const recentMessages = this.chatService.getRoomMessages(roomId, 20);
      const roomUsers = this.userService.getRoomUsers(roomId);

      socket.emit("room-info", {
        ...roomInfo,
        recentMessages,
        users: roomUsers.map((u) => ({
          id: u.id,
          username: u.username,
          isOnline: u.isOnline,
          joinedAt: u.joinedAt,
          isTyping: u.isTyping,
        })),
      });
    } catch (error) {
      console.error("Error getting room info:", error);
      socket.emit("room-info-error", { message: "Failed to get room info" });
    }
  }

  // 연결 해제 처리
  private handleDisconnect(socket: Socket, io: Server, reason: string): void {
    console.log(`User disconnecting: ${socket.id}, reason: ${reason}`);

    try {
      const user = this.userService.removeUser(socket.id);

      if (user && user.currentRoom) {
        // ChatService에서도 사용자 제거
        this.chatService.removeUserFromRoom(user.currentRoom, socket.id);

        // 방의 다른 사용자들에게 알림
        socket.to(user.currentRoom).emit("user-left", {
          id: user.id,
          username: user.username,
          isOnline: false,
          joinedAt: user.joinedAt,
        });

        // 업데이트된 사용자 목록 전송
        const roomUsers = this.userService.getRoomUsers(user.currentRoom);
        const userList = roomUsers.map((u) => ({
          id: u.id,
          username: u.username,
          isOnline: u.isOnline,
          joinedAt: u.joinedAt,
        }));
        socket.to(user.currentRoom).emit("room-users", userList);

        // 시스템 메시지
        const systemMessage = {
          id: `system_${Date.now()}`,
          user: "System",
          content: `${user.username} left the chat`,
          timestamp: new Date(),
          type: "system" as const,
        };

        this.chatService.addMessageToRoom(user.currentRoom, systemMessage);
        socket.to(user.currentRoom).emit("message-received", systemMessage);

        console.log(`${user.username} left ${user.currentRoom}`);
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  }

  // 통계 정보 조회 (관리용)
  getStats() {
    const userStats = this.userService.getStats();
    const chatStats = this.chatService.getStats();

    return {
      users: userStats,
      chat: chatStats,
      timestamp: new Date(),
    };
  }

  // 비활성 사용자 정리 (관리용)
  cleanupInactiveUsers(inactiveMinutes: number = 30): number {
    return this.userService.cleanupInactiveUsers(inactiveMinutes);
  }

  // 특정 사용자를 방에서 강제 퇴장 (관리용)
  kickUser(socketId: string, io: Server): boolean {
    const user = this.userService.getUser(socketId);
    if (!user || !user.currentRoom) return false;

    const roomId = user.currentRoom;

    // 강제 퇴장 메시지
    const systemMessage = {
      id: `system_${Date.now()}`,
      user: "System",
      content: `${user.username} was kicked from the chat`,
      timestamp: new Date(),
      type: "system" as const,
    };

    this.chatService.addMessageToRoom(roomId, systemMessage);
    io.to(roomId).emit("message-received", systemMessage);

    // 사용자 연결 해제
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit("kicked", { message: "You have been kicked from the room" });
      socket.disconnect(true);
    }

    return true;
  }
}
