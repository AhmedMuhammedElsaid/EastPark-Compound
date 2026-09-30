export type Role = 'GUEST' | 'RESIDENT' | 'MERCHANT' | 'ADMIN';
export type Lang = 'ar' | 'en';

export type ApiEnvelope<T> = { data: T };
export type CursorPage<T> = { items: T[]; nextCursor?: string | null };
export type CursorQuery = { cursor?: string; limit?: number };

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
export type RegisterPayload = LoginPayload & {
  name: string;
  phone: string;
  unitNumber: string;
};
export type VerifyOtpPayload = { email: string; otp: string };
export type ResetPasswordPayload = { token: string; password: string };
export type AcceptInvitationPayload = ResetPasswordPayload & { name: string };

export type ShopCategory = 'CAFE_AND_FOOD' | 'GROCERY' | 'BUTCHER' | 'SERVICES' | 'OTHER';
export type ShopPhoto = { id: string; url: string; order: number; isPrimary: boolean };
export type WorkingHoursDay = { open: string; close: string; closed: boolean };
export type WorkingHours = Partial<Record<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', WorkingHoursDay>>;
export type Shop = {
  id: string;
  name: string;
  nameAr: string;
  description?: string | null;
  descriptionAr?: string | null;
  category: ShopCategory;
  photos: ShopPhoto[];
  workingHours?: WorkingHours | null;
  isOpen: boolean;
  phone?: string | null;
  whatsapp?: string | null;
  reviewCount: number;
  averageRating: number | null;
};

export type Product = {
  id: string;
  name: string;
  nameAr: string;
  description?: string | null;
  descriptionAr?: string | null;
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
};

export type CartItem = Pick<Product, 'id' | 'name' | 'nameAr' | 'price' | 'imageUrl'> & {
  quantity: number;
};
export type Cart = { shopId: string | null; shopName: string | null; items: CartItem[] };

export type PaymentMethod = 'CASH' | 'PAYMOB';
export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED';
export type OrderItem = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  productNameArSnapshot: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};
export type Order = {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  notes?: string | null;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  paymobOrderId?: string | null;
  cancelledAt?: string | null;
  shop: { id: string; name: string; nameAr: string };
  items: OrderItem[];
  createdAt: string;
};

export type AnnouncementCategory = 'GENERAL' | 'PROMOTION' | 'EVENT' | 'MAINTENANCE' | 'NEWS';
export type Announcement = {
  id: string;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  category: AnnouncementCategory;
  pdfUrl?: string | null;
  isPinned: boolean;
  createdAt: string;
};

export type PollOption = { id: string; text: string; textAr: string; votes?: number };
export type Poll = {
  id: string;
  question: string;
  questionAr: string;
  expiresAt: string;
  options: PollOption[];
  totalVotes: number;
  myVote: string | null;
  resultsOpen: boolean;
};

export type ElectionVisibilityMode = 'SEALED_UNTIL_DEADLINE' | 'LIVE_COUNT' | 'ADMIN_CONTROLLED';
export type Candidate = {
  id: string;
  name: string;
  nameAr: string;
  statement?: string | null;
  statementAr?: string | null;
  photoUrl?: string | null;
  votes?: number;
};
export type Election = {
  id: string;
  title: string;
  titleAr: string;
  description?: string | null;
  descriptionAr?: string | null;
  expiresAt: string;
  resultsOpen: boolean;
  visibilityMode: ElectionVisibilityMode;
  candidates: Candidate[];
  totalVotes: number;
  myVote: string | null;
};

export type FeedbackCategory = 'MAINTENANCE' | 'SECURITY' | 'CLEANLINESS' | 'NOISE' | 'SUGGESTION' | 'OTHER';
export type FeedbackStatus = 'SUBMITTED' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED';
export type Feedback = {
  id: string;
  category: FeedbackCategory;
  title: string;
  body: string;
  isAnonymous: boolean;
  status: FeedbackStatus;
  attachments: string[];
  replies: Array<{
    id: string;
    body: string;
    author: { name: string } | null;
    createdAt: string;
  }>;
  createdAt: string;
};

export type NotificationType = 'ORDER_UPDATE' | 'ANNOUNCEMENT' | 'POLL' | 'ELECTION' | 'FEEDBACK_UPDATE';
export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

export type NotificationPreference = { type: NotificationType; enabled: boolean };
