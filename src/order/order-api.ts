import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { AuthMiddleware } from "../auth/auth-middleware";
import {
	BusinessRuleError,
	ConflictError,
	ForbiddenError,
	NotFoundError,
} from "../libs/errors";

const OrderItemCustomizationResponse = Schema.Struct({
	id: Schema.String,
	orderItemId: Schema.String,
	customizationOptionId: Schema.NullOr(Schema.String),
	optionName: Schema.String,
	price: Schema.String,
});

const OrderItemResponse = Schema.Struct({
	id: Schema.String,
	orderId: Schema.String,
	menuItemId: Schema.NullOr(Schema.String),
	itemName: Schema.String,
	quantity: Schema.Number,
	unitPrice: Schema.String,
	totalPrice: Schema.String,
	customizations: Schema.Array(OrderItemCustomizationResponse),
});

const OrderResponse = Schema.Struct({
	id: Schema.String,
	customerId: Schema.String,
	restaurantId: Schema.String,
	driverId: Schema.NullOr(Schema.String),
	status: Schema.String,
	subtotal: Schema.String,
	deliveryFee: Schema.String,
	serviceFee: Schema.String,
	discountAmount: Schema.String,
	driverTip: Schema.String,
	totalPrice: Schema.String,
	couponId: Schema.NullOr(Schema.String),
	deliveryAddressId: Schema.NullOr(Schema.String),
	deliveryAddressLine: Schema.String,
	deliveryCity: Schema.String,
	deliveryLatitude: Schema.String,
	deliveryLongitude: Schema.String,
	deliveryNotes: Schema.NullOr(Schema.String),
	paymentStatus: Schema.String,
	paymentMethod: Schema.String,
	cancellationReason: Schema.NullOr(Schema.String),
	cancellationSource: Schema.NullOr(Schema.String),
	placedAt: Schema.NullOr(Schema.String),
	acceptedAt: Schema.NullOr(Schema.String),
	preparedAt: Schema.NullOr(Schema.String),
	pickedUpAt: Schema.NullOr(Schema.String),
	deliveredAt: Schema.NullOr(Schema.String),
	cancelledAt: Schema.NullOr(Schema.String),
	createdAt: Schema.String,
	updatedAt: Schema.String,
	items: Schema.Array(OrderItemResponse),
});

const OrderSummaryResponse = Schema.Struct({
	id: Schema.String,
	restaurantId: Schema.String,
	restaurantName: Schema.String,
	status: Schema.String,
	totalPrice: Schema.String,
	paymentStatus: Schema.String,
	paymentMethod: Schema.String,
	itemCount: Schema.Number,
	placedAt: Schema.NullOr(Schema.String),
	deliveredAt: Schema.NullOr(Schema.String),
	createdAt: Schema.String,
});

const PaginatedOrdersResponse = Schema.Struct({
	orders: Schema.Array(OrderSummaryResponse),
	total: Schema.Number,
});

const OrderItemInputSchema = Schema.Struct({
	menuItemId: Schema.String,
	quantity: Schema.Number.pipe(Schema.check(Schema.isGreaterThan(0))),
	selectedOptionIds: Schema.optional(Schema.Array(Schema.String)),
});

export class OrderApiGroup extends HttpApiGroup.make("order")
	.add(
		HttpApiEndpoint.post("placeOrder", "/orders", {
			payload: Schema.Struct({
				restaurantId: Schema.String,
				addressId: Schema.String,
				items: Schema.Array(OrderItemInputSchema).pipe(
					Schema.check(Schema.isMinLength(1)),
				),
				couponCode: Schema.optional(Schema.String),
				paymentMethod: Schema.Literals([
					"card",
					"bank_transfer",
					"wallet",
					"cash_on_delivery",
				]),
				driverTip: Schema.optional(Schema.String),
				deliveryNotes: Schema.optional(Schema.String),
			}),
			success: OrderResponse,
			error: [NotFoundError, BusinessRuleError, ConflictError, ForbiddenError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.get("listMyOrders", "/orders", {
			success: PaginatedOrdersResponse,
			error: [ForbiddenError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.get("getOrder", "/orders/:id", {
			params: Schema.Struct({ id: Schema.String }),
			success: OrderResponse,
			error: [NotFoundError, ForbiddenError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("cancelOrder", "/orders/:id/cancel", {
			params: Schema.Struct({ id: Schema.String }),
			payload: Schema.Struct({
				reason: Schema.String.pipe(Schema.check(Schema.isMinLength(5))),
			}),
			success: OrderResponse,
			error: [NotFoundError, ForbiddenError, BusinessRuleError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.get("listRestaurantOrders", "/restaurants/:id/orders", {
			params: Schema.Struct({ id: Schema.String }),
			success: Schema.Array(OrderSummaryResponse),
			error: [NotFoundError, ForbiddenError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("acceptOrder", "/orders/:id/accept", {
			params: Schema.Struct({ id: Schema.String }),
			payload: Schema.Struct({ restaurantId: Schema.String }),
			success: OrderResponse,
			error: [NotFoundError, ForbiddenError, BusinessRuleError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("rejectOrder", "/orders/:id/reject", {
			params: Schema.Struct({ id: Schema.String }),
			payload: Schema.Struct({
				restaurantId: Schema.String,
				reason: Schema.String.pipe(Schema.check(Schema.isMinLength(5))),
			}),
			success: OrderResponse,
			error: [NotFoundError, ForbiddenError, BusinessRuleError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("markPreparing", "/orders/:id/preparing", {
			params: Schema.Struct({ id: Schema.String }),
			payload: Schema.Struct({ restaurantId: Schema.String }),
			success: OrderResponse,
			error: [NotFoundError, ForbiddenError, BusinessRuleError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("markReadyForPickup", "/orders/:id/ready", {
			params: Schema.Struct({ id: Schema.String }),
			payload: Schema.Struct({
				restaurantId: Schema.String,
			}),
			success: OrderResponse,
			error: [NotFoundError, ForbiddenError, BusinessRuleError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("markPickedUp", "/orders/:id/picked-up", {
			params: Schema.Struct({ id: Schema.String }),
			success: OrderResponse,
			error: [NotFoundError, ForbiddenError, BusinessRuleError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("markDelivered", "/orders/:id/delivered", {
			params: Schema.Struct({ id: Schema.String }),
			success: OrderResponse,
			error: [NotFoundError, ForbiddenError, BusinessRuleError],
		}).middleware(AuthMiddleware),
	) {}
