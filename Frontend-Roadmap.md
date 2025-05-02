## Frontend Roadmap - DAE Partners App (Expo/React Native)

This detailed roadmap outlines the implementation plan for the DAE Partners B2B cold drinks ordering mobile app frontend, built with Expo/React Native, to interact with the existing Express.js backend.

---

### 1. Project Setup & Core Dependencies

**Goal:** Initialize the frontend project and install essential libraries for navigation, state management, API interaction, styling, payments, and secure storage.

*   **Technology Stack:** Expo / React Native
*   **Key Libraries:**
    *   React Navigation
    *   State Management (Redux Toolkit, Zustand, Context API + hooks)
    *   Axios or fetch
    *   Styling Solution (Styled Components, NativeWind, etc.)
    *   Razorpay React Native SDK (`razorpay-react-native`)
    *   Secure Storage (Expo SecureStore)

**Implementation Steps:**

*   Initialize a new Expo project.
*   Install and configure React Navigation for app navigation structure (authentication flow vs. main app flow).
*   Install and set up the chosen state management library.
*   Install Axios or configure a fetch wrapper for API calls, including handling authentication headers (JWT).
*   Set up the chosen styling solution.
*   Install `razorpay-react-native` for payment integration.
*   Install Expo SecureStore for secure storage of sensitive user data (like JWT).
*   Define initial project folder structure.

### 2. User Authentication Flow

**Goal:** Enable users to securely sign up, log in, and maintain their authenticated session.

*   **Screens:**
    *   Login Screen: UI for user email and password input.
    *   Signup Screen: UI for user registration details (email, password, potentially pricing tier if applicable during signup).
*   **Flow:** Implement navigation between login and signup. Upon successful authentication, transition to the main application navigation stack.
*   **State Management:** Store authentication status (`isLoggedIn`, `userToken`) and basic user identifier in global state.
*   **API Integration:**
    *   Implement API calls to `POST /api/auth/login` and `POST /api/auth/signup`.
    *   Handle API responses: extract JWT token and store it securely using Expo SecureStore.
    *   Configure API client (Axios interceptor or wrapper) to include the stored JWT in the `Authorization` header for protected routes.
*   **Session Persistence:** On application launch, check SecureStore for an existing JWT. If found, validate it (e.g., by attempting a request to a protected endpoint like `/api/profile`) and automatically authenticate the user if valid.

### 3. User Profile Management

**Goal:** Allow authenticated users to view and update their personal profile information.

*   **Screens:**
    *   Profile Screen: Display fetched user details.
    *   Edit Profile Screen: Form for updating user profile fields.
*   **Navigation:** Navigate to the Profile Screen from the main app. Provide navigation from the Profile Screen to the Edit Profile Screen.
*   **State Management:** Manage the authenticated user's profile data in global state. Update state upon successful profile modifications.
*   **API Integration:**
    *   Fetch user profile data using `GET /api/profile`.
    *   Implement profile update functionality using `PUT /api/profile`.
    *   Implement client-side input validation matching backend requirements before sending PUT requests.

### 4. Product Catalog Browsing

**Goal:** Enable users to view available products, apply filters, search, handle pagination, and see accurate pricing.

*   **Screens:**
    *   Product List Screen:
        *   Display products fetched from the backend.
        *   Implement UI elements for filtering (e.g., category dropdown, price range sliders/inputs) and a search bar.
        *   Implement pagination loading (e.g., "Load More" button or infinite scroll) using the `page` and `limit` parameters of the backend API.
        *   Display the dynamically calculated `price` (discounted price) received from the backend, and optionally the `basePrice`.
    *   Product Detail Screen:
        *   Display comprehensive details for a single product.
        *   Show the calculated `price` and other product attributes.
        *   Include a quantity selector for adding the product to the cart.
        *   Add an "Add to Cart" button.
*   **Navigation:** Navigate from the Product List Screen to the Product Detail Screen when a user selects a product.
*   **State Management:** Manage the list of products, loading state, error handling, current filter/search criteria, and pagination state.
*   **API Integration:**
    *   Fetch product list using `GET /api/products`, including query parameters for filters, search, pagination (`page`, `limit`).
    *   Fetch individual product details using `GET /api/products/:id`.
    *   Implement the "Add to Cart" action (details in the next section).

### 5. Shopping Cart Management

**Goal:** Allow users to view, add, update, and remove items in their shopping cart and see calculated totals.

*   **Screens:**
    *   Cart Screen:
        *   Display items currently in the user's cart, showing product details, quantity, calculated item price, and line item total.
        *   Show the calculated cart totals: `subTotal`, `discountApplied`, and `totalAmount`.
        *   Provide UI controls to adjust the quantity of each item (e.g., increment/decrement buttons).
        *   Include a button to completely remove an item from the cart.
        *   Add a "Proceed to Checkout" button.
*   **Navigation:** Provide easy access to the Cart Screen (e.g., a persistent cart icon). Navigate from the Cart Screen to the Checkout flow.
*   **State Management:** Maintain the cart state (list of items, quantities, calculated totals) in global state. Implement optimistic updates for responsiveness, followed by syncing with the backend response.
*   **API Integration:**
    *   Fetch the initial cart data using `GET /api/cart`.
    *   Add items to cart: `POST /api/cart/items`. Process the backend response to update the local cart state.
    *   Update item quantity: `PUT /api/cart/items/:itemId`. Process the backend response.
    *   Remove items from cart: `DELETE /api/cart/items/:itemId`. Process the backend response.

### 6. Order Placement & Razorpay Integration

**Goal:** Enable users to complete the checkout process and make a payment using Razorpay.

*   **Screens:**
    *   Checkout Screen (or integrated into Cart Screen):
        *   Summarize the order based on the current cart content and the final calculated `totalAmount`.
        *   (Optional) Collect necessary order details like shipping address.
        *   "Place Order & Pay" button.
    *   Order Confirmation/Success Screen: Display confirmation upon successful payment.
    *   Payment Failure Screen: Display an error message if the payment fails.
*   **API Integration:**
    *   Initiate the order creation process by calling `POST /api/orders`.
    *   Handle the successful API response, extracting the `razorpayOrder` details (`id`, `amount`, `currency`, `receipt`), `razorpayKeyId`, `orderId` (your internal ID), and `totalAmount`.
*   **Razorpay SDK Integration:**
    *   Use the `razorpay-react-native` SDK.
    *   Upon clicking "Place Order & Pay" and receiving the backend response, invoke the Razorpay SDK's checkout method, passing the extracted Razorpay order details and Key ID.
    *   Implement callbacks for the SDK to handle payment success (`payment.captured` corresponds to successful payment for an Order created via the Orders API) and failure events.
    *   On payment success, navigate to the Order Confirmation/Success Screen.
    *   On payment failure, navigate to the Payment Failure Screen and display relevant error information.

### 7. Order History & Details

**Goal:** Provide users with access to their past order history and detailed information for each order.

*   **Screens:**
    *   Order History Screen: Display a list of the user's past orders, showing relevant summary information (order ID, date, final total amount, status).
    *   Order Detail Screen: Display comprehensive details for a selected order, including the list of `items` with their quantities and the `price` at the time of order, the `totalAmount`, and the current `status`.
*   **Navigation:** Navigate to the Order History Screen from a user dashboard or profile area. Navigate from an item in the Order History list to the specific Order Detail Screen.
*   **State Management:** Manage the list of orders in the Order History Screen's state. Manage the details of the currently viewed order in the Order Detail Screen's state.
*   **API Integration:**
    *   Fetch the list of orders for the authenticated user using `GET /api/orders`.
    *   Fetch the details of a specific order using `GET /api/orders/:id`.

---

This frontend roadmap provides a structured approach to building your mobile application, directly consuming the backend API we have developed. Each step builds upon the previous one, ensuring a logical development flow.
