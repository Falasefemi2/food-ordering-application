import {
	pgTable,
	uuid,
	varchar,
	text,
	pgEnum,
	integer,
	numeric,
	boolean,
	timestamp,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { defineRelations } from "drizzle-orm";

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", [
	"customer",
	"driver",
	"vendor",
	"admin",
	"support",
]);

export const driverStatusEnum = pgEnum("driver_status", [
	"offline",
	"online_idle",
	"online_busy",
]);

export const orderStatusEnum = pgEnum("order_status", [
	"pending",
	"placed",
	"accepted_by_restaurant",
	"preparing",
	"ready_for_pickup",
	"driver_assigned",
	"picked_up_by_driver",
	"delivered",
	"cancelled",
	"refunded",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
	"pending",
	"authorized",
	"paid",
	"failed",
	"refunded",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
	"card",
	"bank_transfer",
	"wallet",
	"cash_on_delivery",
]);

export const cancellationSourceEnum = pgEnum("cancellation_source", [
	"customer",
	"restaurant",
	"driver",
	"system",
]);

export const reviewTypeEnum = pgEnum("review_type", ["restaurant", "driver"]);

export const couponTypeEnum = pgEnum("coupon_type", [
	"percentage",
	"fixed_amount",
]);

export const restaurantApprovalEnum = pgEnum("restaurant_approval_status", [
	"pending",
	"approved",
	"rejected",
	"suspended",
]);

export const driverApprovalStatusEnum = pgEnum("driver_approval_status", [
	"pending",
	"approved",
	"rejected",
	"suspended",
]);

export const vehicleTypeEnum = pgEnum("vehicle_type", [
	"bicycle",
	"motorbike",
	"car",
]);

export const deliveryRequestStatusEnum = pgEnum("delivery_request_status", [
	"pending",
	"accepted",
	"declined",
	"expired",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
	"order_update",
	"driver_alert",
	"promo",
	"system",
]);

export const walletTransactionTypeEnum = pgEnum("wallet_transaction_type", [
	"credit",
	"debit",
]);

// ─── TABLES ───────────────────────────────────────────────────────────────────

export const users = pgTable(
	"users",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		firstName: varchar("first_name", { length: 100 }).notNull(),
		lastName: varchar("last_name", { length: 100 }).notNull(),
		email: varchar("email", { length: 255 }).notNull(),
		// FIX: phoneNumber is nullable — unique index must be partial (handled in DB,
		// we enforce uniqueness in app logic for non-null values via service layer)
		phoneNumber: varchar("phone_number", { length: 50 }),
		phoneVerified: boolean("phone_verified")
			.default(false)
			.notNull(),
		passwordHash: varchar("password_hash", { length: 255 }),
		role: roleEnum().default("customer").notNull(),
		avatarUrl: varchar("avatar_url", { length: 512 }),
		isActive: boolean("is_active").default(true).notNull(),
		// ADDED: wallet balance — denormalized for fast reads, mutated via walletTransactions
		walletBalance: numeric("wallet_balance", {
			precision: 12,
			scale: 2,
		})
			.default("0.00")
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("users_email_uidx").on(table.email),
		// FIX: removed unique index on phoneNumber — nullable columns + unique index
		// causes duplicate null violations in PostgreSQL. Enforce in service layer instead.
		index("users_phone_idx").on(table.phoneNumber),
		index("users_role_idx").on(table.role),
	],
);

export const addresses = pgTable(
	"addresses",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		label: varchar("label", { length: 50 })
			.default("Home")
			.notNull(),
		addressLine1: varchar("address_line1", {
			length: 255,
		}).notNull(),
		addressLine2: varchar("address_line2", { length: 255 }),
		city: varchar("city", { length: 100 }).notNull(),
		state: varchar("state", { length: 100 }).notNull(),
		country: varchar("country", { length: 100 })
			.default("Nigeria")
			.notNull(),
		postalCode: varchar("postal_code", { length: 20 }),
		latitude: numeric("latitude", {
			precision: 9,
			scale: 6,
		}).notNull(),
		longitude: numeric("longitude", {
			precision: 9,
			scale: 6,
		}).notNull(),
		isDefault: boolean("is_default").default(false).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [index("addresses_user_id_idx").on(table.userId)],
);

// ADDED: sessions table for JWT refresh token management
export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		// Store hashed refresh token — never the raw token
		refreshTokenHash: varchar("refresh_token_hash", {
			length: 255,
		}).notNull(),
		userAgent: varchar("user_agent", { length: 512 }),
		ipAddress: varchar("ip_address", { length: 45 }), // supports IPv6
		expiresAt: timestamp("expires_at", {
			withTimezone: true,
		}).notNull(),
		// null = active session; set to revoke
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("sessions_user_id_idx").on(table.userId),
		// Fast lookup by token hash during refresh
		index("sessions_refresh_token_hash_idx").on(
			table.refreshTokenHash,
		),
	],
);

export const restaurants = pgTable(
	"restaurants",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => users.id),
		name: varchar("name", { length: 255 }).notNull(),
		description: text("description"),
		logoUrl: varchar("logo_url", { length: 512 }),
		bannerUrl: varchar("banner_url", { length: 512 }),
		phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
		email: varchar("email", { length: 255 }).notNull(),
		addressLine: varchar("address_line", { length: 255 }).notNull(),
		city: varchar("city", { length: 100 }).notNull(),
		state: varchar("state", { length: 100 }).notNull(),
		country: varchar("country", { length: 100 })
			.default("Nigeria")
			.notNull(),
		approvalStatus: restaurantApprovalEnum()
			.default("pending")
			.notNull(),
		rejectionReason: text("rejection_reason"),
		latitude: numeric("latitude", {
			precision: 9,
			scale: 6,
		}).notNull(),
		longitude: numeric("longitude", {
			precision: 9,
			scale: 6,
		}).notNull(),
		isOpen: boolean("is_open").default(true).notNull(),
		openingTime: varchar("opening_time", { length: 5 }).notNull(), // "HH:MM"
		closingTime: varchar("closing_time", { length: 5 }).notNull(), // "HH:MM"
		estimatedPrepTime: integer("estimated_prep_time")
			.default(20)
			.notNull(), // minutes
		commissionRate: numeric("commission_rate", {
			precision: 4,
			scale: 2,
		})
			.default("10.00")
			.notNull(),
		ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 })
			.default("0.00")
			.notNull(),
		ratingCount: integer("rating_count").default(0).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("restaurants_owner_id_idx").on(table.ownerId),
		index("restaurants_approval_status_idx").on(
			table.approvalStatus,
		),
		index("restaurants_city_idx").on(table.city),
	],
);

export const drivers = pgTable(
	"drivers",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		vehicleType: vehicleTypeEnum().notNull(),
		vehiclePlateNumber: varchar("vehicle_plate_number", {
			length: 50,
		}),
		vehicleColor: varchar("vehicle_color", { length: 50 }),
		vehicleModel: varchar("vehicle_model", { length: 100 }),
		licenseNumber: varchar("license_number", { length: 100 }),
		licenseImageUrl: varchar("license_image_url", { length: 512 }),
		vehicleImageUrl: varchar("vehicle_image_url", { length: 512 }),
		nationalIdImageUrl: varchar("national_id_image_url", {
			length: 512,
		}),
		approvalStatus: driverApprovalStatusEnum()
			.default("pending")
			.notNull(),
		rejectionReason: text("rejection_reason"),
		approvedAt: timestamp("approved_at", { withTimezone: true }),
		approvedBy: uuid("approved_by").references(() => users.id),
		status: driverStatusEnum().default("offline").notNull(),
		currentLatitude: numeric("current_latitude", {
			precision: 9,
			scale: 6,
		}),
		currentLongitude: numeric("current_longitude", {
			precision: 9,
			scale: 6,
		}),
		lastLocationUpdate: timestamp("last_location_update", {
			withTimezone: true,
		}),
		ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 })
			.default("0.00")
			.notNull(),
		ratingCount: integer("rating_count").default(0).notNull(),
		totalDeliveries: integer("total_deliveries")
			.default(0)
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("drivers_user_id_uidx").on(table.userId),
		index("drivers_status_idx").on(table.status),
		index("drivers_approval_status_idx").on(table.approvalStatus),
	],
);

export const menuCategories = pgTable(
	"menu_categories",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		restaurantId: uuid("restaurant_id")
			.notNull()
			.references(() => restaurants.id, {
				onDelete: "cascade",
			}),
		name: varchar("name", { length: 100 }).notNull(),
		description: text("description"),
		sortOrder: integer("sort_order").default(0).notNull(),
		isActive: boolean("is_active").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("menu_categories_restaurant_id_idx").on(
			table.restaurantId,
		),
	],
);

export const menuItems = pgTable(
	"menu_items",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		categoryId: uuid("category_id")
			.notNull()
			.references(() => menuCategories.id, {
				onDelete: "cascade",
			}),
		restaurantId: uuid("restaurant_id")
			.notNull()
			.references(() => restaurants.id, {
				onDelete: "cascade",
			}),
		name: varchar("name", { length: 255 }).notNull(),
		description: text("description"),
		price: numeric("price", { precision: 10, scale: 2 }).notNull(),
		imageUrl: varchar("image_url", { length: 512 }),
		isAvailable: boolean("is_available").default(true).notNull(),
		isVegetarian: boolean("is_vegetarian").default(false).notNull(),
		calories: integer("calories"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("menu_items_restaurant_id_idx").on(table.restaurantId),
		index("menu_items_category_id_idx").on(table.categoryId),
	],
);

export const customizationGroups = pgTable(
	"customization_groups",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		menuItemId: uuid("menu_item_id")
			.notNull()
			.references(() => menuItems.id, {
				onDelete: "cascade",
			}),
		name: varchar("name", { length: 100 }).notNull(),
		minSelectable: integer("min_selectable").default(0).notNull(),
		maxSelectable: integer("max_selectable").default(1).notNull(),
		isRequired: boolean("is_required").default(false).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("customization_groups_menu_item_id_idx").on(
			table.menuItemId,
		),
	],
);

export const customizationOptions = pgTable(
	"customization_options",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		groupId: uuid("group_id")
			.notNull()
			.references(() => customizationGroups.id, {
				onDelete: "cascade",
			}),
		name: varchar("name", { length: 100 }).notNull(),
		price: numeric("price", { precision: 10, scale: 2 })
			.default("0.00")
			.notNull(),
		isAvailable: boolean("is_available").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("customization_options_group_id_idx").on(table.groupId),
	],
);

export const coupons = pgTable(
	"coupons",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		restaurantId: uuid("restaurant_id").references(
			() => restaurants.id,
			{
				onDelete: "cascade",
			},
		), // null = platform-wide
		code: varchar("code", { length: 50 }).notNull(),
		discountType: couponTypeEnum().notNull(),
		discountValue: numeric("discount_value", {
			precision: 10,
			scale: 2,
		}).notNull(),
		maxDiscount: numeric("max_discount", {
			precision: 10,
			scale: 2,
		}),
		minOrderValue: numeric("min_order_value", {
			precision: 10,
			scale: 2,
		})
			.default("0.00")
			.notNull(),
		startDate: timestamp("start_date", {
			withTimezone: true,
		}).notNull(),
		endDate: timestamp("end_date", {
			withTimezone: true,
		}).notNull(),
		usageLimit: integer("usage_limit"), // null = unlimited
		usageCount: integer("usage_count").default(0).notNull(),
		isActive: boolean("is_active").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [uniqueIndex("coupons_code_uidx").on(table.code)],
);

export const orders = pgTable(
	"orders",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		customerId: uuid("customer_id")
			.notNull()
			.references(() => users.id),
		restaurantId: uuid("restaurant_id")
			.notNull()
			.references(() => restaurants.id),
		driverId: uuid("driver_id").references(() => drivers.id),
		couponId: uuid("coupon_id").references(() => coupons.id),
		status: orderStatusEnum().default("pending").notNull(),
		// Price breakdown
		subtotal: numeric("subtotal", {
			precision: 10,
			scale: 2,
		}).notNull(),
		deliveryFee: numeric("delivery_fee", {
			precision: 10,
			scale: 2,
		})
			.default("0.00")
			.notNull(),
		serviceFee: numeric("service_fee", { precision: 10, scale: 2 })
			.default("0.00")
			.notNull(),
		discountAmount: numeric("discount_amount", {
			precision: 10,
			scale: 2,
		})
			.default("0.00")
			.notNull(),
		driverTip: numeric("driver_tip", { precision: 10, scale: 2 })
			.default("0.00")
			.notNull(),
		totalPrice: numeric("total_price", {
			precision: 10,
			scale: 2,
		}).notNull(),
		// Address snapshot — frozen at order time
		// ADDED: deliveryAddressId for analytics / reorder UX (does not affect snapshot)
		deliveryAddressId: uuid("delivery_address_id").references(
			() => addresses.id,
			{ onDelete: "set null" },
		),
		deliveryAddressLine: varchar("delivery_address_line", {
			length: 255,
		}).notNull(),
		deliveryCity: varchar("delivery_city", {
			length: 100,
		}).notNull(),
		deliveryLatitude: numeric("delivery_latitude", {
			precision: 9,
			scale: 6,
		}).notNull(),
		deliveryLongitude: numeric("delivery_longitude", {
			precision: 9,
			scale: 6,
		}).notNull(),
		deliveryNotes: text("delivery_notes"),
		paymentStatus: paymentStatusEnum().default("pending").notNull(),
		paymentMethod: paymentMethodEnum().notNull(),
		cancellationReason: text("cancellation_reason"),
		cancellationSource: cancellationSourceEnum(),
		// Status transition timestamps for SLA tracking
		placedAt: timestamp("placed_at", { withTimezone: true }),
		acceptedAt: timestamp("accepted_at", { withTimezone: true }),
		preparedAt: timestamp("prepared_at", { withTimezone: true }),
		pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
		deliveredAt: timestamp("delivered_at", { withTimezone: true }),
		cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("orders_customer_id_idx").on(table.customerId),
		index("orders_restaurant_id_idx").on(table.restaurantId),
		index("orders_driver_id_idx").on(table.driverId),
		index("orders_status_idx").on(table.status),
		index("orders_status_created_at_idx").on(
			table.status,
			table.createdAt,
		),
	],
);

export const orderItems = pgTable(
	"order_items",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		menuItemId: uuid("menu_item_id").references(
			() => menuItems.id,
			{
				onDelete: "set null",
			},
		),
		itemName: varchar("item_name", { length: 255 }).notNull(), // snapshot
		quantity: integer("quantity").default(1).notNull(),
		unitPrice: numeric("unit_price", {
			precision: 10,
			scale: 2,
		}).notNull(), // snapshot
		totalPrice: numeric("total_price", {
			precision: 10,
			scale: 2,
		}).notNull(), // snapshot
	},
	(table) => [index("order_items_order_id_idx").on(table.orderId)],
);

export const orderItemCustomizations = pgTable(
	"order_item_customizations",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		orderItemId: uuid("order_item_id")
			.notNull()
			.references(() => orderItems.id, {
				onDelete: "cascade",
			}),
		customizationOptionId: uuid(
			"customization_option_id",
		).references(() => customizationOptions.id, {
			onDelete: "set null",
		}),
		optionName: varchar("option_name", { length: 100 }).notNull(), // snapshot
		price: numeric("price", { precision: 10, scale: 2 })
			.default("0.00")
			.notNull(), // snapshot
	},
	(table) => [
		index("order_item_customizations_order_item_id_idx").on(
			table.orderItemId,
		),
	],
);

export const deliveryRequests = pgTable(
	"delivery_requests",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		driverId: uuid("driver_id")
			.notNull()
			.references(() => drivers.id),
		status: deliveryRequestStatusEnum()
			.default("pending")
			.notNull(),
		expiresAt: timestamp("expires_at", {
			withTimezone: true,
		}).notNull(),
		respondedAt: timestamp("responded_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("delivery_requests_order_id_idx").on(table.orderId),
		index("delivery_requests_driver_id_idx").on(table.driverId),
		index("delivery_requests_status_idx").on(table.status),
	],
);

export const reviews = pgTable(
	"reviews",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		customerId: uuid("customer_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		restaurantId: uuid("restaurant_id").references(
			() => restaurants.id,
			{
				onDelete: "set null",
			},
		),
		driverId: uuid("driver_id").references(() => drivers.id, {
			onDelete: "set null",
		}),
		reviewType: reviewTypeEnum().notNull(),
		rating: integer("rating").notNull(), // validate 1–5 in service layer
		comment: text("comment"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// FIX: enforce one review per order per type
		uniqueIndex("reviews_order_id_review_type_uidx").on(
			table.orderId,
			table.reviewType,
		),
		index("reviews_customer_id_idx").on(table.customerId),
		index("reviews_restaurant_id_idx").on(table.restaurantId),
		index("reviews_driver_id_idx").on(table.driverId),
	],
);

export const payments = pgTable(
	"payments",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id),
		amount: numeric("amount", {
			precision: 10,
			scale: 2,
		}).notNull(),
		status: paymentStatusEnum().default("pending").notNull(),
		paymentMethod: paymentMethodEnum().notNull(),
		gateway: varchar("gateway", { length: 50 }).notNull(), // "paystack" | "flutterwave"
		gatewayReference: varchar("gateway_reference", {
			length: 255,
		}).notNull(),
		gatewayResponse: text("gateway_response"), // raw webhook payload for audit
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("payments_order_id_idx").on(table.orderId),
		index("payments_user_id_idx").on(table.userId),
		uniqueIndex("payments_gateway_ref_uidx").on(
			table.gatewayReference,
		),
	],
);

// ADDED: notifications table for push/in-app alerts
export const notifications = pgTable(
	"notifications",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: notificationTypeEnum().notNull(),
		title: varchar("title", { length: 255 }).notNull(),
		body: text("body").notNull(),
		// Polymorphic reference — e.g. orderId, promotionId
		referenceId: uuid("reference_id"),
		referenceType: varchar("reference_type", { length: 50 }), // "order" | "promo" etc.
		isRead: boolean("is_read").default(false).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("notifications_user_id_idx").on(table.userId),
		// Fast unread badge count query
		index("notifications_user_id_is_read_idx").on(
			table.userId,
			table.isRead,
		),
	],
);

// ADDED: wallet transaction ledger — source of truth for wallet balance
// walletBalance on users is a denormalized cache; this is the audit trail
export const walletTransactions = pgTable(
	"wallet_transactions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: walletTransactionTypeEnum().notNull(),
		amount: numeric("amount", {
			precision: 12,
			scale: 2,
		}).notNull(),
		// Balance after this transaction — enables point-in-time reconstruction
		balanceAfter: numeric("balance_after", {
			precision: 12,
			scale: 2,
		}).notNull(),
		description: varchar("description", { length: 255 }).notNull(),
		// What triggered this transaction
		referenceId: uuid("reference_id"), // e.g. orderId, paymentId
		referenceType: varchar("reference_type", { length: 50 }), // "order" | "topup" | "refund"
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("wallet_transactions_user_id_idx").on(table.userId),
		index("wallet_transactions_user_id_created_at_idx").on(
			table.userId,
			table.createdAt,
		),
	],
);

// ─── RELATIONS ────────────────────────────────────────────────────────────────

const schema = {
	users,
	addresses,
	sessions,
	restaurants,
	drivers,
	menuCategories,
	menuItems,
	customizationGroups,
	customizationOptions,
	coupons,
	orders,
	orderItems,
	orderItemCustomizations,
	deliveryRequests,
	reviews,
	payments,
	notifications,
	walletTransactions,
};

export const relations = defineRelations(schema, (r) => ({
	users: {
		addresses: r.many.addresses(),
		sessions: r.many.sessions(),
		driverProfile: r.one.drivers({
			from: r.users.id,
			to: r.drivers.userId,
		}),
		orders: r.many.orders(),
		reviews: r.many.reviews(),
		payments: r.many.payments(),
		notifications: r.many.notifications(),
		walletTransactions: r.many.walletTransactions(),
	},
	addresses: {
		user: r.one.users({
			from: r.addresses.userId,
			to: r.users.id,
		}),
	},
	sessions: {
		user: r.one.users({
			from: r.sessions.userId,
			to: r.users.id,
		}),
	},
	restaurants: {
		owner: r.one.users({
			from: r.restaurants.ownerId,
			to: r.users.id,
		}),
		menuCategories: r.many.menuCategories(),
		menuItems: r.many.menuItems(),
		orders: r.many.orders(),
		reviews: r.many.reviews(),
		coupons: r.many.coupons(),
	},
	drivers: {
		user: r.one.users({
			from: r.drivers.userId,
			to: r.users.id,
		}),
		orders: r.many.orders(),
		reviews: r.many.reviews(),
		deliveryRequests: r.many.deliveryRequests(),
	},
	menuCategories: {
		restaurant: r.one.restaurants({
			from: r.menuCategories.restaurantId,
			to: r.restaurants.id,
		}),
		menuItems: r.many.menuItems(),
	},
	menuItems: {
		category: r.one.menuCategories({
			from: r.menuItems.categoryId,
			to: r.menuCategories.id,
		}),
		restaurant: r.one.restaurants({
			from: r.menuItems.restaurantId,
			to: r.restaurants.id,
		}),
		customizationGroups: r.many.customizationGroups(),
		orderItems: r.many.orderItems(),
	},
	customizationGroups: {
		menuItem: r.one.menuItems({
			from: r.customizationGroups.menuItemId,
			to: r.menuItems.id,
		}),
		customizationOptions: r.many.customizationOptions(),
	},
	customizationOptions: {
		group: r.one.customizationGroups({
			from: r.customizationOptions.groupId,
			to: r.customizationGroups.id,
		}),
		orderItemCustomizations: r.many.orderItemCustomizations(),
	},
	coupons: {
		restaurant: r.one.restaurants({
			from: r.coupons.restaurantId,
			to: r.restaurants.id,
		}),
		orders: r.many.orders(),
	},
	orders: {
		customer: r.one.users({
			from: r.orders.customerId,
			to: r.users.id,
		}),
		restaurant: r.one.restaurants({
			from: r.orders.restaurantId,
			to: r.restaurants.id,
		}),
		driver: r.one.drivers({
			from: r.orders.driverId,
			to: r.drivers.id,
		}),
		coupon: r.one.coupons({
			from: r.orders.couponId,
			to: r.coupons.id,
		}),
		deliveryAddress: r.one.addresses({
			from: r.orders.deliveryAddressId,
			to: r.addresses.id,
		}),
		orderItems: r.many.orderItems(),
		deliveryRequests: r.many.deliveryRequests(),
		reviews: r.many.reviews(),
		payments: r.many.payments(),
	},
	orderItems: {
		order: r.one.orders({
			from: r.orderItems.orderId,
			to: r.orders.id,
		}),
		menuItem: r.one.menuItems({
			from: r.orderItems.menuItemId,
			to: r.menuItems.id,
		}),
		orderItemCustomizations: r.many.orderItemCustomizations(),
	},
	orderItemCustomizations: {
		orderItem: r.one.orderItems({
			from: r.orderItemCustomizations.orderItemId,
			to: r.orderItems.id,
		}),
		customizationOption: r.one.customizationOptions({
			from: r.orderItemCustomizations.customizationOptionId,
			to: r.customizationOptions.id,
		}),
	},
	deliveryRequests: {
		order: r.one.orders({
			from: r.deliveryRequests.orderId,
			to: r.orders.id,
		}),
		driver: r.one.drivers({
			from: r.deliveryRequests.driverId,
			to: r.drivers.id,
		}),
	},
	reviews: {
		order: r.one.orders({
			from: r.reviews.orderId,
			to: r.orders.id,
		}),
		customer: r.one.users({
			from: r.reviews.customerId,
			to: r.users.id,
		}),
		restaurant: r.one.restaurants({
			from: r.reviews.restaurantId,
			to: r.restaurants.id,
		}),
		driver: r.one.drivers({
			from: r.reviews.driverId,
			to: r.drivers.id,
		}),
	},
	payments: {
		order: r.one.orders({
			from: r.payments.orderId,
			to: r.orders.id,
		}),
		user: r.one.users({
			from: r.payments.userId,
			to: r.users.id,
		}),
	},
	notifications: {
		user: r.one.users({
			from: r.notifications.userId,
			to: r.users.id,
		}),
	},
	walletTransactions: {
		user: r.one.users({
			from: r.walletTransactions.userId,
			to: r.users.id,
		}),
	},
}));
