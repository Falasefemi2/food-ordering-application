import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
	BusinessRuleError,
	DbError,
	ForbiddenError,
	NotFoundError,
} from "../libs/errors";

export interface DeliveryRequestRow {
	id: string;
	orderId: string;
	driverId: string;
	status: "pending" | "accepted" | "declined" | "expired";
	expiresAt: string;
	respondedAt: string | null;
	createdAt: string;
}

export interface DeliveryRequestRow {
	id: string;
	orderId: string;
	driverId: string;
	status: "pending" | "accepted" | "declined" | "expired";
	expiresAt: string;
	respondedAt: string | null;
	createdAt: string;
}

export interface DispatchServiceShape {
	startDispatch: (
		orderId: string,
		restaurantLatitude: string,
		restaurantLongitude: string,
	) => Effect.Effect<void, DbError | NotFoundError>;
	acceptDeliveryRequest: (
		requestId: string,
		driverId: string,
	) => Effect.Effect<
		DeliveryRequestRow,
		DbError | NotFoundError | ForbiddenError | BusinessRuleError
	>;
	declineDeliveryRequest: (
		requestId: string,
		driverId: string,
	) => Effect.Effect<
		DeliveryRequestRow,
		DbError | NotFoundError | ForbiddenError | BusinessRuleError
	>;
	getMyPendingRequest: (
		driverId: string,
	) => Effect.Effect<DeliveryRequestRow | null, DbError>;
}

export class DispatchService extends Context.Service<
	DispatchService,
	DispatchServiceShape
>()("chowdeck-assignment/driver/driver-service/DispatchService") {}
