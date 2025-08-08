'use client';

import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface UINotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
}

interface UIStoreState {
  notifications: UINotification[];
  addNotification: (n: Omit<UINotification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

export const useUIStore = create<UIStoreState>((set, get) => ({
  notifications: [],
  addNotification: (n) => {
    const id = `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const notification: UINotification = { id, ...n };
    set((state) => ({ notifications: [...state.notifications, notification] }));

    if (n.duration && n.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, n.duration);
    }
  },
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id),
  })),
}));


