# Food Delivery Platform — Project Brief

> **Stack:** Effect-TS v4 · Bun · Drizzle ORM · PostgreSQL (`postgres` porsager driver) · Biome
> **Style:** Functional, typed end-to-end. No `Context.Tag` — use `Context.Service` pattern throughout.

---

## What We're Building

A production-grade food delivery platform modelled after Chowdeck. The system handles three classes of users — **customers**, **vendors (restaurant owners)**, and **drivers** — coordinated through a central order lifecycle with real-time dispatch logic.

---

## Domain Overview

### Users & Identity

All humans in the system share a single `users` table with a `role` enum (`customer | driver | vendor | admin | support`). Soft deletes via `deletedAt`. A user can save multiple delivery `addresses`, one flagged as default.

Authentication is password-based (`passwordHash`) with optional phone number. OAuth or token tables are not in the schema yet — **you may add them if needed**.

---

### Restaurants (Vendors)

Restaurants are owned by a `vendor` user. Each restaurant goes through an **approval workflow** (`pending → approved | rejected | suspended`) before going live. Key fields:

- `isOpen` — toggled by vendor; controls whether orders can be placed
- `openingTime / closingTime` — format `"HH:MM"`
- `estimatedPrepTime` — minutes, used for ETA calculation
- `commissionRate` — platform cut (default 10%)
- `ratingAvg / ratingCount` — denormalized for fast reads, updated when reviews are submitted
- Geo coordinates for proximity search

---

### Menu

```
Restaurant → MenuCategories → MenuItems → CustomizationGroups → CustomizationOptions
```

- A `menuItem` belongs to both a `menuCategory` and a `restaurant` (for fast per-restaurant queries without joining categories).
- `CustomizationGroups` model option sets (e.g. "Choose Size"), with `minSelectable` / `maxSelectable` constraints and an `isRequired` flag.
- `CustomizationOptions` are the individual choices within a group (e.g. "Large +₦500"). Price defaults to `0.00`.

---

### Coupons

Coupons are either **platform-wide** (`restaurantId = null`) or **restaurant-specific**. Discount is either a fixed amount or a percentage, capped by `maxDiscount`. They have a validity window (`startDate / endDate`), an optional `usageLimit`, and a running `usageCount`.

---

### Orders

The order lifecycle is tracked via `orderStatusEnum`:

```
pending → placed → accepted_by_restaurant → preparing
       → ready_for_pickup → driver_assigned → picked_up_by_driver
       → delivered | cancelled | refunded
```

Timestamp columns (`placedAt`, `acceptedAt`, `preparedAt`, `pickedUpAt`, `deliveredAt`, `cancelledAt`) snapshot each transition for SLA tracking and analytics.

**Price breakdown stored on the order:**

| Field | Purpose |
|---|---|
| `subtotal` | Sum of item prices before fees |
| `deliveryFee` | Charged to customer |
| `serviceFee` | Platform fee |
| `driverTip` | Optional tip |
| `discountAmount` | Applied coupon reduction |
| `totalPrice` | Final amount charged |

**Address snapshot** — `deliveryAddressLine`, `deliveryCity`, `deliveryLatitude`, `deliveryLongitude` are copied from the user's address at order time, so future address edits don't corrupt order history.

**Cancellation** includes a `cancellationSource` (`customer | restaurant | driver | system`) and a free-text `cancellationReason`.

---

### Order Items & Customizations

`OrderItems` snapshot the menu item name and unit price at order time (so menu changes don't break history). `OrderItemCustomizations` do the same for selected options.

```
Order → OrderItems → OrderItemCustomizations
```

---

### Dispatch (Delivery Requests)

When an order is ready for pickup, the dispatch system assigns drivers one at a time via `deliveryRequests`. Each request has a short `expiresAt` window (e.g. 30 seconds). A driver can `accept`, `decline`, or let it `expire` — in which case the system tries the next available driver.

```
Order → DeliveryRequests (one per driver attempt) → Driver accepts → Order.driverId set
```

---

### Reviews

Reviews are tied to an **order** (one review per order-type pair). The `reviewType` enum distinguishes restaurant vs driver reviews. Rating is a plain integer (validate 1–5 in the application layer). Submitting a review should trigger a background job to recalculate `ratingAvg` and `ratingCount` on the target entity.

---

### Payments

A `payments` record is created for each payment attempt against an order. It stores the gateway name (`paystack`, `flutterwave`, etc.) and `gatewayReference` (unique — enforced by index). `paymentStatus` mirrors order-level `paymentStatus` but at the transaction level.

---

## Effect-TS v4 Conventions

- Use `Context.Service` for all service definitions — never `Context.Tag`.
- Model domain errors as tagged union types and surface them through `Effect` error channels (not thrown exceptions).
- Use `Effect.gen` for sequencing; prefer pipe/flow for simple transformations.
- Layer composition: define `Live` and `Test` layers separately. Wire the full app layer in `main.ts`.
- Database access goes through a `DbService` that wraps the `postgres` (porsager) client, provided as a Layer.
- Background work (rating recalculation, dispatch polling, coupon usage increments) should be modelled as `Effect` fibers or a job queue — **the schema is compatible with `effectq` (your PostgreSQL-backed job queue on Effect-TS v4)**.

---

## Schema File

The canonical schema lives at `src/db/schema.ts`. It exports:

**Enums:** `roleEnum`, `driverStatusEnum`, `orderStatusEnum`, `paymentStatusEnum`, `paymentMethodEnum`, `cancellationSourceEnum`, `reviewTypeEnum`, `couponTypeEnum`, `restaurantApprovalEnum`, `driverApprovalStatusEnum`, `vehicleTypeEnum`, `deliveryRequestStatusEnum`

**Tables:** `users`, `addresses`, `restaurants`, `drivers`, `deliveryRequests`, `menuCategories`, `menuItems`, `customizationGroups`, `customizationOptions`, `coupons`, `orders`, `orderItems`, `orderItemCustomizations`, `reviews`, `payments`

**Relations:** exported as `relations` (defined with `defineRelations` from `drizzle-orm`)

---

## Open Design Questions (LLM May Extend Schema)

The schema is intentionally lean in places. Feel free to add tables or columns where you see gaps:

1. **Auth tokens / sessions** — no refresh token or session table yet. Add one if building JWT or session-based auth.
2. **Notifications** — no push/SMS notification log. Consider an `notifications` table if building real-time driver/customer alerts.
3. **Driver earnings / payouts** — no ledger for driver commission tracking.
4. **Restaurant hours per day** — current schema stores a single `openingTime / closingTime`. A `restaurantHours` table (one row per day of week) would support varied schedules.
5. **OTP / phone verification** — no table for phone OTP flows.
6. **Menu item tags** — no tagging system (e.g. "spicy", "new", "best seller").

When adding to the schema, follow the same Drizzle ORM patterns already in use and keep the Effect-TS layer structure consistent.

---

## Key Invariants to Enforce in Application Logic

- An order can only be placed against an `approved` restaurant with `isOpen = true`.
- A driver must have `approvalStatus = 'approved'` before they can receive `deliveryRequests`.
- `OrderItem.totalPrice` = `unitPrice × quantity` + sum of selected `CustomizationOption.price`.
- `Order.totalPrice` = `subtotal + deliveryFee + serviceFee + driverTip - discountAmount`.
- Coupon `usageCount` must be incremented atomically — use a SELECT FOR UPDATE or advisory lock.
- Only one `reviews` record per `(orderId, reviewType)` — enforce with a unique index (not yet in schema).
- `payments.gatewayReference` is unique — never create a duplicate charge for the same gateway transaction.
