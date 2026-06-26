import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { PgDatabase } from "../db";
import {
	addresses,
	coupons,
	customizationOptions,
	menuItems,
	orderItemCustomizations,
	orderItems,
	orders,
	restaurants,
} from "../db/schema";
import {
	BusinessRuleError,
	DbError,
	ForbiddenError,
	NotFoundError,
} from "../libs/errors";
import {
	type OrderItemCustomizationRow,
	type OrderItemRow,
	type OrderRow,
	OrderService,
	type OrderServiceShape,
	type OrderSummaryRow,
} from "./order-service";

const dbQuery = <A>(effect: Effect.Effect<A, EffectDrizzleQueryError>) =>
	effect.pipe(
		Effect.mapError(
			(cause) =>
				new DbError({
					message: "Database error",
					cause,
				}),
		),
	);

const VALID_TRANSITIONS: Record<string, string[]> = {
	pending: ["placed", "cancelled"],
	placed: ["accepted_by_restaurant", "cancelled"],
	accepted_by_restaurant: ["preparing", "cancelled"],
	preparing: ["ready_for_pickup"],
	ready_for_pickup: ["driver_assigned"],
	driver_assigned: ["picked_up_by_driver"],
	picked_up_by_driver: ["delivered"],
	delivered: [],
	cancelled: [],
	refunded: [],
};

const assertTransition = (current: string, next: string) => {
	const allowed = VALID_TRANSITIONS[current] ?? [];
	if (!allowed.includes(next)) {
		return Effect.fail(
			new BusinessRuleError({
				message: `Cannot transition order from '${current}' to '${next}'`,
			}),
		);
	}
	return Effect.void;
};

const buildOrderRow = (
	order: typeof orders.$inferSelect,
	itemRows: (typeof orderItems.$inferSelect)[],
	customizationRows: (typeof orderItemCustomizations.$inferSelect)[],
): OrderRow => {
	const customsByItem = new Map<string, OrderItemCustomizationRow[]>();
	for (const c of customizationRows) {
		const list = customsByItem.get(c.orderItemId) ?? [];
		list.push({
			id: c.id,
			orderItemId: c.orderItemId,
			customizationOptionId: c.customizationOptionId,
			optionName: c.optionName,
			price: c.price,
		});
		customsByItem.set(c.orderItemId, list);
	}

	const items: OrderItemRow[] = itemRows.map((i) => ({
		id: i.id,
		orderId: i.orderId,
		menuItemId: i.menuItemId,
		itemName: i.itemName,
		quantity: i.quantity,
		unitPrice: i.unitPrice,
		totalPrice: i.totalPrice,
		customizations: customsByItem.get(i.id) ?? [],
	}));

	return {
		id: order.id,
		customerId: order.customerId,
		restaurantId: order.restaurantId,
		driverId: order.driverId,
		status: order.status,
		subtotal: order.subtotal,
		deliveryFee: order.deliveryFee,
		serviceFee: order.serviceFee,
		discountAmount: order.discountAmount,
		driverTip: order.driverTip,
		totalPrice: order.totalPrice,
		couponId: order.couponId,
		deliveryAddressId: order.deliveryAddressId,
		deliveryAddressLine: order.deliveryAddressLine,
		deliveryCity: order.deliveryCity,
		deliveryLatitude: order.deliveryLatitude,
		deliveryLongitude: order.deliveryLongitude,
		deliveryNotes: order.deliveryNotes,
		paymentStatus: order.paymentStatus,
		paymentMethod: order.paymentMethod,
		cancellationReason: order.cancellationReason,
		cancellationSource: order.cancellationSource,
		placedAt: order.placedAt?.toISOString() ?? null,
		acceptedAt: order.acceptedAt?.toISOString() ?? null,
		preparedAt: order.preparedAt?.toISOString() ?? null,
		pickedUpAt: order.pickedUpAt?.toISOString() ?? null,
		deliveredAt: order.deliveredAt?.toISOString() ?? null,
		cancelledAt: order.cancelledAt?.toISOString() ?? null,
		createdAt: order.createdAt.toISOString(),
		updatedAt: order.updatedAt.toISOString(),
		items,
	};
};

const fetchFullOrder = (
	db: EffectPgDatabase,
	orderId: string,
): Effect.Effect<OrderRow, DbError | NotFoundError> =>
	Effect.gen(function* () {
		const [order] = yield* dbQuery(
			db.select().from(orders).where(eq(orders.id, orderId)).limit(1),
		);
		if (!order)
			return yield* new NotFoundError({
				resource: "Order",
				id: orderId,
			});

		const items = yield* dbQuery(
			db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
		);

		const customizations =
			items.length > 0
				? yield* dbQuery(
						db
							.select()
							.from(orderItemCustomizations)
							.where(
								inArray(
									orderItemCustomizations.orderItemId,
									items.map((i) => i.id),
								),
							),
					)
				: [];

		return buildOrderRow(order, items, customizations);
	});

export const OrderLive = Layer.effect(
	OrderService,
	Effect.gen(function* () {
		const db = yield* PgDatabase;
		const placeOrder: OrderServiceShape["placeOrder"] = (customerId, input) =>
			Effect.gen(function* () {
				const sanitizedInput = {
					...input,
					couponCode: input.couponCode?.trim() || null,
					driverTip: input.driverTip?.trim() || "0.00",
					deliveryNotes: input.deliveryNotes?.trim() || null,
					items: input.items.map((item) => ({
						...item,
						menuItemId: item.menuItemId.trim(),
						selectedOptionIds: (item.selectedOptionIds ?? [])
							.map((id) => id.trim())
							.filter((id) => id.length > 0),
					})),
				};

				const [restaurant] = yield* dbQuery(
					db
						.select({
							id: restaurants.id,
							approvalStatus: restaurants.approvalStatus,
							isOpen: restaurants.isOpen,
							commissionRate: restaurants.commissionRate,
						})
						.from(restaurants)
						.where(eq(restaurants.id, sanitizedInput.restaurantId))
						.limit(1),
				);

				if (!restaurant) {
					return yield* new NotFoundError({
						resource: "Restaurant",
						id: sanitizedInput.restaurantId,
					});
				}
				if (restaurant.approvalStatus !== "approved") {
					return yield* new BusinessRuleError({
						message: "Restaurant is not available",
					});
				}
				if (!restaurant.isOpen) {
					return yield* new BusinessRuleError({
						message: "Restaurant is currently closed",
					});
				}

				const [address] = yield* dbQuery(
					db
						.select()
						.from(addresses)
						.where(
							and(
								eq(addresses.id, sanitizedInput.addressId),
								eq(addresses.userId, customerId),
							),
						)
						.limit(1),
				);

				if (!address) {
					return yield* new NotFoundError({
						resource: "Address",
						id: sanitizedInput.addressId,
					});
				}

				const menuItemIds = sanitizedInput.items.map((i) => i.menuItemId);
				const fetchedItems = yield* dbQuery(
					db
						.select()
						.from(menuItems)
						.where(
							and(
								inArray(menuItems.id, menuItemIds),
								eq(menuItems.restaurantId, sanitizedInput.restaurantId),
								eq(menuItems.isAvailable, true),
							),
						),
				);

				if (fetchedItems.length !== menuItemIds.length) {
					return yield* new BusinessRuleError({
						message:
							"One or more menu items are unavailable or do not belong to this restaurant",
					});
				}

				const itemMap = new Map(fetchedItems.map((i) => [i.id, i]));

				const allOptionIds = sanitizedInput.items.flatMap(
					(i) => i.selectedOptionIds,
				);

				const fetchedOptions =
					allOptionIds.length > 0
						? yield* dbQuery(
								db
									.select()
									.from(customizationOptions)
									.where(inArray(customizationOptions.id, allOptionIds)),
							)
						: [];

				const optionMap = new Map(fetchedOptions.map((o) => [o.id, o]));

				let subtotal = 0;

				const lineItems = sanitizedInput.items.map((orderItem) => {
					const item = itemMap.get(orderItem.menuItemId)!;
					const unitPrice = parseFloat(item.price);

					const selectedOptions = orderItem.selectedOptionIds
						.map((optId) => optionMap.get(optId))
						.filter(Boolean) as (typeof fetchedOptions)[number][];

					const optionsTotal = selectedOptions.reduce(
						(sum, o) => sum + parseFloat(o.price),
						0,
					);

					const lineTotalPerUnit = unitPrice + optionsTotal;
					const lineTotal = lineTotalPerUnit * orderItem.quantity;
					subtotal += lineTotal;

					return {
						menuItemId: item.id,
						itemName: item.name,
						quantity: orderItem.quantity,
						unitPrice: lineTotalPerUnit.toFixed(2),
						totalPrice: lineTotal.toFixed(2),
						options: selectedOptions,
					};
				});

				const deliveryFee = 500;
				const serviceFee = Math.round(subtotal * 0.05);
				const driverTip = parseFloat(sanitizedInput.driverTip);

				let discountAmount = 0;
				let couponId: string | null = null;

				if (sanitizedInput.couponCode) {
					const [coupon] = yield* dbQuery(
						db
							.select()
							.from(coupons)
							.where(
								and(
									eq(coupons.code, sanitizedInput.couponCode),
									eq(coupons.isActive, true),
								),
							)
							.limit(1),
					);

					if (!coupon) {
						return yield* new NotFoundError({
							resource: "Coupon",
							id: sanitizedInput.couponCode,
						});
					}

					const now = new Date();
					if (now < coupon.startDate || now > coupon.endDate) {
						return yield* new BusinessRuleError({
							message: "Coupon has expired or is not yet active",
						});
					}

					if (
						coupon.usageLimit !== null &&
						coupon.usageCount >= coupon.usageLimit
					) {
						return yield* new BusinessRuleError({
							message: "Coupon usage limit has been reached",
						});
					}

					if (subtotal < parseFloat(coupon.minOrderValue)) {
						return yield* new BusinessRuleError({
							message: `Minimum order value for this coupon is ₦${coupon.minOrderValue}`,
						});
					}

					if (
						coupon.restaurantId &&
						coupon.restaurantId !== sanitizedInput.restaurantId
					) {
						return yield* new BusinessRuleError({
							message: "Coupon is not valid for this restaurant",
						});
					}

					if (coupon.discountType === "percentage") {
						discountAmount =
							(subtotal * parseFloat(coupon.discountValue)) / 100;
					} else {
						discountAmount = parseFloat(coupon.discountValue);
					}

					if (coupon.maxDiscount) {
						discountAmount = Math.min(
							discountAmount,
							parseFloat(coupon.maxDiscount),
						);
					}

					couponId = coupon.id;

					yield* dbQuery(
						db
							.update(coupons)
							.set({
								usageCount: coupon.usageCount + 1,
								updatedAt: new Date(),
							})
							.where(
								and(
									eq(coupons.id, coupon.id),
									eq(coupons.usageCount, coupon.usageCount),
								),
							),
					);
				}

				const totalPrice =
					subtotal + deliveryFee + serviceFee + driverTip - discountAmount;

				const [order] = yield* dbQuery(
					db
						.insert(orders)
						.values({
							customerId,
							restaurantId: sanitizedInput.restaurantId,
							status: "placed",
							subtotal: subtotal.toFixed(2),
							deliveryFee: deliveryFee.toFixed(2),
							serviceFee: serviceFee.toFixed(2),
							discountAmount: discountAmount.toFixed(2),
							driverTip: driverTip.toFixed(2),
							totalPrice: totalPrice.toFixed(2),
							couponId,
							deliveryAddressId: address.id,
							deliveryAddressLine: address.addressLine1,
							deliveryCity: address.city,
							deliveryLatitude: address.latitude,
							deliveryLongitude: address.longitude,
							deliveryNotes: sanitizedInput.deliveryNotes,
							paymentStatus: "pending",
							paymentMethod: sanitizedInput.paymentMethod,
							placedAt: new Date(),
						})
						.returning(),
				);

				if (!order) {
					return yield* new DbError({
						message: "Failed to create order",
					});
				}

				for (const line of lineItems) {
					const [insertedItem] = yield* dbQuery(
						db
							.insert(orderItems)
							.values({
								orderId: order.id,
								menuItemId: line.menuItemId,
								itemName: line.itemName,
								quantity: line.quantity,
								unitPrice: line.unitPrice,
								totalPrice: line.totalPrice,
							})
							.returning({
								id: orderItems.id,
							}),
					);

					if (!insertedItem) continue;

					if (line.options.length > 0) {
						yield* dbQuery(
							db.insert(orderItemCustomizations).values(
								line.options.map((opt) => ({
									orderItemId: insertedItem.id,
									customizationOptionId: opt.id,
									optionName: opt.name,
									price: opt.price,
								})),
							),
						);
					}
				}

				yield* Effect.logInfo("Order placed", {
					orderId: order.id,
					customerId,
					restaurantId: sanitizedInput.restaurantId,
					totalPrice: totalPrice.toFixed(2),
				});

				return yield* fetchFullOrder(db as any, order.id);
			});

		const listMyOrders: OrderServiceShape["listMyOrders"] = (
			customerId,
			pagination,
		) =>
			Effect.gen(function* () {
				const offset = (pagination.page - 1) * pagination.limit;

				const [totalResult] = yield* dbQuery(
					db
						.select({ count: count() })
						.from(orders)
						.where(eq(orders.customerId, customerId)),
				);

				const rows = yield* dbQuery(
					db
						.select({
							id: orders.id,
							restaurantId: orders.restaurantId,
							restaurantName: restaurants.name,
							status: orders.status,
							totalPrice: orders.totalPrice,
							paymentStatus: orders.paymentStatus,
							paymentMethod: orders.paymentMethod,
							placedAt: orders.placedAt,
							deliveredAt: orders.deliveredAt,
							createdAt: orders.createdAt,
						})
						.from(orders)
						.innerJoin(restaurants, eq(orders.restaurantId, restaurants.id))
						.where(eq(orders.customerId, customerId))
						.orderBy(desc(orders.createdAt))
						.limit(pagination.limit)
						.offset(offset),
				);

				const orderIds = rows.map((r) => r.id);
				const itemCounts =
					orderIds.length > 0
						? yield* dbQuery(
								db
									.select({
										orderId: orderItems.orderId,
										count: count(),
									})
									.from(orderItems)
									.where(inArray(orderItems.orderId, orderIds))
									.groupBy(orderItems.orderId),
							)
						: [];

				const countMap = new Map(itemCounts.map((c) => [c.orderId, c.count]));

				const orderSummaries: OrderSummaryRow[] = rows.map((r) => ({
					id: r.id,
					restaurantId: r.restaurantId,
					restaurantName: r.restaurantName,
					status: r.status,
					totalPrice: r.totalPrice,
					paymentStatus: r.paymentStatus,
					paymentMethod: r.paymentMethod,
					itemCount: countMap.get(r.id) ?? 0,
					placedAt: r.placedAt?.toISOString() ?? null,
					deliveredAt: r.deliveredAt?.toISOString() ?? null,
					createdAt: r.createdAt.toISOString(),
				}));

				return {
					orders: orderSummaries,
					total: totalResult?.count ?? 0,
				};
			});

		const getOrder: OrderServiceShape["getOrder"] = (orderId, customerId) =>
			Effect.gen(function* () {
				const order = yield* fetchFullOrder(db as any, orderId);
				if (order.customerId !== customerId) {
					return yield* new ForbiddenError({
						message: "You do not own this order",
					});
				}
				return order;
			});

		const cancelOrder: OrderServiceShape["cancelOrder"] = (
			orderId,
			customerId,
			reason,
		) =>
			Effect.gen(function* () {
				const order = yield* fetchFullOrder(db as any, orderId);

				if (order.customerId !== customerId) {
					return yield* new ForbiddenError({
						message: "You do not own this order",
					});
				}

				if (!["pending", "placed"].includes(order.status)) {
					return yield* new BusinessRuleError({
						message: `Order cannot be cancelled at status '${order.status}'`,
					});
				}

				yield* dbQuery(
					db
						.update(orders)
						.set({
							status: "cancelled",
							cancellationSource: "customer",
							cancellationReason: reason,
							cancelledAt: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(orders.id, orderId)),
				);

				yield* Effect.logInfo("Order cancelled by customer", {
					orderId,
					customerId,
				});

				return yield* fetchFullOrder(db as any, orderId);
			});

		const listRestaurantOrders: OrderServiceShape["listRestaurantOrders"] = (
			restaurantId,
			ownerId,
			filters,
		) =>
			Effect.gen(function* () {
				const [restaurant] = yield* dbQuery(
					db
						.select({
							id: restaurants.id,
							ownerId: restaurants.ownerId,
						})
						.from(restaurants)
						.where(eq(restaurants.id, restaurantId))
						.limit(1),
				);

				if (!restaurant) {
					return yield* new NotFoundError({
						resource: "Restaurant",
						id: restaurantId,
					});
				}
				if (restaurant.ownerId !== ownerId) {
					return yield* new ForbiddenError({
						message: "You do not own this restaurant",
					});
				}

				const rows = yield* dbQuery(
					db
						.select({
							id: orders.id,
							restaurantId: orders.restaurantId,
							restaurantName: restaurants.name,
							status: orders.status,
							totalPrice: orders.totalPrice,
							paymentStatus: orders.paymentStatus,
							paymentMethod: orders.paymentMethod,
							placedAt: orders.placedAt,
							deliveredAt: orders.deliveredAt,
							createdAt: orders.createdAt,
						})
						.from(orders)
						.innerJoin(restaurants, eq(orders.restaurantId, restaurants.id))
						.where(
							and(
								eq(orders.restaurantId, restaurantId),
								filters?.status
									? eq(orders.status, filters.status as any)
									: undefined,
							),
						)
						.orderBy(desc(orders.createdAt)),
				);

				const orderIds = rows.map((r) => r.id);
				const itemCounts =
					orderIds.length > 0
						? yield* dbQuery(
								db
									.select({
										orderId: orderItems.orderId,
										count: count(),
									})
									.from(orderItems)
									.where(inArray(orderItems.orderId, orderIds))
									.groupBy(orderItems.orderId),
							)
						: [];

				const countMap = new Map(itemCounts.map((c) => [c.orderId, c.count]));

				return rows.map((r) => ({
					id: r.id,
					restaurantId: r.restaurantId,
					restaurantName: r.restaurantName,
					status: r.status,
					totalPrice: r.totalPrice,
					paymentStatus: r.paymentStatus,
					paymentMethod: r.paymentMethod,
					itemCount: countMap.get(r.id) ?? 0,
					placedAt: r.placedAt?.toISOString() ?? null,
					deliveredAt: r.deliveredAt?.toISOString() ?? null,
					createdAt: r.createdAt.toISOString(),
				}));
			});

		const assertRestaurantOwnsOrder = (
			orderId: string,
			restaurantId: string,
			ownerId: string,
		) =>
			Effect.gen(function* () {
				const [restaurant] = yield* dbQuery(
					db
						.select({
							ownerId: restaurants.ownerId,
						})
						.from(restaurants)
						.where(eq(restaurants.id, restaurantId))
						.limit(1),
				);

				if (!restaurant) {
					return yield* new NotFoundError({
						resource: "Restaurant",
						id: restaurantId,
					});
				}
				if (restaurant.ownerId !== ownerId) {
					return yield* new ForbiddenError({
						message: "You do not own this restaurant",
					});
				}

				const [order] = yield* dbQuery(
					db
						.select({
							id: orders.id,
							status: orders.status,
							restaurantId: orders.restaurantId,
						})
						.from(orders)
						.where(eq(orders.id, orderId))
						.limit(1),
				);

				if (!order) {
					return yield* new NotFoundError({
						resource: "Order",
						id: orderId,
					});
				}
				if (order.restaurantId !== restaurantId) {
					return yield* new ForbiddenError({
						message: "This order does not belong to your restaurant",
					});
				}

				return order;
			});

		const acceptOrder: OrderServiceShape["acceptOrder"] = (
			orderId,
			restaurantId,
			ownerId,
		) =>
			Effect.gen(function* () {
				const order = yield* assertRestaurantOwnsOrder(
					orderId,
					restaurantId,
					ownerId,
				);
				yield* assertTransition(order.status, "accepted_by_restaurant");

				yield* dbQuery(
					db
						.update(orders)
						.set({
							status: "accepted_by_restaurant",
							acceptedAt: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(orders.id, orderId)),
				);

				return yield* fetchFullOrder(db as any, orderId);
			});

		const rejectOrder: OrderServiceShape["rejectOrder"] = (
			orderId,
			restaurantId,
			ownerId,
			reason,
		) =>
			Effect.gen(function* () {
				const order = yield* assertRestaurantOwnsOrder(
					orderId,
					restaurantId,
					ownerId,
				);
				yield* assertTransition(order.status, "cancelled");

				yield* dbQuery(
					db
						.update(orders)
						.set({
							status: "cancelled",
							cancellationSource: "restaurant",
							cancellationReason: reason,
							cancelledAt: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(orders.id, orderId)),
				);

				return yield* fetchFullOrder(db as any, orderId);
			});

		const markPreparing: OrderServiceShape["markPreparing"] = (
			orderId,
			restaurantId,
			ownerId,
		) =>
			Effect.gen(function* () {
				const order = yield* assertRestaurantOwnsOrder(
					orderId,
					restaurantId,
					ownerId,
				);
				yield* assertTransition(order.status, "preparing");

				yield* dbQuery(
					db
						.update(orders)
						.set({
							status: "preparing",
							updatedAt: new Date(),
						})
						.where(eq(orders.id, orderId)),
				);

				return yield* fetchFullOrder(db as any, orderId);
			});

		const markReadyForPickup: OrderServiceShape["markReadyForPickup"] = (
			orderId,
			restaurantId,
			ownerId,
		) =>
			Effect.gen(function* () {
				const order = yield* assertRestaurantOwnsOrder(
					orderId,
					restaurantId,
					ownerId,
				);
				yield* assertTransition(order.status, "ready_for_pickup");

				yield* dbQuery(
					db
						.update(orders)
						.set({
							status: "ready_for_pickup",
							preparedAt: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(orders.id, orderId)),
				);

				yield* Effect.logInfo(
					"Order ready for pickup — dispatch should trigger",
					{
						orderId,
					},
				);

				return yield* fetchFullOrder(db as any, orderId);
			});

		const assertDriverOwnsOrder = (orderId: string, driverId: string) =>
			Effect.gen(function* () {
				const [order] = yield* dbQuery(
					db
						.select({
							id: orders.id,
							status: orders.status,
							driverId: orders.driverId,
						})
						.from(orders)
						.where(eq(orders.id, orderId))
						.limit(1),
				);

				if (!order) {
					return yield* new NotFoundError({
						resource: "Order",
						id: orderId,
					});
				}
				if (order.driverId !== driverId) {
					return yield* new ForbiddenError({
						message: "You are not assigned to this order",
					});
				}

				return order;
			});

		const markPickedUp: OrderServiceShape["markPickedUp"] = (
			orderId,
			driverId,
		) =>
			Effect.gen(function* () {
				const order = yield* assertDriverOwnsOrder(orderId, driverId);
				yield* assertTransition(order.status, "picked_up_by_driver");

				yield* dbQuery(
					db
						.update(orders)
						.set({
							status: "picked_up_by_driver",
							pickedUpAt: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(orders.id, orderId)),
				);

				return yield* fetchFullOrder(db as any, orderId);
			});

		const markDelivered: OrderServiceShape["markDelivered"] = (
			orderId,
			driverId,
		) =>
			Effect.gen(function* () {
				const order = yield* assertDriverOwnsOrder(orderId, driverId);
				yield* assertTransition(order.status, "delivered");

				yield* dbQuery(
					db
						.update(orders)
						.set({
							status: "delivered",
							paymentStatus: "paid",
							deliveredAt: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(orders.id, orderId)),
				);

				yield* Effect.logInfo("Order delivered", {
					orderId,
					driverId,
				});

				return yield* fetchFullOrder(db as any, orderId);
			});

		return {
			placeOrder,
			listMyOrders,
			getOrder,
			cancelOrder,
			listRestaurantOrders,
			acceptOrder,
			rejectOrder,
			markPreparing,
			markReadyForPickup,
			markPickedUp,
			markDelivered,
		};
	}),
);
