# API Key Management System

## Overview

The API Key Management System allows cohort managers to create and manage API keys for programmatic access to the ScanLab API. This system provides secure authentication for external applications while maintaining proper access controls and usage tracking.

## Key Concepts

### API Keys
- **Purpose**: Authenticate external applications without requiring user credentials
- **Scope**: Each API key belongs to a specific cohort
- **Format**: `slk_{prefix}_{secret}` (e.g., `slk_7acde96d_ef9e8e71ea53637358423dc3e2981a3a17e0e9d49edf887b1cc272031883104d`)
- **Security**: Keys are hashed using bcrypt with SHA-256 pre-hashing
- **Inheritance**: API keys inherit all permissions granted to their cohort

### Authentication Flow
1. Client sends request with `X-API-Key` header
2. System validates API key format and existence
3. System checks if API key is active and not expired
4. **System validates cohort access control** (new security layer)
5. System applies rate limiting (global API key limits)
6. System validates cohort permissions for specific endpoints
7. Request proceeds if all checks pass

## Database Schema

### ApiKeys Table
```sql
CREATE TABLE "ApiKeys" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "keyPrefix" VARCHAR(10) UNIQUE NOT NULL,
    "keyHash" VARCHAR(255) NOT NULL,
    "cohortId" INTEGER NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "expiresAt" TIMESTAMPTZ,
    "lastUsedAt" TIMESTAMPTZ,
    "rateLimit" INTEGER DEFAULT 1000,
    "rateLimitWindow" INTEGER DEFAULT 3600,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### ApiKeyUsage Table
```sql
CREATE TABLE "ApiKeyUsage" (
    "id" SERIAL PRIMARY KEY,
    "apiKeyId" INTEGER NOT NULL,
    "endpoint" VARCHAR(500) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "timestamp" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT
);
```

## API Endpoints

### Create API Key
```http
POST /cohorts/{cohortId}/api-keys
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "name": "My App Integration",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "My App Integration",
    "keyPrefix": "slk_7acde96d",
    "fullKey": "slk_7acde96d_ef9e8e71ea53637358423dc3e2981a3a17e0e9d49edf887b1cc272031883104d",
    "cohortId": 46,
    "isActive": true,
    "rateLimit": 1000,
    "expiresAt": "2024-12-31T23:59:59Z"
  }
}
```

⚠️ **Important**: The `fullKey` is only returned once during creation. Store it securely!

### List API Keys
```http
GET /cohorts/{cohortId}/api-keys
Authorization: Bearer {jwt_token}
```

### Get API Key Details
```http
GET /api-keys/{keyId}
Authorization: Bearer {jwt_token}
```

### Deactivate API Key
```http
PATCH /api-keys/{keyId}/deactivate
Authorization: Bearer {jwt_token}
```

### Activate API Key
```http
PATCH /api-keys/{keyId}/activate
Authorization: Bearer {jwt_token}
```

### Delete API Key
```http
DELETE /api-keys/{keyId}
Authorization: Bearer {jwt_token}
```

### Regenerate API Key
```http
POST /api-keys/{keyId}/regenerate
Authorization: Bearer {jwt_token}

{
  "name": "Updated Integration Name"
}
```

## Security Features

### Cohort Access Control (New)
- **Cohort Isolation**: API keys can ONLY access data from their associated cohort
- **Automatic Validation**: Middleware automatically validates cohort access on cohort-related endpoints
- **Fail Secure**: Returns 403 errors when API key attempts to access other cohorts' data
- **Example**: API key for cohort 46 cannot access `/v1/cohorts/43` or `/v1/cohortStudents?cohortId=43`

### Key Generation
- **Cryptographically secure**: Uses Node.js `crypto.randomBytes()`
- **Collision prevention**: Retries generation if prefix already exists
- **Prefix system**: Enables fast database lookups without exposing full key

### Key Storage
- **Never stored plaintext**: Only hashed versions stored in database
- **SHA-256 + bcrypt**: Pre-hash with SHA-256 to avoid bcrypt's 72-byte limit
- **Salt rounds**: Uses 12 salt rounds for bcrypt hashing

### Rate Limiting
- **Per-API-key limits**: Default 1000 requests per hour
- **Configurable windows**: Default 1-hour sliding window
- **Headers included**: Rate limit info in response headers
- **429 responses**: When limits exceeded with retry-after timing

### Usage Tracking
- **Every request logged**: Method, endpoint, status code, timestamp
- **IP address tracking**: For security auditing
- **User agent logging**: For identifying client applications

## Authorization

### Who Can Manage API Keys
- **Cohort Managers**: Can manage API keys for their assigned cohorts
- **Admins**: Can manage API keys for any cohort

### Who Can Manage Endpoint Permissions
- **Admins Only**: Only administrators can grant, revoke, or modify endpoint permissions
- **Cohort Managers**: Can only view which endpoints their cohort has access to

### Permission Inheritance
- API keys **inherit** all endpoint permissions granted to their cohort
- No individual API key permissions - all controlled at cohort level
- Simplifies management and ensures consistency

## Common Operations

### Creating an API Key (Frontend)
```javascript
async function createApiKey(cohortId, name, expiresAt) {
  const response = await fetch(`/cohorts/${cohortId}/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({ name, expiresAt })
  })
  
  const result = await response.json()
  if (result.success) {
    // IMPORTANT: Save the fullKey immediately - it won't be shown again
    return result.data.fullKey
  }
  throw new Error(result.error)
}
```

### Using an API Key (Client Application)
```javascript
async function callScanLabAPI(apiKey, endpoint) {
  const response = await fetch(`https://api.scanlab.com${endpoint}`, {
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    }
  })
  
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`)
  }
  
  return response.json()
}
```

### Checking API Key Usage
```javascript
async function getApiKeyUsage(apiKeyId) {
  const response = await fetch(`/api-keys/${apiKeyId}/usage`, {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  })
  return response.json()
}
```

## Error Handling

### Common Error Codes
- **401 Unauthorized**: Invalid or missing API key
- **403 Forbidden**: API key lacks permission for endpoint OR attempting to access another cohort's data
- **429 Too Many Requests**: Rate limit exceeded
- **404 Not Found**: API key or endpoint doesn't exist

### Error Response Format
```json
{
  "success": false,
  "error": "Access denied: Cohort does not have permission for this endpoint",
  "code": "NO_COHORT_PERMISSION"
}
```

**New Cohort Access Error:**
```json
{
  "success": false,
  "error": "Access denied: API key can only access data from its associated cohort",
  "code": "COHORT_ACCESS_DENIED"
}
```

## Monitoring & Maintenance

### Health Checks
- Monitor API key usage patterns
- Track rate limit violations
- Watch for unusual access patterns

### Database Maintenance
- Archive old usage logs periodically
- Monitor API key expiration dates
- Clean up inactive/expired keys

### Security Audits
- Review API key access logs
- Monitor for suspicious IP addresses
- Check for unusual endpoint access patterns

## Troubleshooting

### "API Key Invalid" Error
1. Check API key format: `slk_{prefix}_{secret}`
2. Verify API key is active (`isActive = true`)
3. Check expiration date
4. Ensure correct `X-API-Key` header format

### "Permission Denied" Error
1. **Check cohort access**: Ensure API key is accessing its own cohort's data
2. Verify cohort has permission for endpoint
3. Check if endpoint is active for API access
4. Confirm API key belongs to correct cohort

### Rate Limit Issues
1. Check current usage against limits
2. Review `rateLimit` and `rateLimitWindow` settings
3. Consider increasing limits or implementing request queuing

### Performance Issues
1. Monitor database query performance on prefix lookups
2. Check bcrypt hashing performance
3. Review usage tracking table size

## Best Practices

### For Development Teams
- Always use HTTPS in production
- Never log full API keys
- Implement proper error handling
- Use descriptive API key names
- Set appropriate expiration dates

### For Cohort Managers
- Use descriptive names for API keys
- Set expiration dates for security
- Regularly review and clean up unused keys
- Monitor usage patterns for anomalies
- Deactivate keys when no longer needed

### For Operations Teams
- Monitor rate limit usage
- Set up alerts for unusual patterns
- Regularly review security logs
- Backup API key configurations
- Document key purposes and owners