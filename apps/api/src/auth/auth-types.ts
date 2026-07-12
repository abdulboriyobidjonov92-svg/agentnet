// SQLite enum'ni qo'llab-quvvatlamaydi — role String sifatida saqlanadi.
export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface AuthenticatedUser {
  id: string;
  clerkId: string;
  email: string;
  orgId: string | null;
  role: Role;
  twoFactorEnabled: boolean;
  isBusinessAccount: boolean;
}
