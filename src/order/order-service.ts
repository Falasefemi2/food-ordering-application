import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
	BusinessRuleError,
	ConflictError,
	DbError,
	ForbiddenError,
	NotFoundError,
} from "../libs/errors";

export interface OrderItemInput {
	menuItemId: string;
	quantity: number;
	selectedOptionIds?: readonly string[];
}

export interface PlaceOrderInput {
	restaurantId: string;
	addressId: string;
	items: readonly OrderItemInput[];
	couponCode?: string;
	paymentMethod: "card" | "bank_transfer" | "wallet" | "cash_on_delivery";
	driverTip?: string;
	deliveryNotes?: string;
}

export interface OrderItemCustomizationRow {
	id: string;
	orderItemId: string;
	customizationOptionId: string | null;
	optionName: string;
	price: string;
}

export interface OrderItemRow {
	id: string;
	orderId: string;
	menuItemId: string | null;
	itemName: string;
	quantity: number;
	unitPrice: string;
	totalPrice: string;
	customizations: OrderItemCustomizationRow[];
}

export interface OrderRow {
	id: string;
	customerId: string;
	restaurantId: string;
	driverId: string | null;
	status: string;
	subtotal: string;
	deliveryFee: string;
	serviceFee: string;
	discountAmount: string;
	driverTip: string;
	totalPrice: string;
	couponId: string | null;
	deliveryAddressId: string | null;
	deliveryAddressLine: string;
	deliveryCity: string;
	deliveryLatitude: string;
	deliveryLongitude: string;
	deliveryNotes: string | null;
	paymentStatus: string;
	paymentMethod: string;
	cancellationReason: string | null;
	cancellationSource: string | null;
	placedAt: string | null;
	acceptedAt: string | null;
	preparedAt: string | null;
	pickedUpAt: string | null;
	deliveredAt: string | null;
	cancelledAt: string | null;
	createdAt: string;
	updatedAt: string;
	items: OrderItemRow[];
}

export interface OrderSummaryRow {
	id: string;
	restaurantId: string;
	restaurantName: string;
	status: string;
	totalPrice: string;
	paymentStatus: string;
	paymentMethod: string;
	itemCount: number;
	placedAt: string | null;
	deliveredAt: string | null;
	createdAt: string;
}

export interface OrderServiceShape {
	placeOrder: (
		customerId: string,
		input: PlaceOrderInput,
	) => Effect.Effect<
		OrderRow,
		DbError | NotFoundError | BusinessRuleError | ConflictError
	>;

	listMyOrders: (
		customerId: string,
		pagination: { page: number; limit: number },
	) => Effect.Effect<{ orders: OrderSummaryRow[]; total: number }, DbError>;

	getOrder: (
		orderId: string,
		customerId: string,
	) => Effect.Effect<OrderRow, DbError | NotFoundError | ForbiddenError>;

	cancelOrder: (
		orderId: string,
		customerId: string,
		reason: string,
	) => Effect.Effect<
		OrderRow,
		DbError | NotFoundError | ForbiddenError | BusinessRuleError
	>;

	listRestaurantOrders: (
		restaurantId: string,
		ownerId: string,
		filters?: { status?: string },
	) => Effect.Effect<
		OrderSummaryRow[],
		DbError | NotFoundError | ForbiddenError
	>;

	acceptOrder: (
		orderId: string,
		restaurantId: string,
		ownerId: string,
	) => Effect.Effect<
		OrderRow,
		DbError | NotFoundError | ForbiddenError | BusinessRuleError
	>;

	rejectOrder: (
		orderId: string,
		restaurantId: string,
		ownerId: string,
		reason: string,
	) => Effect.Effect<
		OrderRow,
		DbError | NotFoundError | ForbiddenError | BusinessRuleError
	>;

	markPreparing: (
		orderId: string,
		restaurantId: string,
		ownerId: string,
	) => Effect.Effect<
		OrderRow,
		DbError | NotFoundError | ForbiddenError | BusinessRuleError
	>;

	markReadyForPickup: (
		orderId: string,
		restaurantId: string,
		ownerId: string,
	) => Effect.Effect<
		OrderRow,
		DbError | NotFoundError | ForbiddenError | BusinessRuleError
	>;

	markPickedUp: (
		orderId: string,
		driverId: string,
	) => Effect.Effect<
		OrderRow,
		DbError | NotFoundError | ForbiddenError | BusinessRuleError
	>;

	markDelivered: (
		orderId: string,
		driverId: string,
	) => Effect.Effect<
		OrderRow,
		DbError | NotFoundError | ForbiddenError | BusinessRuleError
	>;
}

export class OrderService extends Context.Service<
	OrderService,
	OrderServiceShape
>()("chowdeck-assignment/order/order-service/OrderService") {}
