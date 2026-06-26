import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../api";
import { AuthContext } from "../auth/auth-middleware";
import { ForbiddenError } from "../libs/errors";
import { OrderService } from "./order-service";

export const OrderHandlers = HttpApiBuilder.group(
	Api,
	"order",
	Effect.fn(function* (handlers) {
		const orderService = yield* OrderService;

		return handlers
			.handle("placeOrder", ({ payload }) =>
				Effect.gen(function* () {
					const { sub: customerId, role } = yield* AuthContext;
					if (role !== "customer") {
						return yield* new ForbiddenError({
							message: "Only customers can place orders",
						});
					}
					return yield* orderService
						.placeOrder(customerId, payload)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("listMyOrders", () =>
				Effect.gen(function* () {
					const { sub: customerId, role } = yield* AuthContext;
					if (role !== "customer") {
						return yield* new ForbiddenError({
							message: "Only customers can view their orders",
						});
					}
					return yield* orderService
						.listMyOrders(customerId, {
							page: 1,
							limit: 20,
						})
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("getOrder", ({ params }) =>
				Effect.gen(function* () {
					const { sub: customerId } = yield* AuthContext;
					return yield* orderService
						.getOrder(params.id, customerId)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("cancelOrder", ({ params, payload }) =>
				Effect.gen(function* () {
					const { sub: customerId } = yield* AuthContext;
					return yield* orderService
						.cancelOrder(params.id, customerId, payload.reason)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("listRestaurantOrders", ({ params }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } = yield* AuthContext;
					if (role !== "vendor") {
						return yield* new ForbiddenError({
							message: "Only vendors can view restaurant orders",
						});
					}
					return yield* orderService
						.listRestaurantOrders(params.id, ownerId)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("acceptOrder", ({ params, payload }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } = yield* AuthContext;
					if (role !== "vendor") {
						return yield* new ForbiddenError({
							message: "Vendors only",
						});
					}
					return yield* orderService
						.acceptOrder(params.id, payload.restaurantId, ownerId)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("rejectOrder", ({ params, payload }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } = yield* AuthContext;
					if (role !== "vendor") {
						return yield* new ForbiddenError({
							message: "Vendors only",
						});
					}
					return yield* orderService
						.rejectOrder(
							params.id,
							payload.restaurantId,
							ownerId,
							payload.reason,
						)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("markPreparing", ({ params, payload }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } = yield* AuthContext;
					if (role !== "vendor") {
						return yield* new ForbiddenError({
							message: "Vendors only",
						});
					}
					return yield* orderService
						.markPreparing(params.id, payload.restaurantId, ownerId)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("markReadyForPickup", ({ params, payload }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } = yield* AuthContext;
					if (role !== "vendor") {
						return yield* new ForbiddenError({
							message: "Vendors only",
						});
					}
					return yield* orderService
						.markReadyForPickup(params.id, payload.restaurantId, ownerId)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("markPickedUp", ({ params }) =>
				Effect.gen(function* () {
					const { sub: driverId, role } = yield* AuthContext;
					if (role !== "driver") {
						return yield* new ForbiddenError({
							message: "Drivers only",
						});
					}
					return yield* orderService
						.markPickedUp(params.id, driverId)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("markDelivered", ({ params }) =>
				Effect.gen(function* () {
					const { sub: driverId, role } = yield* AuthContext;
					if (role !== "driver") {
						return yield* new ForbiddenError({
							message: "Drivers only",
						});
					}
					return yield* orderService
						.markDelivered(params.id, driverId)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			);
	}),
);
