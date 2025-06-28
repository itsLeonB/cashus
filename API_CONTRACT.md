# BillSplittr Friend Details API Contract

This document outlines the API endpoints needed for the Friend Details functionality.

## Base URL
```
http://localhost:8080/api/v1
```

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <jwt_token>
```

## Response Format
All responses follow the standard ApiResponse wrapper:
```json
{
  "message": "Success message",
  "data": <response_data>,
  "error": null
}
```

## Endpoints

### 1. Get Friend Details
**GET** `/friendships/{friendId}`

Get comprehensive details about a specific friend including balance and recent transactions.

**Path Parameters:**
- `friendId` (string, required): The friendship ID

**Query Parameters:**
- `includeTransactions` (boolean, optional): Include transaction history (default: true)
- `transactionLimit` (integer, optional): Limit number of transactions returned (default: 10)

**Response:**
```json
{
  "message": "Friend details retrieved successfully",
  "data": {
    "friend": {
      "id": "friendship-uuid",
      "profileId": "profile-uuid",
      "name": "John Doe",
      "type": "ANONYMOUS",
      "email": "john@example.com",
      "phone": "+1234567890",
      "avatar": "https://example.com/avatar.jpg",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "deletedAt": null
    },
    "balance": {
      "totalOwedToYou": 150000,
      "totalYouOwe": 75000,
      "netBalance": 75000,
      "currency": "IDR"
    },
    "transactions": [
      {
        "id": "transaction-uuid",
        "type": "CREDIT",
        "action": "LEND",
        "amount": 50000,
        "description": "Lunch money",
        "transferMethod": "Cash",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z",
        "status": "COMPLETED"
      }
    ],
    "stats": {
      "totalTransactions": 15,
      "firstTransactionDate": "2024-01-01T10:30:00Z",
      "lastTransactionDate": "2024-01-15T10:30:00Z",
      "mostUsedTransferMethod": "Cash",
      "averageTransactionAmount": 45000
    }
  },
  "error": null
}
```

### 2. Update Friend Details
**PUT** `/friendships/{friendId}`

Update friend information (name, email, phone).

**Path Parameters:**
- `friendId` (string, required): The friendship ID

**Request Body:**
```json
{
  "name": "Updated Name",
  "email": "updated@example.com",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "message": "Friend updated successfully",
  "data": {
    "id": "friendship-uuid",
    "profileId": "profile-uuid",
    "name": "Updated Name",
    "type": "ANONYMOUS",
    "email": "updated@example.com",
    "phone": "+1234567890",
    "avatar": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-16T14:20:00Z",
    "deletedAt": null
  },
  "error": null
}
```

### 3. Get Friend Transactions
**GET** `/friendships/{friendId}/transactions`

Get paginated transaction history for a specific friend with filtering options.

**Path Parameters:**
- `friendId` (string, required): The friendship ID

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20)
- `type` (string, optional): Filter by transaction type (DEBT, CREDIT)
- `action` (string, optional): Filter by action (LEND, BORROW, RECEIVE, RETURN)
- `dateFrom` (string, optional): Filter from date (ISO 8601)
- `dateTo` (string, optional): Filter to date (ISO 8601)
- `minAmount` (number, optional): Minimum amount filter
- `maxAmount` (number, optional): Maximum amount filter
- `status` (string, optional): Filter by status (PENDING, COMPLETED, CANCELLED)

**Response:**
```json
{
  "message": "Transactions retrieved successfully",
  "data": {
    "transactions": [
      {
        "id": "transaction-uuid",
        "type": "CREDIT",
        "action": "LEND",
        "amount": 50000,
        "description": "Lunch money",
        "transferMethod": "Cash",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z",
        "status": "COMPLETED"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "error": null
}
```

### 4. Delete Friend
**DELETE** `/friendships/{friendId}`

Soft delete a friendship (sets deletedAt timestamp).

**Path Parameters:**
- `friendId` (string, required): The friendship ID

**Response:**
```json
{
  "message": "Friend deleted successfully",
  "data": null,
  "error": null
}
```

### 5. Get Friend Balance Summary
**GET** `/friendships/{friendId}/balance`

Get detailed balance breakdown for a specific friend.

**Path Parameters:**
- `friendId` (string, required): The friendship ID

**Response:**
```json
{
  "message": "Balance retrieved successfully",
  "data": {
    "totalOwedToYou": 150000,
    "totalYouOwe": 75000,
    "netBalance": 75000,
    "currency": "IDR",
    "breakdown": {
      "lentAmount": 200000,
      "borrowedAmount": 50000,
      "receivedAmount": 50000,
      "returnedAmount": 25000
    },
    "lastUpdated": "2024-01-15T10:30:00Z"
  },
  "error": null
}
```

## Error Responses

### 404 - Friend Not Found
```json
{
  "message": "Friend not found",
  "data": null,
  "error": {
    "code": "FRIEND_NOT_FOUND",
    "details": "No friendship found with the provided ID"
  }
}
```

### 403 - Access Denied
```json
{
  "message": "Access denied",
  "data": null,
  "error": {
    "code": "ACCESS_DENIED",
    "details": "You don't have permission to access this friend's details"
  }
}
```

### 400 - Validation Error
```json
{
  "message": "Validation failed",
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "name": ["Name is required"],
      "email": ["Invalid email format"]
    }
  }
}
```

## Implementation Notes

1. **Security**: Ensure users can only access friends they have relationships with
2. **Performance**: Consider caching balance calculations for frequently accessed friends
3. **Pagination**: Implement cursor-based pagination for large transaction histories
4. **Soft Deletes**: Use soft deletes to maintain transaction history integrity
5. **Currency**: All amounts should be stored and returned in the base currency unit (e.g., Rupiah, not cents)
6. **Timestamps**: Use ISO 8601 format for all timestamps
7. **Validation**: Implement proper input validation and sanitization
8. **Rate Limiting**: Consider implementing rate limiting for these endpoints
