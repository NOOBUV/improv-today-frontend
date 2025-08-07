'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
// Removed shallow import for Zustand v5 compatibility

// ===== TYPES & INTERFACES =====

export type Theme = 'light' | 'dark' | 'system';
export type ViewMode = 'conversation' | 'practice' | 'settings' | 'analytics';

export interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  duration?: number; // in milliseconds, undefined = persistent
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ModalState {
  isOpen: boolean;
  type: 'settings' | 'feedback' | 'help' | 'confirmation' | 'error' | null;
  title?: string;
  content?: string;
  data?: unknown;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface LoadingState {
  isLoading: boolean;
  operation: string;
  progress?: number; // 0-100
  message?: string;
}

export interface LayoutState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  headerVisible: boolean;
  footerVisible: boolean;
  fullscreen: boolean;
}

export interface AccessibilityState {
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';
  screenReaderMode: boolean;
}

export interface PreferencesState {
  autoSave: boolean;
  confirmOnExit: boolean;
  soundEnabled: boolean;
  animationsEnabled: boolean;
  compactMode: boolean;
  showTooltips: boolean;
}

// ===== STORE INTERFACE =====

export interface UIStore {
  // Core UI state
  theme: Theme;
  viewMode: ViewMode;
  
  // Component states
  notifications: NotificationState[];
  modal: ModalState;
  loading: LoadingState;
  layout: LayoutState;
  
  // User preferences
  accessibility: AccessibilityState;
  preferences: PreferencesState;
  
  // Navigation state
  currentPath: string;
  previousPath: string;
  breadcrumbs: Array<{ label: string; path: string }>;
  
  // Responsive state
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  
  // Focus and interaction state
  focusedElement: string | null;
  activeTooltip: string | null;
  draggedElement: string | null;
  
  // Theme actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  
  // View actions
  setViewMode: (mode: ViewMode) => void;
  navigateTo: (path: string, label?: string) => void;
  goBack: () => void;
  
  // Notification actions
  addNotification: (notification: Omit<NotificationState, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Modal actions
  openModal: (modal: Omit<ModalState, 'isOpen'>) => void;
  closeModal: () => void;
  confirmModal: () => void;
  
  // Loading actions
  setLoading: (loading: boolean, operation?: string, message?: string) => void;
  setLoadingProgress: (progress: number) => void;
  
  // Layout actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapse: () => void;
  setFullscreen: (fullscreen: boolean) => void;
  toggleFullscreen: () => void;
  
  // Accessibility actions
  setAccessibility: (settings: Partial<AccessibilityState>) => void;
  toggleHighContrast: () => void;
  setFontSize: (size: AccessibilityState['fontSize']) => void;
  
  // Preference actions
  setPreferences: (preferences: Partial<PreferencesState>) => void;
  togglePreference: (key: keyof PreferencesState) => void;
  
  // Responsive actions
  updateScreenSize: (width: number, height: number) => void;
  
  // Focus and interaction actions
  setFocusedElement: (elementId: string | null) => void;
  setActiveTooltip: (tooltipId: string | null) => void;
  setDraggedElement: (elementId: string | null) => void;
  
  // Utility actions
  reset: () => void;
  exportState: () => object;
  importState: (state: Partial<UIStore>) => void;
}

// ===== DEFAULT VALUES =====

const DEFAULT_LAYOUT_STATE: LayoutState = {
  sidebarOpen: false,
  sidebarCollapsed: false,
  headerVisible: true,
  footerVisible: true,
  fullscreen: false,
};

const DEFAULT_ACCESSIBILITY_STATE: AccessibilityState = {
  highContrast: false,
  reducedMotion: false,
  fontSize: 'medium',
  screenReaderMode: false,
};

const DEFAULT_PREFERENCES_STATE: PreferencesState = {
  autoSave: true,
  confirmOnExit: true,
  soundEnabled: true,
  animationsEnabled: true,
  compactMode: false,
  showTooltips: true,
};

const DEFAULT_MODAL_STATE: ModalState = {
  isOpen: false,
  type: null,
};

const DEFAULT_LOADING_STATE: LoadingState = {
  isLoading: false,
  operation: '',
};

// ===== UTILITY FUNCTIONS =====

const getResponsiveState = (width: number) => ({
  isMobile: width < 768,
  isTablet: width >= 768 && width < 1024,
  isDesktop: width >= 1024,
});

// ===== STORE IMPLEMENTATION =====

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        theme: 'system' as Theme,
        viewMode: 'practice' as ViewMode,
        
        notifications: [],
        modal: DEFAULT_MODAL_STATE,
        loading: DEFAULT_LOADING_STATE,
        layout: DEFAULT_LAYOUT_STATE,
        
        accessibility: DEFAULT_ACCESSIBILITY_STATE,
        preferences: DEFAULT_PREFERENCES_STATE,
        
        currentPath: '/practice',
        previousPath: '/',
        breadcrumbs: [{ label: 'Practice', path: '/practice' }],
        
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        screenWidth: 1024,
        screenHeight: 768,
        
        focusedElement: null,
        activeTooltip: null,
        draggedElement: null,
        
        // Theme actions
        setTheme: (theme: Theme) => {
          set((state) => {
            state.theme = theme;
          });
        },
        
        toggleTheme: () => {
          set((state) => {
            const themes: Theme[] = ['light', 'dark', 'system'];
            const currentIndex = themes.indexOf(state.theme);
            const nextIndex = (currentIndex + 1) % themes.length;
            state.theme = themes[nextIndex];
          });
        },
        
        // View actions
        setViewMode: (mode: ViewMode) => {
          set((state) => {
            state.viewMode = mode;
          });
        },
        
        navigateTo: (path: string, label?: string) => {
          set((state) => {
            state.previousPath = state.currentPath;
            state.currentPath = path;
            
            if (label) {
              const breadcrumb = { label, path };
              const existingIndex = state.breadcrumbs.findIndex(b => b.path === path);
              
              if (existingIndex >= 0) {
                // Remove items after the existing breadcrumb
                state.breadcrumbs = state.breadcrumbs.slice(0, existingIndex + 1);
              } else {
                // Add new breadcrumb
                state.breadcrumbs.push(breadcrumb);
                
                // Keep max 5 breadcrumbs
                if (state.breadcrumbs.length > 5) {
                  state.breadcrumbs = state.breadcrumbs.slice(-5);
                }
              }
            }
          });
        },
        
        goBack: () => {
          const { previousPath } = get();
          if (previousPath) {
            get().navigateTo(previousPath);
          }
        },
        
        // Notification actions
        addNotification: (notification) => {
          set((state) => {
            const newNotification: NotificationState = {
              ...notification,
              id: `notification-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              timestamp: new Date(),
            };
            
            state.notifications.push(newNotification);
            
            // Auto-remove after duration
            if (notification.duration) {
              setTimeout(() => {
                get().removeNotification(newNotification.id);
              }, notification.duration);
            }
            
            // Keep max 10 notifications
            if (state.notifications.length > 10) {
              state.notifications = state.notifications.slice(-10);
            }
          });
        },
        
        removeNotification: (id: string) => {
          set((state) => {
            state.notifications = state.notifications.filter(n => n.id !== id);
          });
        },
        
        clearNotifications: () => {
          set((state) => {
            state.notifications = [];
          });
        },
        
        // Modal actions
        openModal: (modal) => {
          set((state) => {
            state.modal = {
              ...modal,
              isOpen: true,
            };
          });
        },
        
        closeModal: () => {
          set((state) => {
            const onCancel = state.modal.onCancel;
            state.modal = DEFAULT_MODAL_STATE;
            onCancel?.();
          });
        },
        
        confirmModal: () => {
          set((state) => {
            const onConfirm = state.modal.onConfirm;
            state.modal = DEFAULT_MODAL_STATE;
            onConfirm?.();
          });
        },
        
        // Loading actions
        setLoading: (loading: boolean, operation = '', message = '') => {
          set((state) => {
            state.loading = {
              isLoading: loading,
              operation,
              message,
              progress: loading ? state.loading.progress : undefined,
            };
          });
        },
        
        setLoadingProgress: (progress: number) => {
          set((state) => {
            if (state.loading.isLoading) {
              state.loading.progress = Math.max(0, Math.min(100, progress));
            }
          });
        },
        
        // Layout actions
        toggleSidebar: () => {
          set((state) => {
            state.layout.sidebarOpen = !state.layout.sidebarOpen;
          });
        },
        
        setSidebarOpen: (open: boolean) => {
          set((state) => {
            state.layout.sidebarOpen = open;
          });
        },
        
        toggleSidebarCollapse: () => {
          set((state) => {
            state.layout.sidebarCollapsed = !state.layout.sidebarCollapsed;
          });
        },
        
        setFullscreen: (fullscreen: boolean) => {
          set((state) => {
            state.layout.fullscreen = fullscreen;
          });
        },
        
        toggleFullscreen: () => {
          set((state) => {
            state.layout.fullscreen = !state.layout.fullscreen;
          });
        },
        
        // Accessibility actions
        setAccessibility: (settings: Partial<AccessibilityState>) => {
          set((state) => {
            Object.assign(state.accessibility, settings);
          });
        },
        
        toggleHighContrast: () => {
          set((state) => {
            state.accessibility.highContrast = !state.accessibility.highContrast;
          });
        },
        
        setFontSize: (size: AccessibilityState['fontSize']) => {
          set((state) => {
            state.accessibility.fontSize = size;
          });
        },
        
        // Preference actions
        setPreferences: (preferences: Partial<PreferencesState>) => {
          set((state) => {
            Object.assign(state.preferences, preferences);
          });
        },
        
        togglePreference: (key: keyof PreferencesState) => {
          set((state) => {
            (state.preferences as Record<string, boolean>)[key] = !(state.preferences as Record<string, boolean>)[key];
          });
        },
        
        // Responsive actions
        updateScreenSize: (width: number, height: number) => {
          set((state) => {
            state.screenWidth = width;
            state.screenHeight = height;
            
            const responsive = getResponsiveState(width);
            state.isMobile = responsive.isMobile;
            state.isTablet = responsive.isTablet;
            state.isDesktop = responsive.isDesktop;
          });
        },
        
        // Focus and interaction actions
        setFocusedElement: (elementId: string | null) => {
          set((state) => {
            state.focusedElement = elementId;
          });
        },
        
        setActiveTooltip: (tooltipId: string | null) => {
          set((state) => {
            state.activeTooltip = tooltipId;
          });
        },
        
        setDraggedElement: (elementId: string | null) => {
          set((state) => {
            state.draggedElement = elementId;
          });
        },
        
        // Utility actions
        reset: () => {
          set(() => ({
            theme: 'system' as Theme,
            viewMode: 'practice' as ViewMode,
            notifications: [],
            modal: DEFAULT_MODAL_STATE,
            loading: DEFAULT_LOADING_STATE,
            layout: DEFAULT_LAYOUT_STATE,
            accessibility: DEFAULT_ACCESSIBILITY_STATE,
            preferences: DEFAULT_PREFERENCES_STATE,
            currentPath: '/practice',
            previousPath: '/',
            breadcrumbs: [{ label: 'Practice', path: '/practice' }],
            isMobile: false,
            isTablet: false,
            isDesktop: true,
            screenWidth: 1024,
            screenHeight: 768,
            focusedElement: null,
            activeTooltip: null,
            draggedElement: null,
          }));
        },
        
        exportState: () => {
          const state = get();
          return {
            theme: state.theme,
            viewMode: state.viewMode,
            layout: state.layout,
            accessibility: state.accessibility,
            preferences: state.preferences,
          };
        },
        
        importState: (importedState: Partial<UIStore>) => {
          set((state) => {
            Object.assign(state, importedState);
          });
        },
      })),
      {
        name: 'ui-store',
        // Only persist certain parts of the state
        partialize: (state) => ({
          theme: state.theme,
          layout: state.layout,
          accessibility: state.accessibility,
          preferences: state.preferences,
        }),
      }
    ),
    {
      name: 'ui-store',
    }
  )
);

// ===== SELECTORS =====

export const useTheme = () => useUIStore(state => state.theme);
export const useViewMode = () => useUIStore(state => state.viewMode);
export const useNotifications = () => useUIStore(state => state.notifications);
export const useModal = () => useUIStore(state => state.modal);
export const useLoading = () => useUIStore(state => state.loading);
export const useLayout = () => useUIStore(state => state.layout);
export const useAccessibility = () => useUIStore(state => state.accessibility);
export const usePreferences = () => useUIStore(state => state.preferences);

// Computed selectors
export const useIsLoading = () => useUIStore(state => state.loading.isLoading);
export const useIsMobile = () => useUIStore(state => state.isMobile);
export const useIsModalOpen = () => useUIStore(state => state.modal.isOpen);
export const useHasNotifications = () => useUIStore(state => state.notifications.length > 0);

// Stable navigation selector
const navigationSelector = (state: UIStore) => ({
  currentPath: state.currentPath,
  previousPath: state.previousPath,
  breadcrumbs: state.breadcrumbs,
  canGoBack: !!state.previousPath,
});

export const useNavigation = () => useUIStore(navigationSelector);

// Stable responsive selector
const responsiveSelector = (state: UIStore) => ({
  isMobile: state.isMobile,
  isTablet: state.isTablet,
  isDesktop: state.isDesktop,
  screenWidth: state.screenWidth,
  screenHeight: state.screenHeight,
});

export const useResponsive = () => useUIStore(responsiveSelector);