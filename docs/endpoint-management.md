# Endpoint Management System

## Overview

The Endpoint Management System provides granular access control for API endpoints at the cohort level. It allows administrators to register API endpoints and control which cohorts can access specific functionality. This system ensures secure, controlled access to API resources.

## Key Concepts

### Endpoints
- **Definition**: Registered API routes that can be controlled for access
- **Registration**: Endpoints must be explicitly registered to be controlled
- **Activation**: Registered endpoints start as inactive and must be activated for API key access
- **Granular Control**: Permissions granted per cohort per endpoint

### Cohort-Level Permissions
- **Inheritance**: All API keys in a cohort inherit the cohort's endpoint permissions
- **Simplicity**: One permission setting per cohort per endpoint
- **Consistency**: Ensures all cohort members have identical access
- **Management**: Cohort managers control their cohort's permissions

### Permission Model
- **Deny by Default**: No permission = no access (secure by default)
- **Explicit Grants**: Permissions must be explicitly granted
- **Rate Limiting**: Optional per-cohort per-endpoint rate limits
- **Audit Trail**: All access attempts logged for security

## Database Schema

### Endpoints Table
```sql
CREATE TABLE "Endpoints" (
    "id" SERIAL PRIMARY KEY,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "pathPattern" VARCHAR(500) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "service" VARCHAR(100),
    "version" VARCHAR(20) DEFAULT 'v1',
    "requiresAuth" BOOLEAN DEFAULT true,
    "isActive" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("method", "pathPattern", "version")
);
```

### CohortEndpointPermissions Table
```sql
CREATE TABLE "CohortEndpointPermissions" (
    "id" SERIAL PRIMARY KEY,
    "cohortId" INTEGER NOT NULL,
    "endpointId" INTEGER NOT NULL,
    "isAllowed" BOOLEAN DEFAULT true,
    "maxRequestsPerHour" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("cohortId", "endpointId")
);
```

### EndpointAccessAttempts Table
```sql
CREATE TABLE "EndpointAccessAttempts" (
    "id" SERIAL PRIMARY KEY,
    "apiKeyId" INTEGER,
    "endpointId" INTEGER,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "isAllowed" BOOLEAN NOT NULL,
    "denyReason" VARCHAR(255),
    "timestamp" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "requestDuration" INTEGER
);
```

## API Endpoints

### Endpoint Registration (Admin Only)

#### List All Endpoints
```http
GET /endpoints?service=cohorts&version=v1&isActive=true
Authorization: Bearer {admin_jwt_token}
```

#### Register New Endpoint
```http
POST /endpoints
Authorization: Bearer {admin_jwt_token}
Content-Type: application/json

{
  "method": "GET",
  "pathPattern": "/v1/cohorts/:id/students",
  "name": "Get Cohort Students",
  "description": "Retrieve all students in a specific cohort",
  "service": "cohorts",
  "version": "v1",
  "requiresAuth": true,
  "isActive": false
}
```

#### Get Endpoint Details
```http
GET /endpoints/{endpointId}
Authorization: Bearer {admin_jwt_token}
```

#### Update Endpoint
```http
PATCH /endpoints/{endpointId}
Authorization: Bearer {admin_jwt_token}
Content-Type: application/json

{
  "name": "Updated Endpoint Name",
  "description": "Updated description",
  "isActive": true
}
```

#### Activate Endpoint for API Access
```http
PATCH /endpoints/{endpointId}/activate
Authorization: Bearer {admin_jwt_token}
```

#### Deactivate Endpoint
```http
PATCH /endpoints/{endpointId}/deactivate
Authorization: Bearer {admin_jwt_token}
```

#### Bulk Register Endpoints
```http
POST /endpoints/bulk
Authorization: Bearer {admin_jwt_token}
Content-Type: application/json

{
  "endpoints": [
    {
      "method": "GET",
      "pathPattern": "/v1/cohorts/:id",
      "name": "Get Cohort",
      "service": "cohorts"
    },
    {
      "method": "POST",
      "pathPattern": "/v1/cohorts/:id/api-keys",
      "name": "Create API Key",
      "service": "api-keys"
    }
  ]
}
```

#### Get Available Services
```http
GET /endpoints/services
Authorization: Bearer {admin_jwt_token}
```

### Cohort Permission Management

#### Get Cohort's Accessible Endpoints
```http
GET /cohorts/{cohortId}/accessible-endpoints?includeInactive=false&service=dicom&version=v1
Authorization: Bearer {jwt_token}
```
**Query Parameters:**
- `includeInactive` (optional): Include inactive endpoints in results
- `service` (optional): Filter by service name (e.g., "dicom", "cohorts")
- `version` (optional): Filter by API version (e.g., "v1", "v2")

#### Get Cohort's Current Permissions (Admin Only)
```http
GET /cohorts/{cohortId}/permissions
Authorization: Bearer {admin_jwt_token}
```

#### Grant Permission to Cohort (Admin Only)
```http
POST /cohorts/{cohortId}/permissions
Authorization: Bearer {admin_jwt_token}
Content-Type: application/json

{
  "endpointId": 123,
  "maxRequestsPerHour": 100,
  "description": "Access for student data retrieval"
}
```

#### Update Permission Settings (Admin Only)
```http
PATCH /cohorts/{cohortId}/permissions/{endpointId}
Authorization: Bearer {admin_jwt_token}
Content-Type: application/json

{
  "isAllowed": true,
  "maxRequestsPerHour": 200,
  "description": "Increased rate limit for production use"
}
```

#### Deny Permission (Admin Only)
```http
PATCH /cohorts/{cohortId}/permissions/{endpointId}
Authorization: Bearer {admin_jwt_token}
Content-Type: application/json

{
  "isAllowed": false,
  "description": "Access denied due to policy change"
}
```
**Recommended**: Use this to revoke access while maintaining audit trail.

#### Remove Permission Record (Admin Only)
```http
DELETE /cohorts/{cohortId}/permissions/{endpointId}
Authorization: Bearer {admin_jwt_token}
```
**Use sparingly**: Completely removes the permission record. Only use for cleanup operations or when resetting to "no permission" state.

#### Bulk Grant Permissions (Admin Only)
```http
POST /cohorts/{cohortId}/permissions/bulk
Authorization: Bearer {admin_jwt_token}
Content-Type: application/json

{
  "endpointIds": [1, 2, 3, 4],
  "maxRequestsPerHour": 100,
  "description": "Basic access package"
}
```

#### Copy Permissions Between Cohorts (Admin Only)
```http
POST /cohorts/{sourceCohortId}/permissions/copy/{targetCohortId}
Authorization: Bearer {admin_jwt_token}
```

#### Get Permission Analytics (Admin Only)
```http
GET /cohorts/{cohortId}/permissions/analytics?timeRange=24h
Authorization: Bearer {admin_jwt_token}
```

## Permission Validation Flow

### Request Processing
1. **Authentication**: API key validated and cohort identified
2. **Cohort Access Control**: Validate API key can access the requested cohort's data (NEW)
3. **Endpoint Matching**: Request path matched to registered endpoint
4. **Activation Check**: Endpoint must be active for API access
5. **Permission Check**: Cohort must have explicit permission for endpoint
6. **Rate Limiting**: Check cohort-specific endpoint rate limits
7. **Access Logging**: Log access attempt (success or failure)
8. **Request Proceeds**: If all checks pass

### Access Denial Scenarios
- **Cohort Access Violation**: Access denied with `COHORT_ACCESS_DENIED` (NEW)
- **Unregistered Endpoint**: Warning logged, request allowed (backward compatibility)
- **Inactive Endpoint**: Access denied with `ENDPOINT_NOT_ACTIVE`
- **No Permission**: Access denied with `NO_COHORT_PERMISSION`  
- **Denied Permission**: Access denied with `COHORT_PERMISSION_DENIED`
- **Rate Limited**: Access denied with `COHORT_ENDPOINT_RATE_LIMIT_EXCEEDED`

## Permission Management Guidelines

### When to Use Each Operation

#### Grant Permission (POST)
- **Use for**: Giving new access to a cohort
- **Result**: Creates permission with `isAllowed: true`

#### Update Permission (PATCH with `isAllowed: true`)
- **Use for**: Re-enabling previously denied access
- **Use for**: Updating rate limits or descriptions
- **Result**: Updates existing permission to allow access

#### Deny Permission (PATCH with `isAllowed: false`)
- **Use for**: Revoking access while keeping audit trail
- **Use for**: Temporary access suspension
- **Result**: Sets `isAllowed: false`, maintains record
- **Recommended**: Use this instead of DELETE for most revocation scenarios

#### Remove Permission (DELETE)
- **Use for**: Cleaning up test permissions
- **Use for**: Data cleanup operations
- **Use for**: Resetting to "no permission" state
- **Result**: Completely removes permission record
- **Caution**: No audit trail of previous access

## Common Operations

### Registering an Endpoint (Admin)
```javascript
async function registerEndpoint(endpointData) {
  const response = await fetch('/endpoints', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      method: 'GET',
      pathPattern: '/v1/cohorts/:id/students',
      name: 'Get Cohort Students',
      description: 'Retrieve students in a cohort',
      service: 'cohorts',
      requiresAuth: true,
      isActive: false // Start inactive for security
    })
  })
  
  return response.json()
}
```

### Granting Cohort Permission (Admin Only)
```javascript
async function grantCohortPermission(cohortId, endpointId, options = {}) {
  const response = await fetch(`/cohorts/${cohortId}/permissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      endpointId,
      maxRequestsPerHour: options.rateLimit || null,
      description: options.description || 'Access granted'
    })
  })
  
  return response.json()
}
```

### Denying Cohort Permission (Admin Only)
```javascript
async function denyCohortPermission(cohortId, endpointId, reason) {
  const response = await fetch(`/cohorts/${cohortId}/permissions/${endpointId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      isAllowed: false,
      description: reason || 'Access denied'
    })
  })
  
  return response.json()
}
```

### Removing Permission Record (Admin Only)
```javascript
async function removePermissionRecord(cohortId, endpointId) {
  const response = await fetch(`/cohorts/${cohortId}/permissions/${endpointId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  })
  
  return response.json()
}
```

### Checking Cohort Access
```javascript
async function getCohortAccessibleEndpoints(cohortId) {
  const response = await fetch(`/cohorts/${cohortId}/accessible-endpoints`, {
    headers: {
      'Authorization': `Bearer ${userToken}` // Cohort managers can view their accessible endpoints
    }
  })
  
  const result = await response.json()
  return result.data.filter(endpoint => endpoint.isAllowed)
}
```

## Rate Limiting

### How It Works
- **Cohort-Wide**: Limits apply to all API keys in a cohort combined
- **Per-Endpoint**: Each endpoint can have different rate limits
- **Sliding Window**: Uses 1-hour sliding window by default
- **Headers Included**: Rate limit info in response headers

### Setting Rate Limits
```javascript
// Grant permission with custom rate limit
await grantCohortPermission(cohortId, endpointId, {
  rateLimit: 500, // 500 requests per hour for this endpoint
  description: 'Limited access for data exports'
})
```

### Rate Limit Response
```json
{
  "success": false,
  "error": "Rate limit exceeded for this endpoint",
  "code": "COHORT_ENDPOINT_RATE_LIMIT_EXCEEDED",
  "retryAfter": 1800
}
```

## Error Handling

### Common Error Codes
- **COHORT_ACCESS_DENIED**: API key attempting to access another cohort's data (NEW)
- **ENDPOINT_NOT_ACTIVE**: Endpoint exists but not enabled for API access
- **NO_COHORT_PERMISSION**: Cohort has no permission record for endpoint
- **COHORT_PERMISSION_DENIED**: Cohort permission explicitly denied
- **COHORT_ENDPOINT_RATE_LIMIT_EXCEEDED**: Rate limit exceeded

### Error Response Format
```json
{
  "success": false,
  "error": "Access denied: Cohort does not have permission for this endpoint",
  "code": "NO_COHORT_PERMISSION"
}
```

## Security Considerations

### Secure by Default
- **Endpoints start inactive**: Must be explicitly activated
- **No permission = no access**: Explicit grants required
- **Admin-only registration**: Only admins can register endpoints
- **Audit logging**: All access attempts logged

### Access Control
- **Admin-only management**: Only administrators can grant, revoke, or modify permissions
- **Cohort-based inheritance**: All API keys in a cohort inherit the cohort's permissions
- **View-only for cohort managers**: Cohort managers can only view their accessible endpoints

## Monitoring & Analytics

### Access Attempt Logging
Every API request is logged with:
- API key used
- Endpoint accessed
- Success/failure status
- Denial reason (if denied)
- Request duration
- IP address and user agent

### Analytics Queries
```sql
-- Most accessed endpoints by cohort
SELECT e.name, COUNT(*) as request_count
FROM "EndpointAccessAttempts" eaa
JOIN "Endpoints" e ON eaa."endpointId" = e.id
JOIN "ApiKeys" ak ON eaa."apiKeyId" = ak.id
WHERE ak."cohortId" = 46
  AND eaa."timestamp" > NOW() - INTERVAL '24 hours'
GROUP BY e.name
ORDER BY request_count DESC;

-- Rate limit violations
SELECT e.name, COUNT(*) as violations
FROM "EndpointAccessAttempts" eaa
JOIN "Endpoints" e ON eaa."endpointId" = e.id
WHERE eaa."statusCode" = 429
  AND eaa."timestamp" > NOW() - INTERVAL '24 hours'
GROUP BY e.name;
```

## Troubleshooting

### Endpoint Not Accessible
1. **Check cohort access**: Is API key trying to access its own cohort's data? (NEW)
2. **Check registration**: Is endpoint registered in database?
3. **Check activation**: Is `isActive = true`?
4. **Check permissions**: Does cohort have permission?
5. **Check permission status**: Is `isAllowed = true`?

### Permission Issues
1. **Verify cohort ID**: Ensure API key belongs to correct cohort
2. **Check endpoint ID**: Verify endpoint exists and ID is correct
3. **Review audit logs**: Check `EndpointAccessAttempts` for denial reasons

### Performance Issues
1. **Index usage**: Ensure proper indexes on lookup fields
2. **Permission cache**: Consider caching frequently-checked permissions
3. **Log table size**: Archive old access attempt logs

## Best Practices

### For Administrators
- **Start inactive**: Always register endpoints as inactive initially
- **Descriptive names**: Use clear, descriptive endpoint names
- **Service grouping**: Group related endpoints by service
- **Regular audits**: Review permissions and access patterns

### For Cohort Managers
- **Monitor your access**: Regularly review which endpoints your cohort can access
- **Request access through admins**: Contact administrators when you need access to new endpoints
- **Understand rate limits**: Be aware of any rate limits that apply to your cohort
- **Report issues**: Contact admins if you encounter permission-related problems

### For Development Teams
- **Implement cohort access validation**: Use proper middleware for cohort-related endpoints (NEW)
- **Register all controlled endpoints**: Don't rely on backward compatibility
- **Handle permission errors gracefully**: Provide clear error messages
- **Monitor access patterns**: Watch for unusual access attempts
- **Test permission scenarios**: Include permission testing in your test suite
- **Validate cohort ownership**: Always verify API keys are accessing their own cohort's data (NEW)

### For Operations Teams
- **Monitor rate limits**: Set up alerts for frequent violations
- **Archive logs**: Regularly archive old access attempt logs
- **Performance monitoring**: Watch for permission check performance issues
- **Security audits**: Regular review of permission grants and access patterns