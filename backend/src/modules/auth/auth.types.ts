export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  permissions: string[];
};

export type JwtPayload = {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
};
