# Phase 2 — Authentication
## GitHub Copilot CLI Instructions

**Read `.github/copilot-instructions.md` before this file. All global rules apply.**  
**Phase 1 is complete. Do not recreate Phase 1 files.**

---

## Objective

Implement the full authentication system:
1. GitHub OAuth 2.0 login flow
2. JWT access tokens (15 min) + refresh tokens (7 days, HTTP-only cookie)
3. Token refresh endpoint
4. Logout (revoke refresh token)
5. User profile endpoint
6. Frontend: auth store, login page, route protection, Axios interceptors

---

## Backend — `apps/api/src/`

### AUTH MODULE — `src/auth/`

Replace the Phase 1 stub with full implementation.

---

**`src/auth/strategies/github.strategy.ts`**

```typescript
// Passport strategy for GitHub OAuth 2.0
// Uses passport-github2
// Profile fields needed: id, username, emails[0].value, displayName, photos[0].value
// validate() method:
//   1. Upsert user in DB via UsersService.findOrCreateFromGitHub()
//   2. Return the user object (Passport attaches it to req.user)
// Config from ConfigService: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL
// Scope: ['read:user', 'user:email', 'repo', 'write:repo_hook']
```

Full implementation requirements:
- Extend `PassportStrategy(Strategy, 'github')` from `passport-github2`
- Constructor injects `ConfigService` and `UsersService`
- `validate(accessToken, refreshToken, profile, done)` — upsert user, return `done(null, user)`
- Store the GitHub access token on the user (encrypted via `EncryptionService`) — needed for GitHub API calls later

---

**`src/auth/strategies/jwt.strategy.ts`**

```typescript
// Passport JWT strategy
// Extract token from Authorization: Bearer <token> header
// Validate payload: { sub: userId, email, iat, exp }
// Fetch user from DB by id — throw UnauthorizedException if not found or soft-deleted
// Return user object (attached to req.user by Passport)
```

---

**`src/auth/strategies/jwt-refresh.strategy.ts`**

```typescript
// Passport JWT strategy for refresh tokens
// Extract token from 'refreshToken' HTTP-only cookie (use ExtractJwt.fromExtractors)
// Validate payload: { sub: userId, jti: tokenId }
// Verify token exists in DB and is not revoked/expired
// Return { userId, tokenId }
```

---

**`src/auth/auth.service.ts`**

Implement these methods:

```typescript
// generateTokens(userId: string, email: string): Promise<{ accessToken, refreshToken }>
//   - Sign JWT access token: { sub: userId, email }, secret JWT_SECRET, expiresIn JWT_EXPIRES_IN
//   - Generate refresh token: { sub: userId, jti: uuid() }, secret JWT_REFRESH_SECRET, expiresIn JWT_REFRESH_EXPIRES_IN
//   - Hash refresh token with bcrypt (10 rounds)
//   - Store hashed token + expiry in refresh_tokens table
//   - Return plaintext tokens (only time the plaintext refresh token exists)

// refreshTokens(userId: string, tokenId: string): Promise<{ accessToken, refreshToken }>
//   - Find refresh token in DB by id
//   - Check not revoked and not expired
//   - Revoke old token (set revokedAt = now())
//   - Generate new token pair (rotation)
//   - Return new tokens

// revokeRefreshToken(tokenId: string): Promise<void>
//   - Set revokedAt = now() on the token record

// revokeAllUserTokens(userId: string): Promise<void>
//   - Set revokedAt = now() on all active tokens for user (used on logout)
```

---

**`src/auth/auth.controller.ts`**

```typescript
@Controller('auth')
@ApiTags('Auth')
export class AuthController {

  // GET /auth/github — initiate OAuth, mark @Public()
  // Uses @UseGuards(AuthGuard('github'))
  // No body needed; Passport redirects automatically

  // GET /auth/github/callback — OAuth callback, mark @Public()
  // Uses @UseGuards(AuthGuard('github'))
  // 1. Call authService.generateTokens(user.id, user.email)
  // 2. Set refresh token as HTTP-only cookie:
  //    res.cookie('refreshToken', refreshToken, {
  //      httpOnly: true, secure: NODE_ENV === 'production',
  //      sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000
  //    })
  // 3. Redirect to: `${FRONTEND_URL}/auth/callback?token=${accessToken}`

  // POST /auth/refresh — mark @Public()
  // Uses @UseGuards(AuthGuard('jwt-refresh'))
  // Rotates tokens, sets new cookie, returns new accessToken in body

  // DELETE /auth/logout — requires JwtAuthGuard
  // Revokes refresh token from cookie
  // Clears the cookie: res.clearCookie('refreshToken')
  // Returns 204 No Content
}
```

---

**`src/auth/auth.module.ts`**

```typescript
// Imports:
// - PassportModule.register({ defaultStrategy: 'jwt' })
// - JwtModule.registerAsync (reads JWT_SECRET and JWT_EXPIRES_IN from ConfigService)
// - UsersModule (for UsersService dependency)
// Provides: AuthService, GithubStrategy, JwtStrategy, JwtRefreshStrategy
// Exports: AuthService, JwtModule
```

---

### USERS MODULE — `src/users/`

**`src/users/users.service.ts`**

```typescript
// findOrCreateFromGitHub(githubProfile: GitHubProfile): Promise<User>
//   - upsert by githubId
//   - update: email, githubUsername, name, avatarUrl, githubToken (encrypted)
//   - create: all fields including externalId

// findById(id: string): Promise<User | null>
//   - include soft-delete filter: where { id, deletedAt: null }

// findByEmail(email: string): Promise<User | null>

// updateProfile(id: string, dto: UpdateProfileDto): Promise<User>
//   - only allow: name update

// deleteAccount(id: string): Promise<void>
//   - soft delete: set deletedAt = now()
//   - revoke all refresh tokens
```

**`src/users/users.controller.ts`**

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('Users')
export class UsersController {
  // GET /users/me → return current user (sanitized, no tokens)
  // PATCH /users/me → update name only; return updated user
  // DELETE /users/me → soft delete account + logout
}
```

**`src/users/dto/update-profile.dto.ts`** — `name?: string` (IsString, IsOptional, MaxLength 100)

**`src/users/users.module.ts`** — provides UsersService+UsersController, exports UsersService

---

### ENCRYPTION SERVICE — `src/common/services/encryption.service.ts`

Used to encrypt sensitive fields (GitHub token, webhook secret) stored in the DB.

```typescript
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer; // 32 bytes from ENCRYPTION_KEY env var (hex → Buffer)

  // encrypt(plaintext: string): string
  //   - Generate random 16-byte IV
  //   - AES-256-GCM encrypt
  //   - Return: iv:authTag:ciphertext (all hex, colon-separated)

  // decrypt(encrypted: string): string
  //   - Split on ':', extract iv + authTag + ciphertext
  //   - Decrypt and return plaintext

  // hash(value: string): Promise<string>
  //   - bcrypt hash with 10 rounds (for refresh tokens)

  // compare(value: string, hash: string): Promise<boolean>
  //   - bcrypt compare
}
```

Export from a `CommonModule` that is `@Global()`:
- `src/common/common.module.ts` — provides+exports EncryptionService
- Import CommonModule in AppModule

---

### UNIT TESTS

**`src/auth/auth.service.spec.ts`**
- Test `generateTokens()` creates DB record and returns tokens
- Test `refreshTokens()` revokes old token and returns new ones
- Test `refreshTokens()` throws if token is revoked
- Mock PrismaService and JwtService

**`src/users/users.service.spec.ts`**
- Test `findOrCreateFromGitHub()` creates user on first call
- Test `findOrCreateFromGitHub()` updates user on subsequent calls
- Mock PrismaService

---

## Frontend — `apps/web/`

### Auth Callback Page

**`app/(auth)/auth/callback/page.tsx`** — Client component:
```typescript
// Reads ?token= from URL query params
// Calls GET /api/v1/users/me with the token to fetch user profile
// Stores user + token in Zustand auth store
// Navigates to /dashboard
// Shows loading spinner while processing
// Shows error message if token is missing or invalid
```

### Auth Store Update

**`store/auth.store.ts`** — update Zustand store:
```typescript
interface AuthState {
  user: UserPublicDto | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;          // true while checking auth on page load
  setAuth: (user: UserPublicDto, token: string) => void;
  clearAuth: () => void;
  setToken: (token: string) => void;
  setLoading: (loading: boolean) => void;
}
// Do NOT use localStorage — memory only
// Token is lost on page refresh → use /auth/refresh (cookie) to rehydrate
```

### Auth Rehydration Hook

**`hooks/use-auth-rehydration.ts`** — custom hook called once in the dashboard layout:
```typescript
// On mount: call POST /api/v1/auth/refresh (uses HTTP-only cookie)
// If success: store new accessToken and user in Zustand
// If fail: redirect to /login
// Set isLoading = false after either outcome
```

### Axios Interceptors Update

**`lib/api-client.ts`** — finalize both interceptors:
```
Request interceptor:
  - Get accessToken from Zustand store
  - If present, set Authorization: Bearer header

Response interceptor:
  - On 401: attempt POST /auth/refresh
    - If refresh succeeds: update store, retry original request
    - If refresh fails: call clearAuth(), redirect to /login
  - All other errors: reject normally
```

### Route Protection

**`app/(dashboard)/layout.tsx`** — use the rehydration hook:
```typescript
// 'use client'
// Call useAuthRehydration() at top
// While isLoading: show full-page spinner
// If !isAuthenticated after loading: redirect to /login (use router.push)
// Otherwise: render sidebar layout with children
```

### Login Page Update

**`app/(auth)/login/page.tsx`** — final version:
```typescript
// If already authenticated (check store): redirect to /dashboard
// Otherwise: show Liftoff logo, tagline, "Sign in with GitHub" button
// Button href: `${process.env.NEXT_PUBLIC_API_URL}/api/auth/github`
// Include GitHub icon (Lucide doesn't have it — use an SVG inline or text)
```

### User Menu Component

**`components/layout/user-menu.tsx`** — dropdown in the dashboard header:
```typescript
// Show user avatar (next/image) and name
// Dropdown items: Profile settings, Sign out
// Sign out: call DELETE /api/v1/auth/logout, then clearAuth(), router.push('/login')
```

---

## Phase 2 Acceptance Tests

```bash
# Unit tests
pnpm --filter api test src/auth/
pnpm --filter api test src/users/
# All tests must pass

# TypeScript
pnpm typecheck
# Zero errors

# Manual E2E (see PHASE_2_HUMAN.md for steps)
# 1. Login with GitHub → redirected to /dashboard
# 2. User appears in DB: docker exec liftoff_postgres psql -U liftoff -d liftoff -c "SELECT github_username FROM users;"
# 3. Refresh token in DB: SELECT id, expires_at, revoked_at FROM refresh_tokens;
# 4. GET /api/v1/users/me returns user profile
# 5. POST /api/v1/auth/refresh rotates tokens
# 6. DELETE /api/v1/auth/logout clears cookie
```

## Notes for Copilot

- `passport-github2` types may need `@types/passport-github2` — already in devDependencies
- The GitHub strategy callback URL must exactly match the one registered in GitHub OAuth App settings
- The refresh token cookie must be `httpOnly: true` — never expose it to JavaScript
- Token rotation: every call to `/auth/refresh` must revoke the old token and issue a new one (prevent token reuse attacks)
- The `jti` (JWT ID) claim on the refresh token is the DB record ID — use this to look up and revoke the token
- `bcrypt.hash()` is async — always use `await`
- The `EncryptionService` uses `aes-256-gcm` — the key must be exactly 32 bytes. The env var is 64 hex chars → `Buffer.from(key, 'hex')`
- Frontend: token is in URL only momentarily — clear it from URL after storing: `router.replace('/dashboard')`
