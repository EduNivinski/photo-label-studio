# Security Hardening Implementation

## Overview

This document describes the security hardening implemented across all Supabase Edge Functions and database functions to protect against common vulnerabilities while maintaining full backward compatibility with the Google Drive integration.

## What Was Changed

### 1. Server-Side Input Validation (Zod)

All edge functions now validate input using Zod schemas before processing:

- **labels-apply-batch**: Validates `assetId`, `toAdd[]`, `toRemove[]`
- **get-thumb-urls**: Validates `fileIds[]` (max 100 items)
- **library-list-unified**: Validates pagination, filters, and search parameters
- **google-drive-auth**: Validates action types and parameters

**Impact**: Invalid requests are rejected with generic error messages (no information leakage).

### 2. Server-Side Rate Limiting

Rate limits are enforced at the database level using the `security.can_call()` function:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `thumb-open` | 60 req | 1 minute |
| `library-list-unified` | 120 req | 5 minutes |
| `labels-apply-batch` | 60 req | 5 minutes |
| `google-drive-auth` | 10 req | 1 hour |
| `get-thumb-urls` | 120 req | 5 minutes |

**Impact**: Exceeding limits returns `429` with generic message.

### 3. SECURITY DEFINER Guards

All database functions that accept `p_user_id` now call `security.assert_caller_is(p_user_id)` to prevent privilege escalation:

- `get_google_drive_token_status`
- `validate_google_drive_access`
- `get_google_drive_connection_info`
- `get_google_drive_connection_status`

**Impact**: Functions verify that JWT claim matches the requested user ID.

### 4. Safe Error Handling

Error responses now:
- Never expose stack traces, SQL errors, or internal structure
- Use generic messages like "Unable to process request"
- Log full details server-side only

**Impact**: Attackers cannot learn about internal structure from error messages.

### 5. Thumbnail URL Signatures with Nonce + TTL

`thumb-open` now uses enhanced signatures:

**New Format**: `{ uid, fileId, exp, nonce }`
- `exp`: Unix timestamp (expires in 1 hour)
- `nonce`: 16-byte random value (single-use)

**Replay Protection**: 
- Each nonce can only be used once
- Verified via `security.consume_nonce_once()` function
- Expired signatures are rejected

**Legacy Support**: 
- Old signatures (without `exp`/`nonce`) are accepted until **2025-10-12**
- Legacy requests include deprecation headers:
  - `Deprecation: true`
  - `Sunset: <date>`
- After sunset, legacy signatures return `410 Gone`

**Impact**: Prevents replay attacks and limits signature lifetime.

### 6. Security Event Logging

Server-side events are logged to `security.events` table:

- `RATE_LIMITED`: When rate limit is exceeded
- `VALIDATION_FAIL`: When input validation fails (implicit)
- `REPLAY`: When signature nonce is reused
- `EXPIRED`: When signature has expired
- `LEGACY_SIG_ACCEPTED`: When old signature format is used

**PII Protection**: Tokens, keys, and full queries are never logged.

### 7. Encryption Key Versioning Support

Token encryption now supports key rotation (not yet active):

**Environment Variables** (future use):
```bash
TOKEN_ENC_KEYS='{"v1":"hex_key_1","v2":"hex_key_2"}'
TOKEN_ENC_ACTIVE_KID="v2"
```

**Envelope Format**: `{ kid, iv, c, tag }`

**Impact**: Enables zero-downtime key rotation in the future.

## Environment Variables

### Required (already configured):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `THUMB_SIGNING_KEY`
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GDRIVE_REDIRECT_URI`
- `CORS_ALLOWED_ORIGINS`

### Future (for key rotation):
- `TOKEN_ENC_KEYS` (JSON object with key IDs)
- `TOKEN_ENC_ACTIVE_KID` (active key ID)

## Database Schema Changes

### New Schema: `security`

#### Tables:
1. **`security.rate_limit_hits`**: Tracks rate limit hits per user/IP/endpoint
2. **`security.events`**: Server-side security event log
3. **`security.signature_nonce`**: Single-use nonces for replay protection

#### Functions:
1. **`security.can_call()`**: Rate limit check + enforcement
2. **`security.consume_nonce_once()`**: Nonce verification (single-use)
3. **`security.assert_caller_is()`**: JWT caller verification
4. **`security.cleanup_expired_nonces()`**: Periodic cleanup (run hourly)

### RLS Policies:
All `security.*` tables have RLS enabled with **no policies** = access only via SECURITY DEFINER functions.

## Backward Compatibility

### ✅ API Contracts Unchanged
All endpoints accept the same parameters and return the same response format.

### ✅ Google Drive OAuth Flow Unchanged
No changes to OAuth parameters, redirects, or token handling.

### ✅ Existing Thumbnail URLs Valid
Old signature format works until **2025-10-12** with deprecation warnings.

### ✅ No Client Changes Required
All security enforcement is server-side; clients continue working as-is.

## Testing Checklist

### Rate Limiting
- [ ] Exceed limit on each endpoint → verify `429` response
- [ ] Wait for window to reset → verify requests succeed

### Input Validation
- [ ] Send invalid JSON → verify `400` with generic message
- [ ] Send missing required fields → verify `400`
- [ ] Send oversized arrays → verify `400`

### Thumbnail Signatures
- [ ] Use valid new signature → verify `200`
- [ ] Use expired signature → verify `401`
- [ ] Reuse nonce → verify `403`
- [ ] Use legacy signature → verify `200` with `Deprecation` header
- [ ] Try legacy after sunset date → verify `410`

### SECURITY DEFINER Guards
- [ ] Call function with mismatched `p_user_id` → verify `403`
- [ ] Call function with correct `p_user_id` → verify success

### Error Handling
- [ ] Trigger internal error → verify generic message (no stack trace)
- [ ] Check server logs → verify detailed error logged

## Sunset Plan for Legacy Signatures

1. **Now → 2025-10-12**: Legacy signatures accepted with warnings
2. **2025-10-12**: Legacy signatures return `410 Gone`
3. **Client Action Required**: Clients must refresh thumbnail URLs after 1 hour (they already do this automatically via TTL)

## Monitoring

### Security Events to Monitor:
- High rate of `RATE_LIMITED` events → potential DoS
- `REPLAY` events → attempted replay attack
- High rate of `LEGACY_SIG_ACCEPTED` → clients not refreshing URLs

### Query Examples:

```sql
-- Rate limiting events by endpoint
SELECT endpoint, count(*), max(ts)
FROM security.events
WHERE kind = 'RATE_LIMITED' AND ts > now() - interval '1 hour'
GROUP BY endpoint;

-- Replay attempts
SELECT user_id, count(*), details
FROM security.events
WHERE kind = 'REPLAY' AND ts > now() - interval '1 day'
GROUP BY user_id, details;

-- Legacy signature usage
SELECT count(*), date_trunc('day', ts)
FROM security.events
WHERE kind = 'LEGACY_SIG_ACCEPTED'
GROUP BY 2 ORDER BY 2 DESC;
```

### Cleanup Maintenance:

Run hourly (e.g., via cron or pg_cron):
```sql
SELECT security.cleanup_expired_nonces();
```

## Security Posture Summary

### ✅ Mitigated Threats:
1. **Injection Attacks**: Zod validation rejects malformed input
2. **DoS/Abuse**: Rate limiting prevents excessive requests
3. **Replay Attacks**: Nonce verification prevents reuse
4. **Privilege Escalation**: SECURITY DEFINER guards enforce user context
5. **Information Leakage**: Safe error handling hides internal details
6. **Token Exposure**: Encryption keys never logged, no verbose errors

### ⚠️ Remaining Risks:
1. **Auth Configuration**: OTP expiry too long (Supabase config)
2. **Password Protection**: Leaked password protection disabled (Supabase config)
3. **Postgres Version**: Security patches available (requires upgrade)

### 📋 Recommendations:
1. Enable leaked password protection in Supabase dashboard
2. Reduce OTP expiry time in auth settings
3. Schedule Postgres upgrade for security patches
4. Set up monitoring alerts for security events
5. Implement CAPTCHA on public endpoints if abuse occurs

## Questions?

For implementation details, see:
- `supabase/functions/_shared/http.ts` - Auth & error handling
- `supabase/functions/_shared/rate-limit.ts` - Rate limiting
- `supabase/functions/_shared/validation.ts` - Zod schemas
- `supabase/migrations/<latest>` - SQL schema changes
