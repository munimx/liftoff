# Connecting Your DigitalOcean Account to Liftoff

Liftoff provisions infrastructure **directly in your DigitalOcean account**. To do this it uses a Personal Access Token that you create and control. Liftoff encrypts it immediately on receipt and never returns it through any API response.

There is no AWS, no IAM, and no STS in this project.

---

## How It Works

```
Your DigitalOcean Account              Liftoff Platform
          │                                   │
          │  1. You create a DO Personal      │
          │     Access Token (read + write)   │
          │     in the DO console             │
          │                                   │
          │  2. You paste the token into      │
          │     the Liftoff dashboard         │
          │──────────────────────────────────▶│
          │                                   │
          │  3. Liftoff validates the token:  │
          │     GET /v2/account               │
          │◀──────────────────────────────────│
          │                                   │
          │  4. Liftoff encrypts the token    │
          │     (AES-256-GCM) and stores it   │
          │     in the platform database.     │
          │     The plaintext is gone.        │
          │                                   │
          │  5. Per deployment:               │
          │     token decrypted in memory →   │
          │     passed to Pulumi subprocess   │
          │     as DIGITALOCEAN_TOKEN env var │
          │     (never written to disk)       │
          │──────────────────────────────────▶│
          │  Pulumi creates resources         │
          │  in your DO account               │
```

---

## Step 1 — Create a DO Personal Access Token

1. Log in to [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. Go to **API → Tokens → Generate New Token**
3. Fill in:
   - **Name:** `liftoff-deploy` (or any name you'll recognise)
   - **Expiration:** No expiry (or set a rotation schedule you control)
   - **Scopes:** Select **Full Access** (read + write)
     - Liftoff needs write access to create App Platform apps, DOCR repositories,
       Managed Databases, and Spaces buckets in your account.
4. Click **Generate Token**
5. **Copy the token immediately** — it is shown only once.
   It starts with `dop_v1_`.

> **Minimum required scopes (if you prefer to restrict):**
> `app:create`, `app:read`, `app:update`, `app:delete`,
> `registry:create`, `registry:read`, `registry:delete`,
> `database:create`, `database:read`, `database:delete`,
> `space:create`, `space:read`, `space:delete`

---

## Step 2 — Connect the Account in Liftoff

1. Log in to the Liftoff dashboard
2. Go to **Settings → DigitalOcean Accounts → Connect Account**
3. Fill in:
   - **DO API Token:** paste the `dop_v1_...` token
   - **Region:** select your preferred DO region (default: `nyc3`)
4. Click **Connect**

Liftoff immediately calls `GET https://api.digitalocean.com/v2/account` with your token to verify it is valid. If the call succeeds, the account is saved with `validatedAt` set and a green ✅ badge appears.

Your token is encrypted with AES-256-GCM before the record is written to the database. It is never returned in any API response.

---

## Step 3 — Use the Account in an Environment

When creating an environment (Project → Add Environment), select the connected DO account from the dropdown. Liftoff will use that account's token when Pulumi provisions infrastructure for that environment.

---

## Validating an Existing Connection

If you rotate your token or suspect it has expired:

1. Dashboard → **Settings → DigitalOcean Accounts**
2. Click **Validate** next to the account
3. Liftoff re-calls `/v2/account` with the stored (decrypted) token
4. If valid: `validatedAt` is updated
5. If invalid: update the token using the **Update Token** button

---

## Rotating Your Token

If you need to replace the token (e.g., after a security incident):

1. In the DO console: revoke the old token and generate a new one
2. In the Liftoff dashboard → Settings → DigitalOcean Accounts → **Update Token**
3. Paste the new token and save — Liftoff re-validates immediately

---

## Disconnecting an Account

1. Delete or move all environments that use this DO account first
   (Liftoff will warn you if active environments reference the account)
2. Settings → DigitalOcean Accounts → **Delete**
3. Liftoff removes the encrypted record from the database
4. Optionally revoke the token in the DO console

---

## Security Notes

| Concern | How it is handled |
|---------|------------------|
| Token storage | AES-256-GCM encrypted, key from `ENCRYPTION_KEY` env var |
| Token in API responses | Never — the response DTO excludes `doToken` |
| Token in logs | Never — the API scrubs credentials before logging |
| Token in Pulumi subprocess | Set as `DIGITALOCEAN_TOKEN` env var in the subprocess only; not written to disk |
| Token rotation | Supported — update via dashboard at any time |
| Revocation | Delete the DO account record in Liftoff, then revoke in DO console |

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `DO_ACCOUNT_INVALID_TOKEN` on connect | Token is not valid or was revoked | Generate a new token in the DO console |
| `DO_ACCOUNT_INSUFFICIENT_PERMISSIONS` | Token scope is too narrow | Regenerate with Full Access or the minimum scopes listed above |
| Validation passes but Pulumi fails with 401 | Token was revoked after being saved | Rotate the token in the dashboard |
| `DO_ACCOUNT_NOT_FOUND` | Account ID in request does not belong to your user | Check you are logged in to the correct Liftoff account |

---

## What Liftoff Creates in Your Account

Per environment (based on your `liftoff.yml`):

| Resource | DO Service | Always? |
|----------|-----------|---------|
| Container app | App Platform | ✅ Yes |
| DOCR credentials | Container Registry | ✅ Yes |
| Managed PostgreSQL cluster | Managed Databases | Only if `database.enabled: true` |
| Spaces bucket | Spaces | Only if `storage.enabled: true` |

All resources are tagged with:
```
liftoff-project:  <project-name>
liftoff-environment: <environment-name>
liftoff-managed: true
```

You can find them in your DO console under their respective services. Resources are destroyed when you use **Liftoff → Environment → Infrastructure → Destroy**.
