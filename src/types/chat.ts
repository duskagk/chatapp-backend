export interface Message {
  id: string;
  user: string;
  content: string;
  timestamp: Date;
  type: "user" | "system";
}

export interface User {
  id: string;
  username: string;
  isOnline: boolean;
  joinedAt: Date;
}

export interface ChatRoom {
  id: string;
  name: string;
  users: Map<string, User>;
  messages: Message[];
  createdAt: Date;
}
