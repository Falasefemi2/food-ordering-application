import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../api";
import { AuthContext } from "../auth/auth-middleware";
import { AdminService } from "./admin-service";
import { ForbiddenError } from "../libs/errors";
import { CacheService } from "../libs/cacheservice";

const assertAdmin = (role: string) =>
	role === "admin" || role === "support"
		? Effect.void
		: Effect.fail(
				new ForbiddenError({
					message: "Admin access required",
				}),
			);

const assertAdminOnly = (role: string) =>
	role === "admin"
		? Effect.void
		: Effect.fail(
				new ForbiddenError({
					message: "Super-admin access required",
				}),
			);

export const AdminHandlers = HttpApiBuilder.group(
	Api,
	"admin",
	Effect.fn(function* (handlers) {
		const admin = yield* AdminService;
		const cache = yield* CacheService;

		return (
			handlers
				.handle("listPendingRestaurants", () =>
					Effect.gen(function* () {
						const { role } =
							yield* AuthContext;
						yield* assertAdmin(role);
						return yield* admin
							.listPendingRestaurants()
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
					}),
				)
				.handle("listAllRestaurants", () =>
					Effect.gen(function* () {
						const { role } =
							yield* AuthContext;
						yield* assertAdmin(role);
						return yield* admin
							.listAllRestaurants()
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
					}),
				)
				.handle("getRestaurantDetail", ({ params }) =>
					Effect.gen(function* () {
						const { role } =
							yield* AuthContext;
						yield* assertAdmin(role);
						return yield* admin
							.getRestaurantDetail(
								params.id,
							)
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
					}),
				)
				.handle("approveRestaurant", ({ params }) =>
					Effect.gen(function* () {
						const { sub: adminId, role } =
							yield* AuthContext;
						yield* assertAdminOnly(role);
						const result = yield* admin
							.approveRestaurant(
								params.id,
								adminId,
							)
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
						yield* cache.invalidateRestaurant(
							params.id,
						);
						yield* cache.invalidateRestaurantList();
						return result;
					}),
				)
				.handle(
					"rejectRestaurant",
					({ params, payload }) =>
						Effect.gen(function* () {
							const {
								sub: adminId,
								role,
							} = yield* AuthContext;
							yield* assertAdminOnly(
								role,
							);
							const result =
								yield* admin
									.rejectRestaurant(
										params.id,
										adminId,
										payload.reason,
									)
									.pipe(
										Effect.catchTag(
											"DbError",
											Effect.orDie,
										),
									);
							yield* cache.invalidateRestaurant(
								params.id,
							);
							yield* cache.invalidateRestaurantList();
							return result;
						}),
				)
				.handle(
					"suspendRestaurant",
					({ params, payload }) =>
						Effect.gen(function* () {
							const {
								sub: adminId,
								role,
							} = yield* AuthContext;
							yield* assertAdminOnly(
								role,
							);
							const result =
								yield* admin
									.suspendRestaurant(
										params.id,
										adminId,
										payload.reason,
									)
									.pipe(
										Effect.catchTag(
											"DbError",
											Effect.orDie,
										),
									);
							yield* cache.invalidateRestaurant(
								params.id,
							);
							yield* cache.invalidateRestaurantList();
							return result;
						}),
				)
				.handle(
					"updateCommissionRate",
					({ params, payload }) =>
						Effect.gen(function* () {
							const { role } =
								yield* AuthContext;
							yield* assertAdminOnly(
								role,
							);
							return yield* admin
								.updateCommissionRate(
									params.id,
									payload.commissionRate,
								)
								.pipe(
									Effect.catchTag(
										"DbError",
										Effect.orDie,
									),
								);
						}),
				)
				.handle("listUsers", () =>
					Effect.gen(function* () {
						const { role } =
							yield* AuthContext;
						yield* assertAdmin(role);
						return yield* admin
							.listUsers()
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
					}),
				)
				.handle("deactivateUser", ({ params }) =>
					Effect.gen(function* () {
						const { role } =
							yield* AuthContext;
						yield* assertAdminOnly(role);
						yield* admin
							.deactivateUser(
								params.id,
							)
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
						return {
							message: "User deactivated",
						};
					}),
				)
				.handle("reactivateUser", ({ params }) =>
					Effect.gen(function* () {
						const { role } =
							yield* AuthContext;
						yield* assertAdminOnly(role);
						yield* admin
							.reactivateUser(
								params.id,
							)
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
						return {
							message: "User reactivated",
						};
					}),
				)
				.handle("listPendingDrivers", () =>
					Effect.gen(function* () {
						const { role } =
							yield* AuthContext;
						yield* assertAdmin(role);
						return yield* admin
							.listPendingDrivers()
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
					}),
				)
				.handle("approveDriver", ({ params }) =>
					Effect.gen(function* () {
						const { sub: adminId, role } =
							yield* AuthContext;
						yield* assertAdminOnly(role);
						yield* admin
							.approveDriver(
								params.id,
								adminId,
							)
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
						return {
							message: "Driver approved",
						};
					}),
				)
				.handle("rejectDriver", ({ params, payload }) =>
					Effect.gen(function* () {
						const { sub: adminId, role } =
							yield* AuthContext;
						yield* assertAdminOnly(role);
						yield* admin
							.rejectDriver(
								params.id,
								adminId,
								payload.reason,
							)
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
						return {
							message: "Driver rejected",
						};
					}),
				)
		);
	}),
);
