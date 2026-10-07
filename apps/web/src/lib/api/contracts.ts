export type Role = 'GUEST' | 'RESIDENT' | 'MERCHANT' | 'ADMIN' | 'SUPER_ADMIN';

export type ApiEnvelope<T> = { data: T };

/** One flat owned by an account. `label` is `${building}-${floor}-${flatNumber}` (backend-formatted). */
export type ResidentUnit = {
  id: string;
  building: string;
  floor: string;
  flatNumber: string;
  label: string;
  createdAt: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** The PRIMARY flat's label (kept for old clients); legacy accounts have it without `units`. */
  unitNumber: string | null;
  /**
   * Every flat the account owns, oldest first. Only `GET /user/profile` sends it; login,
   * accept-invitation and `PUT /user` responses parse to `[]`.
   */
  units: ResidentUnit[];
  avatarUrl: string | null;
  role: Role;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuthTokens = { accessToken: string; refreshToken: string };
export type AuthResponse = AuthTokens & { user: AuthUser };
export type LoginPayload = { email: string; password: string };