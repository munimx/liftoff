/**
 * JWT access token payload claims.
 */
export interface JwtAccessPayload {
  sub: string;
  email: string;
}

/**
 * JWT refresh token payload claims.
 */
export interface JwtRefreshPayload {
  sub: string;
  jti: string;
  iat?: number;
  exp?: number;
}

/**
 * Access and refresh token pair.
 */
export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Principal extracted from a valid refresh token.
 */
export interface RefreshTokenPrincipal {
  userId: string;
  tokenId: string;
}
