## Features Roadmap - DAE Partners App (Express.js)

This detailed roadmap outlines the implementation plan for the DAE Partners B2B cold drinks ordering app backend, leveraging the Express.js framework for its maturity and reliability.

---

### 1. User Authentication & Authorization

**Goal:** Securely register and authenticate users (retailers, wholesalers) and control access based on roles.

*   **Framework:** Express.js
    *   Define `/auth/signup` and `/auth/login` routes.
    *   Implement `authenticateToken` middleware for protected routes.
*   **Database:** Prisma
    *   `User` model to store email, hashed password, roles, etc.
*   **Patterns:** JWT (JSON Web Tokens)
*   **Libraries:**
    *   `bcrypt` for password hashing.
    *   `jsonwebtoken` for JWT creation and verification.
*   **Implementation Steps:**
    *   Create `auth.routes.ts` with `/signup` and `/login` POST endpoints.
    *   Develop `auth.controller.ts` with `signup` and `login` handler functions.
    *   In `signup` handler:
        *   Get email and password from `req.body`.
        *   Validate input (check for presence, format).
        *   Check if user already exists in DB using Prisma.
        *   Hash password using `bcrypt`.
        *   Create new user record in DB using Prisma.
        *   Send success response (`res.status(201).json(...)`).
    *   In `login` handler:
        *   Get email and password from `req.body`.
        *   Validate input.
        *   Find user by email in DB using Prisma.
        *   Compare provided password with hashed password using `bcrypt.compare`.
        *   If valid, generate JWT using `jsonwebtoken.sign` with user info (e.g., userId, role) as payload.
        *   Send JWT in response (`res.status(200).json({ token })`).
    *   Create `auth.middleware.ts` with `authenticateToken` function.
    *   In `authenticateToken` middleware:
        *   Extract token from `Authorization` header (`req.headers['authorization']`).
        *   Verify token using `jsonwebtoken.verify`.
        *   If valid, attach decoded user information to `req.user`.
        *   Call `next()`.
        *   If invalid or no token, send 401/403 response (`res.status(401).json(...)`).
    *   Apply `authenticateToken` middleware to protected routes in your route definitions.
*   **Express.js Support:** Provides robust routing and middleware capabilities essential for this feature.

### 2. User Profile Management

**Goal:** Allow authenticated users to view and update their profile information.

*   **Framework:** Express.js
    *   Define `/profile` GET and PUT routes.
*   **Database:** Prisma
    *   Query and update the `User` table.
*   **Patterns:** RESTful API.
*   **Libraries:** (Optional) Input validation library like `express-validator`.
*   **Implementation Steps:**
    *   Add routes for profile management (e.g., in a `user.routes.ts` or extend `auth.routes.ts`).
    *   Apply `authenticateToken` middleware to these routes.
    *   Create handlers for GET and PUT `/profile`.
    *   In GET `/profile` handler:
        *   Get user ID from `req.user` (set by auth middleware).
        *   Fetch user details (excluding sensitive info like password hash) from DB using Prisma.
        *   Send user data in response (`res.json(profile)`).
        *   Handle user not found (shouldn't happen if auth is correct, but good practice).
    *   In PUT `/profile` handler:
        *   Get user ID from `req.user`.
        *   Get updated profile data from `req.body`.
        *   Validate input data (e.g., email format) using `express-validator` or manual checks.
        *   Update user record in DB using Prisma based on user ID.
        *   Ensure updates are limited to fields the user is allowed to change.
        *   Send success response with updated profile data (`res.json({ message: '...', profile: updatedProfile })`).
*   **Express.js Support:** Simplifies routing and access to authenticated user data (`req.user`) and request body.

### 3. Product Catalog

**Goal:** Display a list of available cold drinks and other products, with details and filtering/search options.

*   **Framework:** Express.js
    *   Define `/products` GET and `/products/:id` GET routes.
*   **Database:** Prisma
    *   `Product` model to store product details (name, description, price, inventory, etc.).
    *   Query product data with filtering and pagination.
*   **Patterns:** RESTful API, Caching.
*   **Libraries:**
    *   (Optional) Caching middleware (e.g., `apicache`).
    *   (Optional) Search library/service integration (e.g., Elasticsearch client).
*   **Implementation Steps:**
    *   Create `product.routes.ts`.
    *   Create `product.controller.ts`.
    *   In GET `/products` handler:
        *   Access query parameters (`req.query`) for filtering (e.g., category, price range) and pagination (e.g., page, limit).
        *   Build Prisma query dynamically based on query parameters (using `where`, `take`, `skip`).
        *   Fetch products from DB using Prisma.
        *   (Optional) Implement caching for product listings.
        *   Send product list in response (`res.json(products)`).
    *   In GET `/products/:id` handler:
        *   Get product ID from `req.params`.
        *   Fetch single product details from DB using Prisma.
        *   Handle product not found (`res.status(404)`).
        *   Send product details in response (`res.json(product)`).
*   **Express.js Support:** Provides flexible routing for list and detail views, and its middleware system facilitates adding caching.

### 4. Pricing and Discounts

**Goal:** Display correct pricing and apply relevant discounts based on user type (retailer/wholesaler).

*   **Framework:** Express.js
    *   Logic integrated within product/cart/order handlers.
*   **Database:** Prisma
    *   Models for `PricingTier`, `DiscountRule`, potentially linking to `User` and `Product`.
*   **Patterns:** Business Logic Layer.
*   **Implementation Steps:**
    *   Define database schema for pricing tiers and discount rules.
    *   Implement logic within relevant handlers (Product Catalog, Shopping Cart, Order Creation) to:
        *   Fetch user's role/pricing tier from `req.user`.
        *   Fetch applicable pricing/discount rules from the database using Prisma.
        *   Calculate the final price for products/items based on rules and user type.
    *   Ensure the pricing logic is consistently applied across all relevant endpoints.
*   **Express.js Support:** Acts as the entry point for requests that require pricing calculations.

### 5. Shopping Cart

**Goal:** Allow authenticated users to add, update, and remove items before placing an order.

*   **Framework:** Express.js
    *   Define routes like `/cart` GET, `/cart/items` POST, `/cart/items/:itemId` PUT/DELETE.
*   **Database:** Prisma
    *   `Cart` model linked to `User`.
    *   `CartItem` model linked to `Cart` and `Product`, storing quantity.
*   **Patterns:** RESTful API, State Management (tied to user session/DB).
*   **Implementation Steps:**
    *   Create `cart.routes.ts` and `cart.controller.ts`.
    *   Apply `authenticateToken` middleware to all cart routes.
    *   In GET `/cart` handler:
        *   Get user ID from `req.user`.
        *   Fetch the user's cart and its items from DB using Prisma (including product details).
        *   Calculate cart total.
        *   Send cart data in response.
    *   In POST `/cart/items` handler:
        *   Get user ID from `req.user`.
        *   Get product ID and quantity from `req.body`.
        *   Find or create the user's cart.
        *   Add/update the item in `CartItem` using Prisma.
        *   Send success response.
    *   In PUT `/cart/items/:itemId` handler:
        *   Get user ID from `req.user` and item ID from `req.params`.
        *   Get new quantity from `req.body`.
        *   Update the item quantity in `CartItem` using Prisma, ensuring the item belongs to the user's cart.
        *   Send success response.
    *   In DELETE `/cart/items/:itemId` handler:
        *   Get user ID from `req.user` and item ID from `req.params`.
        *   Remove the item from `CartItem` using Prisma, ensuring the item belongs to the user's cart.
        *   Send success response.
*   **Express.js Support:** Provides standard RESTful routing and access to user and request data.

### 6. Order Creation

**Goal:** Allow authenticated users to convert their shopping cart into a placed order.

*   **Framework:** Express.js
    *   Define `/orders` POST route.
*   **Database:** Prisma
    *   `Order` model linked to `User`, storing status, total, shipping address, etc.
    *   `OrderItem` model linked to `Order` and `Product`, storing quantity, price at time of order.
*   **Patterns:** Transactional Logic, API Endpoint.
*   **Implementation Steps:**
    *   Add POST `/orders` route (e.g., in `order.routes.ts`).
    *   Apply `authenticateToken` middleware.
    *   Create `createOrder` handler.
    *   In `createOrder` handler:
        *   Get user ID from `req.user`.
        *   Fetch the user's current cart and items using Prisma.
        *   (Optional) Validate inventory availability.
        *   Start a Prisma transaction (`$transaction`).
        *   Create a new `Order` record.
        *   Create `OrderItem` records based on cart items (copying details like price).
        *   Update product inventory counts (decrement stock).
        *   Clear the user's cart.
        *   Commit the transaction.
        *   If any step fails, roll back the transaction.
        *   Send success response (`res.status(201).json({ orderId: ... })`).
        *   (Optional) Integrate payment initiation if payment is required at order creation.
*   **Express.js Support:** Provides the necessary API endpoint and access to user data to trigger this complex, transactional process.

### 7. Order Management (User/Admin)

**Goal:** Allow users to view their order history and admins to manage all orders and update statuses.

*   **Framework:** Express.js
    *   Define `/orders` GET, `/orders/:id` GET for users.
    *   Define `/admin/orders` GET, `/admin/orders/:id` GET, `/admin/orders/:id/status` PUT for admins.
*   **Database:** Prisma
    *   Query and update `Order` records.
*   **Patterns:** RESTful API, Role-based Access Control.
*   **Libraries:** Middleware for role checking.
*   **Implementation Steps:**
    *   Add order routes (e.g., in `order.routes.ts`).
    *   Apply `authenticateToken` middleware to all order routes.
    *   Create `adminAuthMiddleware` to check for admin role (`req.user.role`). Apply to admin routes.
    *   In user GET `/orders` handler:
        *   Get user ID from `req.user`.
        *   Fetch orders from DB using Prisma, filtering by user ID.
        *   Send orders in response.
    *   In user GET `/orders/:id` handler:
        *   Get user ID from `req.user` and order ID from `req.params`.
        *   Fetch specific order from DB using Prisma, filtering by user ID.
        *   Handle not found or order not belonging to user (`res.status(404)` or `403`).
        *   Send order details.
    *   In admin GET `/admin/orders` handler:
        *   Fetch all orders (potentially with pagination/filtering) using Prisma.
        *   Send orders in response.
    *   In admin GET `/admin/orders/:id/status` handler:
        *   Get order ID from `req.params`.
        *   Get new status from `req.body`.
        *   Update order status in DB using Prisma.
        *   Send success response.
*   **Express.js Support:** Facilitates defining distinct routes for user and admin APIs and applying middleware for access control.

### 8. Inventory Management (Backend)

**Goal:** Track product stock levels and update them based on orders and potentially manual adjustments.

*   **Framework:** Express.js
    *   Logic integrated within order processing.
    *   (Optional) Admin route for manual inventory updates.
*   **Database:** Prisma
    *   `Product` model with an inventory field.
*   **Patterns:** Part of transactional logic, Admin-only API.
*   **Implementation Steps:**
    *   Implement inventory decrement logic within the Order Creation transaction.
    *   (Optional) Create admin routes (e.g., PUT `/admin/products/:id/inventory`) for manual stock adjustments.
    *   Apply `authenticateToken` and `adminAuthMiddleware` to admin inventory routes.
    *   In admin inventory update handler:
        *   Get product ID from `req.params`.
        *   Get new inventory value from `req.body`.
        *   Update product inventory in DB using Prisma.
        *   Send success response.
*   **Express.js Support:** Triggers inventory updates through existing order routes and provides endpoints for manual adjustments.

### 9. Payment Processing

**Goal:** Integrate with a payment gateway to handle order payments.

*   **Framework:** Express.js
    *   Define routes for payment initiation and webhook handling.
*   **Database:** Prisma
    *   Store payment-related information (e.g., transaction IDs) on the `Order` model.
*   **Libraries:** Payment gateway Node.js SDK (e.g., `stripe`).
*   **Patterns:** External Service Integration, Webhook Handling.
*   **Implementation Steps:**
    *   Create `payment.routes.ts` and `payment.controller.ts`.
    *   Add POST `/orders/:orderId/pay` route.
    *   Apply `authenticateToken` middleware.
    *   In `initiatePayment` handler:
        *   Get order details.
        *   Use payment gateway SDK to create a payment intent/session.
        *   Send client-side details required by the payment gateway to the frontend (`res.json(...)`).
    *   Add POST `/webhooks/payment-gateway` route.
    *   In `handleWebhook` handler:
        *   Receive data from the payment gateway.
        *   **Crucially: Validate the webhook signature** using the SDK and your webhook secret.
        *   If valid, update the corresponding order status in DB (e.g., to 'paid', 'failed') using Prisma.
        *   Send a 200 response back to the payment gateway to acknowledge receipt.
*   **Express.js Support:** Provides the necessary HTTP endpoints for interaction with the payment gateway and webhook reception. Its popularity ensures good SDK support from payment providers.

### 10. Search and Filtering

**Goal:** Allow users to search and filter products efficiently.

*   **Framework:** Express.js
    *   Integrated into `GET /products` route handler.
*   **Database:** Prisma
    *   Use `where` clauses for filtering.
*   **Libraries:** (Optional) Search engine client (e.g., `@elastic/elasticsearch`).
*   **Patterns:** Query Parameters, Efficient Database Querying.
*   **Implementation Steps:**
    *   Modify the GET `/products` handler.
    *   Parse query parameters (`req.query`) for search terms (e.g., `q`) and filter criteria (e.g., `categoryId`).
    *   Construct dynamic Prisma queries using the `where` clause based on parsed parameters.
    *   For complex full-text search, integrate with an external search engine: call its API from the handler and use the results (e.g., product IDs) to fetch data from Prisma.
*   **Express.js Support:** Provides easy access to query parameters (`req.query`) to build dynamic database queries or interact with search services.

### 11. Reporting and Analytics (Admin Side)

**Goal:** Provide administrators with reports and analytics on sales, inventory, etc.

*   **Framework:** Express.js
    *   Define `/admin/reports/*` GET routes.
*   **Database:** Prisma
    *   Perform aggregation and raw queries.
*   **Patterns:** Admin-only API Endpoints, Complex Database Queries.
*   **Implementation Steps:**
    *   Create `report.routes.ts` and `report.controller.ts`.
    *   Define specific routes for different reports (e.g., `/admin/reports/sales-by-month`, `/admin/reports/low-inventory`).
    *   Apply `authenticateToken` and `adminAuthMiddleware` to these routes.
    *   In report handlers:
        *   Use Prisma's aggregation framework (`_sum`, `_count`, `_avg`, etc.) or raw SQL queries (`$queryRaw`) for complex data analysis.
        *   Fetch and format the report data.
        *   Send the data in JSON format (`res.json(reportData)`).
*   **Express.js Support:** Enables creation of protected API endpoints to expose report data to the frontend.