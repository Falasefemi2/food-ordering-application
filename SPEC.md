# Food Ordering App — Schema Review & Product Flow Guide

> **Schema Rating: 8.5 / 10** — Solid production-ready schema. Well-normalised, good use of snapshots to protect order history, enums are clean and complete. A few gaps noted below.

---

## Schema Review

### What's Great

- **Snapshot fields on `order_items` and `order_item_customizations`** — storing `item_name`, `unit_price`, `option_name`, `price` as snapshots is exactly right. Menu prices change; order history must not drift.
- **Snapshot delivery address on `orders`** — same principle applied correctly to addresses.
- **Status transition timestamps** (`placed_at`, `accepted_at`, `prepared_at`, etc.) — great for analytics, SLA tracking, and disputes.
- **`commissionRate` per restaurant** — flexible, lets you negotiate different rates per vendor.
- **`driverStatusEnum`** (`offline`, `online_idle`, `online_busy`) — clean state machine for dispatch.
- **Soft deletes (`deletedAt`)** on `users`, `restaurants`, `menuItems` — correct approach; hard deletes would break order history.
- **`defineRelations` usage** — relations are comprehensive and well-mapped.

### Issues & Suggestions

| # | Issue | Fix |
|---|-------|-----|
| 1 | `reviews` has no `targetId` — you can't tell which restaurant or driver the review is about without joining through `orders` | Add `restaurantId` and `driverId` nullable columns to `reviews` |
| 2 | `coupons` has no `restaurantId` — you can't scope coupons to specific restaurants | Add nullable `restaurantId` FK |
| 3 | `orders` has no index on `(status, createdAt)` — admin dashboards and driver dispatch will be slow at scale | Add composite index |
| 4 | `menuItems` has `restaurantId` AND `categoryId` — the restaurant is already derivable via category. Not wrong, but redundant. Keep it for query performance, just be aware. | Fine to keep |
| 5 | `drivers.currentLatitude/Longitude` stored as `numeric` — for geospatial queries (find nearest driver) you'll eventually want PostGIS `POINT`. Not urgent for MVP. | Migrate later |
| 6 | No `notifications` table — you'll need push/SMS notification history for order updates | Add later |
| 7 | No `wallets` / `wallet_transactions` table — common in Nigerian fintech apps (Chowdeck has wallet) | Plan for v2 |

---

## Application Flow

This section walks you through every major user journey in the app, screen by screen, in the order you should build and think about them.

---

## 1. Onboarding & Authentication

### 1.1 Splash / Landing Screen
- Show logo + tagline
- Two CTAs: **Sign Up** / **Log In**
- Guest browsing option (optional — lets users browse restaurants without signing in)

### 1.2 Sign Up Flow
1. **Enter name, email, phone number, password**
2. **OTP verification** (phone or email)
3. **Role selection** — Customer is default. Drivers apply separately. Vendors are onboarded by admins.
4. **Location permission prompt** — needed immediately for restaurant discovery
5. Land on **Home Screen**

> DB: `POST /auth/register` → creates row in `users` with `role = "customer"`

### 1.3 Log In Flow
1. Email + password OR phone OTP
2. On success → JWT issued, redirect to Home

### 1.4 Forgot Password
- Enter email → receive reset link → set new password

---

## 2. Home Screen (Customer)

The most important screen. Drives all discovery.

**Layout:**
```
[ Search Bar — "Find restaurants, dishes..." ]
[ Current Delivery Address ▼ ]

[ Hero Banner / Promotions Carousel ]

[ Category Pills: 🍔 Burgers  🍕 Pizza  🍜 Rice  🌮 ... ]

[ Section: "Restaurants Near You" ]
  → Restaurant Cards (logo, name, rating, delivery time, min order)

[ Section: "Popular Dishes" ]
[ Section: "Recently Ordered" ] (if returning user)
```

> DB: Query `restaurants` filtered by `isOpen = true`, ordered by proximity (lat/lng from user's current address or device GPS), plus `ratingAvg`.

**Delivery Address Selector:**
- Shows user's saved addresses from `addresses` table
- "Add new address" opens map picker
- Selected address drives the restaurant list and delivery fee calculation

---

## 3. Restaurant Discovery

### 3.1 Search Screen
- Full-text search across `restaurants.name` and `menuItems.name`
- Filter chips: **Open Now**, **Price Range**, **Rating**, **Cuisine**
- Sort by: **Nearest**, **Most Popular**, **Fastest Delivery**

### 3.2 Restaurant Listing Card
Each card shows:
- `logoUrl`, `name`
- `ratingAvg` + `ratingCount`
- `estimatedPrepTime` + estimated delivery time
- `isOpen` badge (green/grey)
- Distance from user

---

## 4. Restaurant Page

### 4.1 Header
- `bannerUrl` as hero image
- `logoUrl`, `name`, `description`
- Rating, delivery time, minimum order
- "Info" tab → address, phone, opening/closing hours

### 4.2 Menu Tab
- Rendered as **sticky category tabs** at top (from `menuCategories`, ordered by `sortOrder`)
- Each category section lists its `menuItems`
- Each item card: `imageUrl`, `name`, `description`, `price`, `isVegetarian` badge, `calories`
- Unavailable items (`isAvailable = false`) shown greyed out

### 4.3 Item Detail / Customization Sheet
Opens as a bottom sheet when user taps an item.

```
[ Item Image ]
[ Name + Price ]
[ Description ]

[ Customization Group: "Choose Size" (required) ]
  ○ Small  (+₦0)
  ● Large  (+₦500)

[ Customization Group: "Add Extras" (optional, pick up to 3) ]
  ☐ Extra Cheese  +₦200
  ☑ Bacon         +₦300
  ☐ Jalapeños     +₦100

[ Quantity Stepper: − 1 + ]
[ Add to Cart  ₦3,800 ]
```

> DB: Load `customizationGroups` + `customizationOptions` for the item. Enforce `minSelectable`/`maxSelectable` client-side.

---

## 5. Cart

### 5.1 Cart Screen
- Lists all items with quantities, unit prices, customization summaries
- Subtotal, delivery fee, service fee, tip
- **Coupon code field** → validate against `coupons` table (check `isActive`, `startDate`, `endDate`, `minOrderValue`, `usageLimit`)
- Discount applied and shown as a line item
- **"Proceed to Checkout"** button

> **Important rule:** Cart must be from ONE restaurant only. If user adds from a different restaurant, show a warning: "Start a new order? Your current cart will be cleared."

### 5.2 Cart Persistence
- Store cart in local state / localStorage on client
- Don't persist to DB until order is placed

---

## 6. Checkout

### 6.1 Delivery Details
- Show selected delivery address (pre-filled from user's default address)
- Change address option
- Delivery notes text field (maps to `orders.deliveryNotes`)

### 6.2 Payment Method Selection
- Card, Bank Transfer, Wallet, Cash on Delivery
- Maps to `paymentMethodEnum`
- Saved cards shown if available

### 6.3 Order Summary
- Final breakdown: subtotal, delivery fee, service fee, discount, tip, **total**
- Estimated delivery time

### 6.4 Place Order
- User taps **"Place Order ₦X,XXX"**
- Flow:
  1. Create `orders` row with `status = "pending"`, `paymentStatus = "pending"`
  2. Create `orderItems` rows + `orderItemCustomizations` rows (with snapshots)
  3. Initiate payment via gateway (Paystack/Flutterwave) → creates `payments` row with `status = "pending"`
  4. On payment success → `orders.paymentStatus = "paid"`, `orders.status = "placed"`, `orders.placedAt = now()`
  5. Push notification to restaurant

---

## 7. Order Tracking (Customer)

### 7.1 Active Order Screen

This screen polls or subscribes (WebSocket/SSE) for order status updates.

```
[ Progress Bar ]
✅ Order Placed
✅ Accepted by Restaurant
🔄 Preparing Your Food...
○  Ready for Pickup
○  Driver Assigned
○  On the Way
○  Delivered

[ Map ] — shows driver's live location once assigned
[ ETA: ~20 mins ]
[ Contact Driver ] [ Contact Restaurant ]
```

Status transitions and what triggers them:

| Status | Trigger | Timestamp column |
|--------|---------|-----------------|
| `pending` | Order created | `createdAt` |
| `placed` | Payment confirmed | `placedAt` |
| `accepted_by_restaurant` | Restaurant taps "Accept" | `acceptedAt` |
| `preparing` | Restaurant taps "Start Preparing" | — |
| `ready_for_pickup` | Restaurant taps "Ready" | `preparedAt` |
| `driver_assigned` | Dispatch assigns driver | — |
| `picked_up_by_driver` | Driver taps "Picked Up" | `pickedUpAt` |
| `delivered` | Driver taps "Delivered" | `deliveredAt` |

### 7.2 Cancellation
- Customer can cancel only while `status = "pending"` or `"placed"`
- Sets `cancellationSource = "customer"`, `cancellationReason`, `cancelledAt`, `status = "cancelled"`
- Triggers refund flow → `payments.status = "refunded"`, `orders.paymentStatus = "refunded"`

---

## 8. Order History & Reviews

### 8.1 Orders Tab
- List of past orders (newest first)
- Each shows: restaurant name, date, total, status badge
- Tap → Order Detail screen (full receipt)

### 8.2 Review Flow
- Shown after `status = "delivered"`
- Prompt: "How was your order?"
- Two review cards:
  - **Restaurant review** (`reviewType = "restaurant"`) → 1–5 stars + comment
  - **Driver review** (`reviewType = "driver"`) → 1–5 stars + comment
- On submit: create rows in `reviews`, then update `restaurants.ratingAvg` / `drivers.ratingAvg` (computed in backend)

---

## 9. User Profile & Settings

- Edit name, phone, avatar
- **Saved Addresses** — list from `addresses` table, set default, add/edit/delete
- Payment Methods — saved cards
- Notification preferences
- Log out / Delete account (sets `users.deletedAt`)

---

## 10. Vendor (Restaurant) Portal

A separate web dashboard for restaurant owners.

### 10.1 Dashboard
- Today's orders count, revenue, avg rating
- Active orders panel (live feed)

### 10.2 Order Management
- **Incoming Orders** — accept or reject with a reason
- **Active Orders** — mark as "Preparing" → "Ready for Pickup"
- **Order History** — completed/cancelled orders

### 10.3 Menu Management
- Create/edit/delete `menuCategories` (with `sortOrder` drag-and-drop)
- Create/edit/delete `menuItems`
- Toggle `isAvailable` per item (e.g. "Sold Out Today")
- Manage `customizationGroups` and `customizationOptions` per item

### 10.4 Restaurant Settings
- Edit profile: logo, banner, description, hours (`openingTime`/`closingTime`)
- Toggle `isOpen` (for manual override, e.g. public holiday)

---

## 11. Driver App

A separate mobile app (or app mode) for drivers.

### 11.1 Go Online / Offline
- Toggle sets `drivers.status` to `online_idle` or `offline`
- While online, app continuously updates `currentLatitude`, `currentLongitude`, `lastLocationUpdate`

### 11.2 Delivery Request
- Push notification for a new delivery
- Shows: pickup restaurant, delivery address, estimated distance, estimated payout
- Accept / Decline (with timeout → auto-decline)
- On accept: `orders.driverId` set, `status = "driver_assigned"`

### 11.3 Active Delivery
```
[ Map with route ]
[ Pickup: Restaurant Name — Navigate ]
→ Tap "Picked Up" → status = "picked_up_by_driver"

[ Dropoff: Customer Address — Navigate ]
→ Tap "Delivered" → status = "delivered"
```

### 11.4 Earnings History
- List of completed deliveries with payout per trip

---

## 12. Admin Panel

Internal tool. Can be a simple web app.

- User management (activate/deactivate, change roles)
- Restaurant onboarding & approval
- Driver onboarding & verification
- Order oversight (resolve disputes, manual status overrides)
- **Coupon management** — create/edit coupons in the `coupons` table
- Revenue reports, commission tracking

---

## Build Order Recommendation

Build in this sequence to ship value fast:

```
Phase 1 — Core Loop (MVP)
  ✅ Auth (sign up, log in)
  ✅ Restaurant listing + menu browsing
  ✅ Cart + Checkout + Payment
  ✅ Order placement + status tracking (polling)
  ✅ Basic vendor portal (accept/reject orders, mark ready)

Phase 2 — Driver & Ops
  ✅ Driver app (go online, accept delivery, update status)
  ✅ Live driver location on customer tracking screen
  ✅ Reviews system
  ✅ Coupon / promotions

Phase 3 — Growth Features
  ✅ Wallet / loyalty
  ✅ Push notifications
  ✅ Admin analytics dashboard
  ✅ PostGIS for real geo-queries
```

---

*Schema authored by you. Flow guide prepared based on schema analysis. Good luck shipping!*
