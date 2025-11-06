// models/UserInfo.ts
export type UserInfo = {
  username: string;
  email: string;
  password: string;
  role: 'reader' | 'admin';
  authorized: boolean;
};