export enum SessionState {
  Active,
  Invalidated,
  Expired
}

export type Session = {
  sessionId: string;
  memberId: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  device?: string;
  ipAddress?: string;
  state: SessionState;
};