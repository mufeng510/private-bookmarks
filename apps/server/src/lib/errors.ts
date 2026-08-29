import type { ErrorCode } from '@private-bookmarks/shared';

/** 带错误码的业务异常，统一由 app 错误处理器转换为 { error: { code, message } } */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }

  static authRequired(message = 'Authentication required'): AppError {
    return new AppError(401, 'AUTH_REQUIRED', message);
  }

  static invalidCredentials(message = 'Invalid username or password'): AppError {
    return new AppError(401, 'INVALID_CREDENTIALS', message);
  }

  static sessionExpired(message = 'Session expired'): AppError {
    return new AppError(401, 'SESSION_EXPIRED', message);
  }

  static invalidSyncToken(message = 'Sync token is invalid'): AppError {
    return new AppError(401, 'INVALID_SYNC_TOKEN', message);
  }

  static tokenRevoked(message = 'Sync token has been revoked'): AppError {
    return new AppError(401, 'TOKEN_REVOKED', message);
  }

  static rateLimited(message = 'Too many requests'): AppError {
    return new AppError(429, 'RATE_LIMITED', message);
  }

  static invalidUrl(message = 'Only http/https URLs are allowed'): AppError {
    return new AppError(400, 'INVALID_URL', message);
  }

  static invalidPayload(message = 'Invalid payload'): AppError {
    return new AppError(400, 'INVALID_PAYLOAD', message);
  }

  static forbiddenOrigin(message = 'Origin not allowed'): AppError {
    return new AppError(403, 'FORBIDDEN_ORIGIN', message);
  }

  static notFound(message = 'Not found'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }
}
