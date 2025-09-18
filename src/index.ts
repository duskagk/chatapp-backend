import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { ChatService } from "./services/chatService";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";

// 환경 변수 로드
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

// 미들웨어 설정
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// 서비스 인스턴스
const chatService = new ChatService();

app.all("/api/auth/*splat", toNodeHandler(auth));

// 기본 라우트
app.get("/", (req, res) => {
  res.json({
    message: "ChatApp Backend Server",
    version: "1.0.0",
    status: "running",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Socket.io 연결 처리
// io.on("connection", (socket) => {
//   console.log(`🔌 User connected: ${socket.id}`);

//   // 방 참가
//   socket.on(
//     "join-room",
//     async (data: { username: string; roomId?: string }) => {
//       try {
//         const { username, roomId = "general" } = data;
//         console.log(`👤 ${username} requesting to join room: ${roomId}`);

//         // 사용자명 중복 체크
//         if (!userService.isUsernameAvailable(username)) {
//           socket.emit("join-error", {
//             message: "Username already taken",
//             code: "USERNAME_TAKEN",
//           });
//           return;
//         }

//         // 사용자 추가
//         const user = userService.addUser(
//           socket.id,
//           {
//             username,
//             isOnline: true,
//             joinedAt: new Date(),
//           },
//           socket.request.connection.remoteAddress
//         );

//         if (!user) {
//           socket.emit("join-error", {
//             message: "Failed to add user",
//             code: "ADD_USER_FAILED",
//           });
//           return;
//         }

//         // 방에 참가
//         await socket.join(roomId);
//         userService.joinRoom(socket.id, roomId);

//         // 참가 성공 알림
//         socket.emit("join-success", {
//           user: {
//             id: user.id,
//             username: user.username,
//             isOnline: user.isOnline,
//             joinedAt: user.joinedAt,
//           },
//           roomId,
//         });

//         // 방의 다른 사용자들에게 새 사용자 알림
//         socket.to(roomId).emit("user-joined", {
//           id: user.id,
//           username: user.username,
//           isOnline: user.isOnline,
//           joinedAt: user.joinedAt,
//         });

//         // 현재 방의 사용자 목록 전송 (모든 사용자에게)
//         const roomUsers = userService.getRoomUsers(roomId);
//         io.to(roomId).emit(
//           "room-users",
//           roomUsers.map((u) => ({
//             id: u.id,
//             username: u.username,
//             isOnline: u.isOnline,
//             joinedAt: u.joinedAt,
//           }))
//         );

//         // 시스템 메시지 전송
//         const systemMessage = {
//           id: `system_${Date.now()}`,
//           user: "System",
//           content: `${username} joined the chat`,
//           timestamp: new Date(),
//           type: "system" as const,
//         };

//         // 메시지를 채팅 서비스에도 저장
//         chatService.addMessageToRoom(roomId, systemMessage);
//         io.to(roomId).emit("message-received", systemMessage);

//         console.log(`✅ ${username} successfully joined ${roomId}`);
//       } catch (error) {
//         console.error("❌ Error joining room:", error);
//         socket.emit("join-error", {
//           message: "Server error occurred",
//           code: "SERVER_ERROR",
//         });
//       }
//     }
//   );

//   // 메시지 전송
//   socket.on("send-message", (messageData) => {
//     try {
//       const user = userService.getUser(socket.id);
//       if (!user || !user.currentRoom) {
//         console.error("❌ User not found or not in a room:", socket.id);
//         socket.emit("message-error", { message: "Not in a room" });
//         return;
//       }

//       const message = {
//         id: `msg_${Date.now()}_${socket.id}`,
//         user: user.username,
//         content: messageData.content,
//         timestamp: new Date(),
//         type: messageData.type || ("user" as const),
//       };

//       // 사용자 활동 업데이트
//       userService.updateUserActivity(socket.id);

//       // 메시지를 채팅 서비스에 저장
//       chatService.addMessageToRoom(user.currentRoom, message);

//       // 방의 모든 사용자에게 메시지 전송
//       io.to(user.currentRoom).emit("message-received", message);

//       console.log(
//         `💬 Message from ${user.username} in ${user.currentRoom}: ${message.content}`
//       );
//     } catch (error) {
//       console.error("❌ Error sending message:", error);
//       socket.emit("message-error", { message: "Failed to send message" });
//     }
//   });

//   // 타이핑 상태 전송
//   socket.on("user-typing", (data: { username: string; isTyping: boolean }) => {
//     try {
//       const user = userService.getUser(socket.id);
//       if (!user || !user.currentRoom) return;

//       // 타이핑 상태 업데이트
//       userService.setTyping(socket.id, data.isTyping);
//       userService.updateUserActivity(socket.id);

//       // 방의 다른 사용자들에게 타이핑 상태 전송
//       socket.to(user.currentRoom).emit("user-typing-update", {
//         username: user.username,
//         isTyping: data.isTyping,
//       });

//       // 디버깅용 로그
//       if (data.isTyping) {
//         console.log(`⌨️  ${user.username} is typing in ${user.currentRoom}`);
//       }
//     } catch (error) {
//       console.error("❌ Error handling typing:", error);
//     }
//   });

//   // 방 목록 요청
//   socket.on("get-rooms", () => {
//     const stats = userService.getStats();
//     socket.emit("rooms-list", {
//       rooms: stats.rooms,
//       totalRooms: stats.totalRooms,
//     });
//   });

//   // 특정 방 정보 요청
//   socket.on("get-room-info", (roomId: string) => {
//     const roomStats = userService.getRoomStats(roomId);
//     const recentMessages = chatService.getRoomMessages(roomId, 20);

//     socket.emit("room-info", {
//       ...roomStats,
//       recentMessages,
//     });
//   });

//   // 연결 해제 처리
//   socket.on("disconnect", (reason) => {
//     console.log(`🔌 User disconnecting: ${socket.id}, reason: ${reason}`);

//     try {
//       const user = userService.removeUser(socket.id);

//       if (user && user.currentRoom) {
//         // 방의 다른 사용자들에게 알림
//         socket.to(user.currentRoom).emit("user-left", {
//           id: user.id,
//           username: user.username,
//           isOnline: false,
//           joinedAt: user.joinedAt,
//         });

//         // 업데이트된 사용자 목록 전송
//         const roomUsers = userService.getRoomUsers(user.currentRoom);
//         socket.to(user.currentRoom).emit(
//           "room-users",
//           roomUsers.map((u) => ({
//             id: u.id,
//             username: u.username,
//             isOnline: u.isOnline,
//             joinedAt: u.joinedAt,
//           }))
//         );

//         // 시스템 메시지
//         const systemMessage = {
//           id: `system_${Date.now()}`,
//           user: "System",
//           content: `${user.username} left the chat`,
//           timestamp: new Date(),
//           type: "system" as const,
//         };

//         chatService.addMessageToRoom(user.currentRoom, systemMessage);
//         socket.to(user.currentRoom).emit("message-received", systemMessage);

//         console.log(`👋 ${user.username} left ${user.currentRoom}`);
//       }
//     } catch (error) {
//       console.error("❌ Error handling disconnect:", error);
//     }
//   });
// });

// 서버 시작
httpServer.listen(PORT, () => {
  console.log(`🚀 ChatApp Backend Server running on port ${PORT}`);
  console.log(
    `📱 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`
  );
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`💾 Services: UserService + ChatService initialized`);
});
