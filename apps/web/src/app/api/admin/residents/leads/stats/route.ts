import { forwardAdminRequest } from '@/lib/auth/admin.server';

export const maxDuration = 30;

/** Lead counts per status for the admin summary cards. ADMIN is re-checked before forwarding. */
export function GET() {
  return forwardAdminRequest('/admin/residents/leads/stats');
}
