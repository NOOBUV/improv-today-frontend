export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  roles: string[];
  isAdmin: boolean;
}

export interface AdminAuthContext {
  user: AdminUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  checkAdminRole: () => boolean;
}