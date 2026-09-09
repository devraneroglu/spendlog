export interface User {
  id: string;
  email: string;
  fullName: string;
  telegramChatId?: number | null;
  isTelegramActive: boolean;
  roles?: string[];
  isAdmin?: boolean;
  hasCustomTelegramBot?: boolean;
  customTelegramBotUsername?: string | null;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  expiration?: string;
  user?: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}
