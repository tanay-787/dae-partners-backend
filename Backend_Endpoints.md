# Backend API Endpoints Documentation

This document provides detailed information about the API endpoints exposed by the DAE Partners Express.js backend. Use this as a reference when developing the frontend application.

**Base URL:** `/api` (assuming your Express app is mounted at the root and routes are prefixed with `/api`)

---

## 1. Authentication Endpoints (`/api/auth`)

These endpoints handle user registration and login.

### `POST /api/auth/signup`

*   **Description:** Registers a new user in the system.
*   **Authentication:** Not Required
*   **Request Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "securepassword123"
    }
    ```
*   **Success Response (`201 Created`):**
    ```json
    {
      "message": "User registered successfully",
      "user": {
        "id": "clvxxxxxxxxxxxxxxxxx",
        "email": "user@example.com",
        "createdAt": "2023-10-27T10:00:00.000Z",
        "pricingTierId": null
      }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Invalid input (e.g., missing fields).
    *   `409 Conflict`: User with the given email already exists.
    *   `500 Internal Server Error`: Server error during registration.

### `POST /api/auth/login`

*   **Description:** Authenticates an existing user and returns a JSON Web Token (JWT).
*   **Authentication:** Not Required
*   **Request Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "securepassword123"
    }
    ```
*   **Success Response (`200 OK`):**
    ```json
    {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbHZ4eHh4eHh4eHh4eHh4eHh4eCIsImlhdCI6MTY5ODQxNjQwMCwiZXhwIjoxNjk4NDIwMDAwfQ.xxxxxxxxxxxxxxxxxxxxxxxxx"
    }
    ```
    **Note:** Store this token securely on the frontend and include it in the `Authorization: Bearer <token>` header for subsequent requests to protected endpoints.
*   **Error Responses:**
    *   `400 Bad Request`: Invalid input (e.g., missing fields).
    *   `401 Unauthorized`: Invalid email or password.
    *   `500 Internal Server Error`: Server error during login.

---

## 2. User Profile Endpoints (`/api/profile`)

These endpoints manage the authenticated user's profile.

### `GET /api/profile`

*   **Description:** Retrieves the profile information of the authenticated user.
*   **Authentication:** Required (requires a valid JWT in the `Authorization` header)
*   **Request Body:** None
*   **Success Response (`200 OK`):**
    ```json
    {
      "id": "clvxxxxxxxxxxxxxxxxx",
      "email": "user@example.com",
      "createdAt": "2023-10-27T10:00:00.000Z"
    }
    ```
*   **Error Responses:**
    *   `401 Unauthorized`: Missing or invalid JWT.
    *   `404 Not Found`: User not found.
    *   `500 Internal Server Error`: Server error.

### `PUT /api/profile`

*   **Description:** Updates the profile information of the authenticated user.
*   **Authentication:** Required (requires a valid JWT)
*   **Request Body:**
    ```json
    {
      "name": "Updated Name",
      "address": "Updated Address"
    }
    ```
    **Note:** The validation middleware currently expects fields like `name` or `address` if you uncommented them.
*   **Success Response (`200 OK`):**
    ```json
    {
      "message": "Profile updated successfully",
      "profile": {
        "id": "clvxxxxxxxxxxxxxxxxx",
        "email": "user@example.com",
        "createdAt": "2023-10-27T10:00:00.000Z"
      }
    }
    ```
    **Note:** The returned profile object currently only includes `id`, `email`, and `createdAt` based on the controller's `select` statement.
*   **Error Responses:**
    *   `400 Bad Request`: Invalid input (e.g., validation errors, attempting to update sensitive fields like `id`, `email`, `role`, or providing no valid fields).
    *   `401 Unauthorized`: Missing or invalid JWT.
    *   `500 Internal Server Error`: Server error.

---

## 3. Product Catalog Endpoints (`/api/products`)

These endpoints provide access to product information with filtering, search, and pagination.

### `GET /api/products`

*   **Description:** Retrieves a list of products. Supports filtering, search, and pagination. Prices are calculated based on the authenticated user's pricing tier and applicable discounts.
*   **Authentication:** Optional (prices will be base prices if not authenticated, discounted if authenticated)
*   **Query Parameters:**
    *   `category`: string (Optional) - Filter products by category.
    *   `minPrice`: number (Optional) - Filter products with base price greater than or equal to this value.
    *   `maxPrice`: number (Optional) - Filter products with base price less than or equal to this value.
    *   `search`: string (Optional) - Search products by name (case-insensitive, contains).
    *   `page`: number (Optional) - Page number for pagination (default: 1).
    *   `limit`: number (Optional) - Number of items per page for pagination (default: 10).
*   **Request Body:** None
*   **Success Response (`200 OK`):**
    ```json
    [
      {
        "id": "clvxxxxxxxxxxxxxxxxx",
        "name": "Product Name",
        "description": "Product Description",
        "price": 199.99,
        "image": "http://example.com/image.jpg",
        "category": "Beverages",
        "inventory": 100,
        "basePrice": 250.00
      },
      {
        "id": "clvxxxxxxxxxxxxxxxxx",
        "name": "Another Product",
        "description": null,
        "price": 50.00,
        "image": null,
        "category": null,
        "inventory": 50,
        "basePrice": 50.00
      }
    ]
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Invalid query parameters.
    *   `500 Internal Server Error`: Server error.

### `GET /api/products/:id`

*   **Description:** Retrieves detailed information for a single product by its ID. The price is calculated based on the authenticated user's pricing tier and applicable discounts.
*   **Authentication:** Optional (price will be base price if not authenticated, discounted if authenticated)
*   **URL Parameters:**
    *   `id`: string (Required) - The ID of the product to retrieve.
*   **Request Body:** None
*   **Success Response (`200 OK`):**
    ```json
    {
      "id": "clvxxxxxxxxxxxxxxxxx",
      "name": "Product Name",
      "description": "Product Description",
      "price": 199.99,
      "image": "http://example.com/image.jpg",
      "category": "Beverages",
      "inventory": 100,
      "basePrice": 250.00
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing product ID in the URL.
    *   `404 Not Found`: Product with the given ID was not found.
    *   `500 Internal Server Error`: Server error.

---

## 4. Shopping Cart Endpoints (`/api/cart`)

These endpoints manage the authenticated user's shopping cart.

*   **Authentication:** Required for all endpoints in this section.

### `GET /api/cart`

*   **Description:** Retrieves the shopping cart for the authenticated user, including items with calculated discounted prices and total amounts.
*   **Request Body:** None
*   **Success Response (`200 OK`):**
    ```json
    {
      "id": "clvxxxxxxxxxxxxxxxxx",
      "userId": "clvxxxxxxxxxxxxxxxxx",
      "createdAt": "2023-10-27T10:00:00.000Z",
      "updatedAt": "2023-10-27T10:30:00.000Z",
      "items": [
        {
          "id": "clvxxxxxxxxxxxxxxxxx",
          "cartId": "clvxxxxxxxxxxxxxxxxx",
          "productId": "clvxxxxxxxxxxxxxxxxx",
          "quantity": 2,
          "createdAt": "2023-10-27T10:28:00.000Z",
          "updatedAt": "2023-10-27T10:29:00.000Z",
          "product": {
            "id": "clvxxxxxxxxxxxxxxxxx",
            "name": "Product Name",
            "description": "Product Description",
            "price": 250.00,
            "image": "http://example.com/image.jpg",
            "category": "Beverages",
            "inventory": 98
          },
          "calculatedPrice": 399.98,
          "unitPrice": 250.00,
          "discountedUnitPrice": 199.99
        }
      ],
      "subTotal": 399.98,
      "discountApplied": 0,
      "totalAmount": 399.98
    }
    ```
*   **Error Responses:**
    *   `401 Unauthorized`: Missing or invalid JWT.
    *   `500 Internal Server Error`: Server error.

### `POST /api/cart/items`

*   **Description:** Adds a new item to the authenticated user's cart or updates the quantity if the product already exists.
*   **Request Body:**
    ```json
    {
      "productId": "clvxxxxxxxxxxxxxxxxx",
      "quantity": 1
    }
    ```
*   **Success Response (`200 OK`):**
    ```json
    {
      "message": "Item added/updated in cart",
      "cart": {
         "id": "clvxxxxxxxxxxxxxxxxx",
         "userId": "clvxxxxxxxxxxxxxxxxx",
         "createdAt": "2023-10-27T10:00:00.000Z",
         "updatedAt": "2023-10-27T10:30:00.000Z",
         "items": [
           {
             "id": "clvxxxxxxxxxxxxxxxxx",
             "cartId": "clvxxxxxxxxxxxxxxxxx",
             "productId": "clvxxxxxxxxxxxxxxxxx",
             "quantity": 3,
             "createdAt": "2023-10-27T10:28:00.000Z",
             "updatedAt": "2023-10-27T10:30:00.000Z",
             "product": {
               "id": "clvxxxxxxxxxxxxxxxxx",
               "name": "Product Name",
               "description": "Product Description",
               "price": 250.00,
               "image": "http://example.com/image.jpg",
               "category": "Beverages",
               "inventory": 97
             },
             "calculatedPrice": 599.97,
             "unitPrice": 250.00,
             "discountedUnitPrice": 199.99
           }
         ],
         "subTotal": 599.97,
         "discountApplied": 0,
         "totalAmount": 599.97
      }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Invalid input (e.g., missing `productId` or `quantity`, non-positive quantity, validation errors).
    *   `401 Unauthorized`: Missing or invalid JWT.
    *   `404 Not Found`: Product with the given `productId` not found.
    *   `500 Internal Server Error`: Server error.

### `PUT /api/cart/items/:itemId`

*   **Description:** Updates the quantity of a specific item in the authenticated user's cart.
*   **URL Parameters:**
    *   `itemId`: string (Required) - The ID of the cart item to update.
*   **Request Body:**
    ```json
    {
      "quantity": 5
    }
    ```
*   **Success Response (`200 OK`):**
    ```json
    {
      "message": "Cart item quantity updated",
      "cart": {
         "id": "clvxxxxxxxxxxxxxxxxx",
         "userId": "clvxxxxxxxxxxxxxxxxx",
         "createdAt": "2023-10-27T10:00:00.000Z",
         "updatedAt": "2023-10-27T10:35:00.000Z",
         "items": [
           {
             "id": "clvxxxxxxxxxxxxxxxxx",
             "cartId": "clvxxxxxxxxxxxxxxxxx",
             "productId": "clvxxxxxxxxxxxxxxxxx",
             "quantity": 5,
             "createdAt": "2023-10-27T10:28:00.000Z",
             "updatedAt": "2023-10-27T10:35:00.000Z",
             "product": {
               "id": "clvxxxxxxxxxxxxxxxxx",
               "name": "Product Name",
               "description": "Product Description",
               "price": 250.00,
               "image": "http://example.com/image.jpg",
               "category": "Beverages",
               "inventory": 95
             },
             "calculatedPrice": 999.95,
             "unitPrice": 250.00,
             "discountedUnitPrice": 199.99
           }
         ],
         "subTotal": 999.95,
         "discountApplied": 0,
         "totalAmount": 999.95
      }
    }
    ```
    **Note:** If `quantity` is 0, the response message will be "Item removed from cart", and the `cart` object will reflect the removal (the item will be gone from the `items` array).
*   **Error Responses:**
    *   `400 Bad Request`: Invalid input (e.g., missing `quantity`, negative quantity if validation enforced, validation errors).
    *   `401 Unauthorized`: Missing or invalid JWT.
    *   `404 Not Found`: Cart item with the given `itemId` not found, or the item does not belong to the authenticated user's cart.
    *   `500 Internal Server Error`: Server error.

### `DELETE /api/cart/items/:itemId`

*   **Description:** Removes a specific item from the authenticated user's cart.
*   **URL Parameters:**
    *   `itemId`: string (Required) - The ID of the cart item to remove.
*   **Request Body:** None
*   **Success Response (`200 OK`):**
    ```json
    {
      "message": "Item removed from cart",
       "cart": {
         "id": "clvxxxxxxxxxxxxxxxxx",
         "userId": "clvxxxxxxxxxxxxxxxxx",
         "createdAt": "2023-10-27T10:00:00.000Z",
         "updatedAt": "2023-10-27T10:40:00.000Z",
         "items": [],
         "subTotal": 0,
         "discountApplied": 0,
         "totalAmount": 0
       }
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing item ID in the URL.
    *   `401 Unauthorized`: Missing or invalid JWT.
    *   `404 Not Found`: Cart item with the given `itemId` not found, or the item does not belong to the authenticated user's cart.
    *   `500 Internal Server Error`: Server error.

---

## 5. Order Endpoints (`/api/orders`)

These endpoints handle order creation and retrieval for the authenticated user.

*   **Authentication:** Required for all endpoints in this section.

### `POST /api/orders`

*   **Description:** Creates a new order from the authenticated user's current shopping cart, performs inventory check and update, and initiates a Razorpay payment order. This operation is atomic (uses a database transaction).
*   **Request Body:** None (Order is created from the user's cart)
    *   If you add fields like `shippingAddress` to the Order model and controller, the request body would look like:
    ```json
    {
      "shippingAddress": "User's Shipping Address"
    }
    ```
*   **Success Response (`201 Created`):**
    ```json
    {
      "message": "Order created and payment initiated",
      "orderId": "clvxxxxxxxxxxxxxxxxx",
      "totalAmount": 749.96,
      "razorpayOrder": {
        "id": "order_xxxxxxxxxxxxxx",
        "entity": "order",
        "amount": 74996,
        "currency": "INR",
        "receipt": "clvxxxxxxxxxxxxxxxxx",
        "status": "created",
        "attempts": 0,
        "createdAt": 1698416400
      },
      "razorpayKeyId": "rzp_test_xxxxxxxxxxxxxxxxxx"
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Cart is empty, order total is not positive, insufficient inventory (message will be "Insufficient inventory for product: [product name]. Available: X, Requested: Y").
    *   `401 Unauthorized`: Missing or invalid JWT.
    *   `500 Internal Server Error`: Server error during order creation or payment initiation.

### `GET /api/orders`

*   **Description:** Retrieves a list of all orders placed by the authenticated user.
*   **Request Body:** None
*   **Success Response (`200 OK`):**
    ```json
    [
      {
        "id": "clvxxxxxxxxxxxxxxxxx",
        "userId": "clvxxxxxxxxxxxxxxxxx",
        "totalAmount": 749.96,
        "status": "PendingPayment",
        "createdAt": "2023-10-27T11:00:00.000Z",
        "updatedAt": "2023-10-27T11:00:00.000Z",
        "razorpayOrderId": "order_xxxxxxxxxxxxxx",
        "items": [
          {
            "id": "clvxxxxxxxxxxxxxxxxx",
            "orderId": "clvxxxxxxxxxxxxxxxxx",
            "productId": "clvxxxxxxxxxxxxxxxxx",
            "quantity": 2,
            "price": 199.99,
            "createdAt": "2023-10-27T11:00:00.000Z",
            "updatedAt": "2023-10-27T11:00:00.000Z",
            "product": {
              "id": "clvxxxxxxxxxxxxxxxxx",
              "name": "Product Name",
              "description": "Product Description",
              "price": 250.00,
              "image": "http://example.com/image.jpg",
              "category": "Beverages",
              "inventory": 98
            }
          }
        ]
      }
    ]
    ```
    **Note:** The list is ordered by `createdAt` descending.
*   **Error Responses:**
    *   `401 Unauthorized`: Missing or invalid JWT.
    *   `500 Internal Server Error`: Server error.

### `GET /api/orders/:id`

*   **Description:** Retrieves the details of a specific order by its ID for the authenticated user.
*   **URL Parameters:**
    *   `id`: string (Required) - The ID of the order to retrieve.
*   **Request Body:** None
*   **Success Response (`200 OK`):**
    ```json
    {
      "id": "clvxxxxxxxxxxxxxxxxx",
      "userId": "clvxxxxxxxxxxxxxxxxx",
      "totalAmount": 749.96,
      "status": "PendingPayment",
      "createdAt": "2023-10-27T11:00:00.000Z",
      "updatedAt": "2023-10-27T11:00:00.000Z",
      "razorpayOrderId": "order_xxxxxxxxxxxxxx",
      "items": [
        {
          "id": "clvxxxxxxxxxxxxxxxxx",
          "orderId": "clvxxxxxxxxxxxxxxxxx",
          "productId": "clvxxxxxxxxxxxxxxxxx",
          "quantity": 2,
          "price": 199.99,
          "createdAt": "2023-10-27T11:00:00.000Z",
          "updatedAt": "2023-10-27T11:00:00.000Z",
          "product": {
            "id": "clvxxxxxxxxxxxxxxxxx",
            "name": "Product Name",
            "description": "Product Description",
            "price": 250.00,
            "image": "http://example.com/image.jpg",
            "category": "Beverages",
            "inventory": 98
          }
        }
      ]
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing order ID in the URL.
    *   `401 Unauthorized`: Missing or invalid JWT.
    *   `404 Not Found`: Order with the given `id` not found, or the order does not belong to the authenticated user.
    *   `500 Internal Server Error`: Server error.

---

## 6. Webhook Endpoints (`/api/webhooks`)

These endpoints are for receiving automated notifications from external services (like payment gateways). They typically do **NOT** require user authentication.

### `POST /api/webhooks/razorpay`

*   **Description:** Receives webhook events from Razorpay regarding payment status updates. Verifies the signature and updates the internal order status.
*   **Authentication:** Not Required (secured by signature verification)
*   **Request Body:** Raw request body containing the JSON event payload from Razorpay. The structure varies based on the event type. Example payload for `payment.captured`:
    ```json
    {
      "entity": "event",
      "account_id": "acc_xxxxxxxxxxxxxxxxxx",
      "event": "payment.captured",
      "contains": ["payment"],
      "payload": {
        "payment": {
          "entity": {
            "id": "pay_xxxxxxxxxxxxxx",
            "entity": "payment",
            "amount": 74996,
            "currency": "INR",
            "status": "captured",
            "order_id": "order_xxxxxxxxxxxxxx",
            "international": false,
            "method": "card",
            "amount_refunded": 0,
            "amount_due": 0,
            "currency_symbol": "₹",
            "description": null,
            "vpa": null,
            "email": "user@example.com",
            "contact": "+919999999999",
            "customer_id": "cust_xxxxxxxxxxxxxx",
            "token_id": null,
            "notes": {},
            "fee": 1000,
            "tax": 0,
            "error_code": null,
            "error_description": null,
            "error_source": null,
            "error_step": null,
            "error_reason": null,
            "acquirer_data": {
              "rrn": "123456789012"
            },
            "created_at": 1698416405
          }
        }
      },
      "created_at": 1698416405
    }
    ```
*   **Headers:** Requires `X-Razorpay-Signature` header for verification.
*   **Success Response (`200 OK`):**
    ```text
    Webhook received
    ```
*   **Error Responses:**
    *   `400 Bad Request`: Missing signature, invalid signature, or invalid event body structure.
    *   `500 Internal Server Error`: Error processing the webhook event (e.g., database error, issue finding order).

---
