import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AdminRouteGuard } from '../AdminRouteGuard';
import { useAdminAuth } from '@/hooks/useAdminAuth';

// Mock the useAdminAuth hook
jest.mock('@/hooks/useAdminAuth');
const mockUseAdminAuth = useAdminAuth as jest.MockedFunction<typeof useAdminAuth>;

// Mock window.location if it doesn't exist or if it's configurable
if (!window.location || Object.getOwnPropertyDescriptor(window, 'location')?.configurable) {
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  });
}

describe('AdminRouteGuard', () => {
  const TestChildren = () => <div>Admin Content</div>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading spinner when authentication is loading', () => {
    mockUseAdminAuth.mockReturnValue({
      user: null,
      isAdmin: false,
      isLoading: true,
      isAuthenticated: false,
      checkAdminRole: () => false,
    });

    render(
      <AdminRouteGuard>
        <TestChildren />
      </AdminRouteGuard>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('shows access denied when user is not authenticated', () => {
    mockUseAdminAuth.mockReturnValue({
      user: null,
      isAdmin: false,
      isLoading: false,
      isAuthenticated: false,
      checkAdminRole: () => false,
    });

    render(
      <AdminRouteGuard>
        <TestChildren />
      </AdminRouteGuard>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You don\'t have permission to access the admin panel.')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('shows access denied when user is not admin', () => {
    mockUseAdminAuth.mockReturnValue({
      user: {
        id: '1',
        email: 'user@example.com',
        roles: ['user'],
        isAdmin: false,
      },
      isAdmin: false,
      isLoading: false,
      isAuthenticated: true,
      checkAdminRole: () => false,
    });

    render(
      <AdminRouteGuard>
        <TestChildren />
      </AdminRouteGuard>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  it('renders children when user is admin', () => {
    mockUseAdminAuth.mockReturnValue({
      user: {
        id: '1',
        email: 'admin@improvtoday.com',
        roles: ['admin'],
        isAdmin: true,
      },
      isAdmin: true,
      isLoading: false,
      isAuthenticated: true,
      checkAdminRole: () => true,
    });

    render(
      <AdminRouteGuard>
        <TestChildren />
      </AdminRouteGuard>
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
  });
});