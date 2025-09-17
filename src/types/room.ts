import { UserProfile } from "./user";
import { Message } from "./chat";

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  type: "public" | "private" | "direct";
  ownerId: string;
  maxUsers?: number;
  password?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomMember {
  userId: string;
  roomId: string;
  role: "owner" | "admin" | "member";
  joinedAt: Date;
  isActive: boolean;
  isMuted?: boolean;
  isBanned?: boolean;
}

export interface RoomWithMembers extends ChatRoom {
  members: (RoomMember & { user: UserProfile })[];
  onlineCount: number;
  messageCount: number;
  lastMessage?: Message;
}

export interface CreateRoomRequest {
  name: string;
  description?: string;
  type: "public" | "private";
  maxUsers?: number;
  password?: string;
}

export interface JoinRoomRequest {
  roomId: string;
  password?: string;
}

export interface RoomPermissions {
  canSendMessages: boolean;
  canEditRoom: boolean;
  canInviteUsers: boolean;
  canRemoveUsers: boolean;
  canDeleteMessages: boolean;
  canManageRoles: boolean;
}

export interface RoomStats {
  totalRooms: number;
  publicRooms: number;
  privateRooms: number;
  directRooms: number;
  totalMembers: number;
  activeRooms: number;
}
