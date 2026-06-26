import { and, eq, sql } from "drizzle-orm";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import { PgDatabase } from "../db";
import { deliveryRequests, drivers, orders } from "../db/schema";
import {
	BusinessRuleError,
	DbError,
	ForbiddenError,
	NotFoundError,
} from "../libs/errors";
import {
	type DeliveryRequestRow,
	DispatchService,
	type DispatchServiceShape,
} from "./dispatch-service";

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

const toRequestRow = (
	r: typeof deliveryRequests.$inferSelect,
): DeliveryRequestRow => ({
	id: r.id,
	orderId: r.orderId,
	driverId: r.driverId,
	status: r.status as DeliveryRequestRow["status"],
	expiresAt: r.expiresAt.toISOString(),
	respondedAt: r.respondedAt?.toISOString() ?? null,
	createdAt: r.createdAt.toISOString(),
});

const REQUEST_WINDOW_SECONDS = 30;
const MAX_DISPATCH_ATTEMPTS = 10;
const EXPIRY_POLL_INTERVAL = Duration.seconds(5);
const SEARCH_RADIUS_KM = 5;

const haversineExpr = (
	lat: string,
	lng: string,
	colLat: typeof drivers.currentLatitude,
	colLng: typeof drivers.currentLongitude,
) =>
	sql<number>`
    (6371 * acos(
      cos(radians(${parseFloat(lat)}))
      * cos(radians(${colLat}::float))
      * cos(radians(${colLng}::float) - radians(${parseFloat(lng)}))
      + sin(radians(${parseFloat(lat)}))
      * sin(radians(${colLat}::float))
    ))
  `;

class PendingSignal extends Data.TaggedError("PendingSignal")<{}> {}

export const DispatchLive = Layer.effect(
	DispatchService,
	Effect.gen(function* () {
		const db = yield* PgDatabase;

		const findNearestDrivers = (
			orderId: string,
			restaurantLat: string,
			restaurantLng: string,
			limit = 5,
		) =>
			Effect.gen(function* () {
				const attempted = yield* dbQuery(
					db
						.select({
							driverId: deliveryRequests.driverId,
						})
						.from(deliveryRequests)
						.where(eq(deliveryRequests.orderId, orderId)),
				);
				const attemptedIds = attempted.map((a) => a.driverId);
				const nearbyDrivers = yield* dbQuery(
					db
						.select({
							id: drivers.id,
							userId: drivers.userId,
							distance: haversineExpr(
								restaurantLat,
								restaurantLng,
								drivers.currentLatitude,
								drivers.currentLongitude,
							),
						})
						.from(drivers)
						.where(
							and(
								eq(drivers.approvalStatus, "approved"),
								eq(drivers.status, "online_idle"),
								sql`${drivers.currentLatitude} IS NOT NULL`,
								sql`${drivers.currentLongitude} IS NOT NULL`,
								attemptedIds.length > 0
									? sql`${drivers.id} NOT IN (${sql.join(
											attemptedIds.map((id) => sql`${id}`),
											sql`, `,
										)})`
									: sql`TRUE`,
							),
						)
						.orderBy(
							haversineExpr(
								restaurantLat,
								restaurantLng,
								drivers.currentLatitude,
								drivers.currentLongitude,
							),
						)
						.limit(limit),
				);
				return nearbyDrivers.filter(
					(d) => d.distance !== null && d.distance <= SEARCH_RADIUS_KM,
				);
			});

		const sendRequest = (
			orderId: string,
			driverId: string,
		): Effect.Effect<"accepted" | "declined" | "expired", DbError> =>
			Effect.gen(function* () {
				const expiresAt = new Date(Date.now() + REQUEST_WINDOW_SECONDS * 1000);

				yield* dbQuery(
					db.insert(deliveryRequests).values({
						orderId,
						driverId,
						status: "pending",
						expiresAt,
					}),
				);

				yield* Effect.logInfo("Dispatch: request sent to driver", {
					orderId,
					driverId,
					expiresAt: expiresAt.toISOString(),
				});

				const pollOnce = Effect.gen(function* () {
					const [request] = yield* dbQuery(
						db
							.select({
								status: deliveryRequests.status,
							})
							.from(deliveryRequests)
							.where(
								and(
									eq(deliveryRequests.orderId, orderId),
									eq(deliveryRequests.driverId, driverId),
								),
							)
							.orderBy(deliveryRequests.createdAt)
							.limit(1),
					);

					const now = new Date();

					if (!request || request.status === "pending") {
						if (now >= expiresAt) {
							yield* dbQuery(
								db
									.update(deliveryRequests)
									.set({
										status: "expired",
										respondedAt: now,
									})
									.where(
										and(
											eq(deliveryRequests.orderId, orderId),
											eq(deliveryRequests.driverId, driverId),
											eq(deliveryRequests.status, "pending"),
										),
									),
							);
							return "expired" as const;
						}
						return yield* new PendingSignal();
					}

					return request.status as "accepted" | "declined" | "expired";
				});

				const pollSchedule = Schedule.spaced(EXPIRY_POLL_INTERVAL).pipe(
					Schedule.while((meta) => meta.input instanceof PendingSignal),
				);

				return yield* Effect.retry(pollOnce, pollSchedule).pipe(
					Effect.catchTag("PendingSignal", () =>
						Effect.succeed("expired" as const),
					),
				);
			});

		const dispatchLoop = (
			orderId: string,
			restaurantLat: string,
			restaurantLng: string,
		): Effect.Effect<void, DbError | NotFoundError> =>
			Effect.gen(function* () {
				yield* Effect.logInfo("Dispatch: starting loop", { orderId });

				let attempts = 0;

				while (attempts < MAX_DISPATCH_ATTEMPTS) {
					const [order] = yield* dbQuery(
						db
							.select({
								status: orders.status,
							})
							.from(orders)
							.where(eq(orders.id, orderId))
							.limit(1),
					);

					if (!order)
						return yield* new NotFoundError({
							resource: "Order",
							id: orderId,
						});

					if (order.status !== "ready_for_pickup") {
						yield* Effect.logInfo("Dispatch: order no longer needs dispatch", {
							orderId,
							status: order.status,
						});
						return;
					}

					const nearbyDrivers = yield* findNearestDrivers(
						orderId,
						restaurantLat,
						restaurantLng,
					);

					if (nearbyDrivers.length === 0) {
						yield* Effect.logWarning(
							"Dispatch: no available drivers nearby, retrying in 30s",
							{ orderId, attempts },
						);
						yield* Effect.sleep(Duration.seconds(30));
						attempts++;
						continue;
					}

					const driver = nearbyDrivers[0]!;
					attempts++;

					const result = yield* sendRequest(orderId, driver.id);

					yield* Effect.logInfo("Dispatch: driver responded", {
						orderId,
						driverId: driver.id,
						result,
					});

					if (result === "accepted") {
						yield* dbQuery(
							db
								.update(orders)
								.set({
									driverId: driver.userId,
									status: "driver_assigned",
									updatedAt: new Date(),
								})
								.where(eq(orders.id, orderId)),
						);

						yield* dbQuery(
							db
								.update(drivers)
								.set({
									status: "online_busy",
									updatedAt: new Date(),
								})
								.where(eq(drivers.id, driver.id)),
						);

						yield* Effect.logInfo("Dispatch: driver assigned", {
							orderId,
							driverId: driver.id,
						});
						return; // Dispatch complete
					}
				}
				yield* Effect.logError(
					"Dispatch: failed to assign driver after max attempts",
					{
						orderId,
						attempts,
					},
				);
			});
		const startDispatch: DispatchServiceShape["startDispatch"] = (
			orderId,
			restaurantLatitude,
			restaurantLongitude,
		) =>
			Effect.gen(function* () {
				yield* Effect.logInfo("Dispatch: forking background fiber", {
					orderId,
				});

				yield* Effect.forkDetach(
					dispatchLoop(orderId, restaurantLatitude, restaurantLongitude).pipe(
						Effect.catch((err) =>
							Effect.logError("Dispatch fiber error", {
								orderId,
								error: String(err),
							}),
						),
					),
				);
			});
		const acceptDeliveryRequest: DispatchServiceShape["acceptDeliveryRequest"] =
			(requestId, driverId) =>
				Effect.gen(function* () {
					const [request] = yield* dbQuery(
						db
							.select()
							.from(deliveryRequests)
							.where(eq(deliveryRequests.id, requestId))
							.limit(1),
					);

					if (!request) {
						return yield* new NotFoundError({
							resource: "DeliveryRequest",
							id: requestId,
						});
					}
					if (request.driverId !== driverId) {
						return yield* new ForbiddenError({
							message: "This request was not sent to you",
						});
					}
					if (request.status !== "pending") {
						return yield* new BusinessRuleError({
							message: `Request is already ${request.status}`,
						});
					}
					if (new Date() >= request.expiresAt) {
						return yield* new BusinessRuleError({
							message: "Request has expired",
						});
					}

					const [updated] = yield* dbQuery(
						db
							.update(deliveryRequests)
							.set({
								status: "accepted",
								respondedAt: new Date(),
							})
							.where(eq(deliveryRequests.id, requestId))
							.returning(),
					);

					if (!updated)
						return yield* new DbError({
							message: "Failed to accept request",
						});
					return toRequestRow(updated);
				});
		const declineDeliveryRequest: DispatchServiceShape["declineDeliveryRequest"] =
			(requestId, driverId) =>
				Effect.gen(function* () {
					const [request] = yield* dbQuery(
						db
							.select()
							.from(deliveryRequests)
							.where(eq(deliveryRequests.id, requestId))
							.limit(1),
					);

					if (!request) {
						return yield* new NotFoundError({
							resource: "DeliveryRequest",
							id: requestId,
						});
					}
					if (request.driverId !== driverId) {
						return yield* new ForbiddenError({
							message: "This request was not sent to you",
						});
					}
					if (request.status !== "pending") {
						return yield* new BusinessRuleError({
							message: `Request is already ${request.status}`,
						});
					}

					const [updated] = yield* dbQuery(
						db
							.update(deliveryRequests)
							.set({
								status: "declined",
								respondedAt: new Date(),
							})
							.where(eq(deliveryRequests.id, requestId))
							.returning(),
					);

					if (!updated)
						return yield* new DbError({
							message: "Failed to decline request",
						});
					return toRequestRow(updated);
				});
		const getMyPendingRequest: DispatchServiceShape["getMyPendingRequest"] = (
			driverId,
		) =>
			Effect.gen(function* () {
				const [request] = yield* dbQuery(
					db
						.select()
						.from(deliveryRequests)
						.where(
							and(
								eq(deliveryRequests.driverId, driverId),
								eq(deliveryRequests.status, "pending"),
								sql`${deliveryRequests.expiresAt} > NOW()`,
							),
						)
						.limit(1),
				);

				return request ? toRequestRow(request) : null;
			});

		return {
			startDispatch,
			acceptDeliveryRequest,
			declineDeliveryRequest,
			getMyPendingRequest,
		};
	}),
);
