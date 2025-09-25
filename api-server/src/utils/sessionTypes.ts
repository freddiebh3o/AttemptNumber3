export type SessionJwtClaims = {
  currentUserId: string;
  currentTenantId: string;
  issuedAtUnixSeconds: number;
};

export type SessionContext = {
  currentUserId: string;
  currentTenantId: string;
  correlationId: string | null;
};
