export type Role = 'GUEST' | 'RESIDENT' | 'MERCHANT' | 'ADMIN' | 'SUPER_ADMIN';

export type ApiEnvelope<T> = { data: T };

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  unitNumber: string | null;
  avatarUrl: string | null;
  role: Role;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuthTokens = { accessToken: string; refreshToken: string };
export type AuthResponse = AuthTokens & { user: AuthUser };
export type LoginPayload = { email: string; password: string };