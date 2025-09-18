import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-here",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
  trustedOrigins: [
    "http://localhost:3000", // Next.js 프론트엔드
    "http://localhost:3001", // 백엔드 자체
  ],
});
