import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../api";
import { AuthContext } from "../auth/auth-middleware";
import { RestaurantService } from "./restaurant-service";
import { ForbiddenError } from "../libs/errors";
import { CacheService, CacheKeys } from "../libs/cacheservice";

const vendorOnly = (role: string) =>
	role === "vendor"
		? Effect.void
		: Effect.fail(
				new ForbiddenError({
					message: "Only vendors can perform this action",
				}),
			);

export const RestaurantHandlers = HttpApiBuilder.group(
	Api,
	"restaurant",
	Effect.fn(function* (handlers) {
		const restaurant = yield* RestaurantService;
		const cache = yield* CacheService;

		return handlers
			.handle("listRestaurants", ({ query }) =>
				Effect.gen(function* () {
					const page = Number(query.page ?? 1);
					const limit = Number(query.limit ?? 20);

					const key = CacheKeys.restaurantList(
						page,
						limit,
						query.city,
						query.isOpen,
					);

					return yield* cache.getRestaurantList(
						key,
						() =>
							restaurant
								.listRestaurants(
									{
										page,
										limit,
									},
									{
										city: query.city,
										isOpen: query.isOpen,
									},
								)
								.pipe(
									Effect.catchTag(
										"DbError",
										Effect.orDie,
									),
								),
					);
				}),
			)
			.handle("getRestaurant", ({ params }) =>
				Effect.gen(function* () {
					const key = CacheKeys.restaurantDetail(
						params.id,
					);
					return yield* cache.getRestaurantDetail(
						key,
						() =>
							restaurant
								.getRestaurant(
									params.id,
								)
								.pipe(
									Effect.orDie,
								),
					);
				}),
			)
			.handle("createRestaurant", ({ payload }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					yield* vendorOnly(role);
					return yield* restaurant
						.createRestaurant(
							ownerId,
							payload,
						)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
				}),
			)
			.handle("getMyRestaurant", () =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					yield* vendorOnly(role);
					return yield* restaurant
						.getMyRestaurant(ownerId)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
				}),
			)
			.handle("updateRestaurant", ({ params, payload }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					yield* vendorOnly(role);
					return yield* restaurant
						.updateRestaurant(
							params.id,
							ownerId,
							payload,
						)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
				}),
			)
			.handle("createCategory", ({ params, payload }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					yield* vendorOnly(role);
					return yield* restaurant
						.createCategory(
							params.id,
							ownerId,
							payload,
						)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
				}),
			)
			.handle("updateCategory", ({ params, payload }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					yield* vendorOnly(role);
					return yield* restaurant
						.updateCategory(
							params.id,
							params.categoryId,
							ownerId,
							payload,
						)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
				}),
			)
			.handle("deleteCategory", ({ params }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					yield* vendorOnly(role);
					yield* restaurant
						.deleteCategory(
							params.id,
							params.categoryId,
							ownerId,
						)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
					return {
						message: "Category deleted",
					};
				}),
			)
			.handle("createMenuItem", ({ params, payload }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					yield* vendorOnly(role);
					return yield* restaurant
						.createMenuItem(
							params.id,
							params.categoryId,
							ownerId,
							payload,
						)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
				}),
			)
			.handle("updateMenuItem", ({ params, payload }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					yield* vendorOnly(role);
					return yield* restaurant
						.updateMenuItem(
							params.id,
							params.itemId,
							ownerId,
							payload,
						)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
				}),
			)
			.handle("deleteMenuItem", ({ params }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					yield* vendorOnly(role);
					yield* restaurant
						.deleteMenuItem(
							params.id,
							params.itemId,
							ownerId,
						)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
					return {
						message: "Menu item deleted",
					};
				}),
			)
			.handle(
				"createCustomizationGroup",
				({ params, payload }) =>
					Effect.gen(function* () {
						const { sub: ownerId, role } =
							yield* AuthContext;
						yield* vendorOnly(role);
						return yield* restaurant
							.createCustomizationGroup(
								params.id,
								params.itemId,
								ownerId,
								payload,
							)
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
					}),
			)
			.handle(
				"updateCustomizationGroup",
				({ params, payload }) =>
					Effect.gen(function* () {
						const { sub: ownerId, role } =
							yield* AuthContext;
						yield* vendorOnly(role);
						return yield* restaurant
							.updateCustomizationGroup(
								params.id,
								params.itemId,
								params.groupId,
								ownerId,
								payload,
							)
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
					}),
			)
			.handle("deleteCustomizationGroup", ({ params }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					yield* vendorOnly(role);
					yield* restaurant
						.deleteCustomizationGroup(
							params.id,
							params.itemId,
							params.groupId,
							ownerId,
						)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
					return {
						message: "Customization group deleted",
					};
				}),
			)
			.handle(
				"createCustomizationOption",
				({ params, payload }) =>
					Effect.gen(function* () {
						const { sub: ownerId, role } =
							yield* AuthContext;
						yield* vendorOnly(role);
						return yield* restaurant
							.createCustomizationOption(
								params.id,
								params.itemId,
								params.groupId,
								ownerId,
								payload,
							)
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
					}),
			)
			.handle(
				"updateCustomizationOption",
				({ params, payload }) =>
					Effect.gen(function* () {
						const { sub: ownerId, role } =
							yield* AuthContext;
						yield* vendorOnly(role);
						return yield* restaurant
							.updateCustomizationOption(
								params.id,
								params.itemId,
								params.groupId,
								params.optionId,
								ownerId,
								payload,
							)
							.pipe(
								Effect.catchTag(
									"DbError",
									Effect.orDie,
								),
							);
					}),
			)
			.handle("deleteCustomizationOption", ({ params }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					yield* vendorOnly(role);
					yield* restaurant
						.deleteCustomizationOption(
							params.id,
							params.itemId,
							params.groupId,
							params.optionId,
							ownerId,
						)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
					return {
						message: "Customization option deleted",
					};
				}),
			);
	}),
);
