export const API_ROUTES = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
  },
  MESSENGER: {
    THREADS: '/messenger/threads',
    MESSAGES: (threadId: string) => `/messenger/threads/${threadId}/messages`,
    ALIVE: (threadId: string) => `/messenger/threads/${threadId}/alive`,
    REQUEST: '/messenger/request',
    ACCEPT: (threadId: string) => `/messenger/threads/${threadId}/accept`,
    REJECT: (threadId: string) => `/messenger/threads/${threadId}/reject`,
    READ: (threadId: string) => `/messenger/threads/${threadId}/read`,
  },
  PACKAGES: {
    SEARCH: '/packages/search',
  },
  BOOKINGS: {
    BASE: '/bookings',
    STATUS: (id: string) => `/bookings/${id}/status`,
    CANCEL: (id: string) => `/bookings/${id}/cancel`,
    DAMAGE: (id: string) => `/bookings/${id}/damage`,
  },
  VENDOR_PACKAGES: {
    BASE: '/vendor/packages',
    BY_ID: (id: string) => `/vendor/packages/${id}`,
    STATUS: (id: string) => `/vendor/packages/${id}/status`,
    IMAGES: (id: string) => `/vendor/packages/${id}/images`,
  },
  CUSTOMER: {
    PROFILE: '/customer/profile',
    DASHBOARD: '/customer/dashboard',
  },
  EVENT_CATEGORIES: '/event-categories',
  RFPS: {
    MY: '/rfps',
  },
  SERVICE_CATEGORIES: '/service-categories',
  NOTIFICATIONS: {
    BASE: '/notifications',
    READ_ALL: '/notifications/read-all',
  }
};
