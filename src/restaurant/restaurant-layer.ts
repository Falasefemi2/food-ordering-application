import { and, count, eq, inArray, isNull } from "drizzle-orm";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { PgDatabase } from "../db";
import {
	customizationGroups,
	customizationOptions,
	menuCategories,
	menuItems,
	restaurants,
} from "../db/schema";
import {
	BusinessRuleError,
	ConflictError,
	DbError,
	ForbiddenError,
	NotFoundError,
} from "../libs/errors";
import {
	type PublicRestaurantDetailRow,
	type PublicRestaurantRow,
	type RestaurantRow,
	RestaurantService,
	type RestaurantServiceShape,
} from "./restaurant-service";

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

const toRestaurantRow = (r: {
	id: string;
	ownerId: string;
	name: string;
	description: string | null;
	logoUrl: string | null;
	bannerUrl: string | null;
	phoneNumber: string;
	email: string;
	addressLine: string;
	city: string;
	state: string;
	country: string;
	approvalStatus: string;
	latitude: string;
	longitude: string;
	isOpen: boolean;
	openingTime: string;
	closingTime: string;
	estimatedPrepTime: number;
	ratingAvg: string;
	ratingCount: number;
	createdAt: Date;
	updatedAt: Date;
}): RestaurantRow => ({
	id: r.id,
	ownerId: r.ownerId,
	name: r.name,
	description: r.description,
	logoUrl: r.logoUrl,
	bannerUrl: r.bannerUrl,
	phoneNumber: r.phoneNumber,
	email: r.email,
	addressLine: r.addressLine,
	city: r.city,
	state: r.state,
	country: r.country,
	approvalStatus: r.approvalStatus,
	latitude: r.latitude,
	longitude: r.longitude,
	isOpen: r.isOpen,
	openingTime: r.openingTime,
	closingTime: r.closingTime,
	estimatedPrepTime: r.estimatedPrepTime,
	ratingAvg: r.ratingAvg,
	ratingCount: r.ratingCount,
	createdAt: r.createdAt.toISOString(),
	updatedAt: r.updatedAt.toISOString(),
});

const toPublicRestaurantRow = (r: {
	id: string;
	name: string;
	description: string | null;
	logoUrl: string | null;
	bannerUrl: string | null;
	city: string;
	state: string;
	latitude: string;
	longitude: string;
	isOpen: boolean;
	openingTime: string;
	closingTime: string;
	estimatedPrepTime: number;
	ratingAvg: string;
	ratingCount: number;
}): PublicRestaurantRow => ({
	id: r.id,
	name: r.name,
	description: r.description,
	logoUrl: r.logoUrl,
	bannerUrl: r.bannerUrl,
	city: r.city,
	state: r.state,
	latitude: r.latitude,
	longitude: r.longitude,
	isOpen: r.isOpen,
	openingTime: r.openingTime,
	closingTime: r.closingTime,
	estimatedPrepTime: r.estimatedPrepTime,
	ratingAvg: r.ratingAvg,
	ratingCount: r.ratingCount,
});

export const RestaurantLive = Layer.effect(
	RestaurantService,
	Effect.gen(function* () {
		const db = yield* PgDatabase;

		const assertOwner = (ownerId: string, restaurantId: string) =>
			Effect.gen(function* () {
				const [row] = yield* dbQuery(
					db
						.select({
							id: restaurants.id,
							ownerId: restaurants.ownerId,
							approvalStatus: restaurants.approvalStatus,
						})
						.from(restaurants)
						.where(
							and(
								eq(restaurants.id, restaurantId),
								isNull(restaurants.deletedAt),
							),
						)
						.limit(1),
				);
				if (!row)
					return yield* new NotFoundError({
						resource: "Restaurant",
						id: restaurantId,
					});

				if (row.ownerId !== ownerId)
					return yield* new ForbiddenError({
						message: "You do not own this restaurant",
					});

				return row;
			});

		const assertItemBelongsToRestaurant = (
			itemId: string,
			restaurantId: string,
		) =>
			Effect.gen(function* () {
				const [row] = yield* dbQuery(
					db
						.select({ id: menuItems.id })
						.from(menuItems)
						.where(
							and(
								eq(menuItems.id, itemId),
								eq(menuItems.restaurantId, restaurantId),
								isNull(menuItems.deletedAt),
							),
						)
						.limit(1),
				);
				if (!row)
					return yield* new NotFoundError({
						resource: "MenuItem",
						id: itemId,
					});

				return row;
			});

		const assertGroupBelongsToItem = (groupId: string, itemId: string) =>
			Effect.gen(function* () {
				const [row] = yield* dbQuery(
					db
						.select({
							id: customizationGroups.id,
						})
						.from(customizationGroups)
						.where(
							and(
								eq(customizationGroups.id, groupId),
								eq(customizationGroups.menuItemId, itemId),
							),
						)
						.limit(1),
				);
				if (!row)
					return yield* new NotFoundError({
						resource: "CustomizationGroup",
						id: groupId,
					});

				return row;
			});

		const createRestaurant: RestaurantServiceShape["createRestaurant"] = (
			ownerId,
			input,
		) =>
			Effect.gen(function* () {
				const [existing] = yield* dbQuery(
					db
						.select({
							id: restaurants.id,
						})
						.from(restaurants)
						.where(
							and(
								eq(restaurants.ownerId, ownerId),
								isNull(restaurants.deletedAt),
							),
						)
						.limit(1),
				);
				if (existing)
					return yield* new ConflictError({
						message: "You already have a restaurant",
					});

				const [row] = yield* dbQuery(
					db
						.insert(restaurants)
						.values({
							ownerId,
							name: input.name,
							description: input.description ?? null,
							phoneNumber: input.phoneNumber,
							email: input.email,
							addressLine: input.addressLine,
							city: input.city,
							state: input.state,
							country: input.country ?? "Nigeria",
							latitude: input.latitude,
							longitude: input.longitude,
							openingTime: input.openingTime,
							closingTime: input.closingTime,
							estimatedPrepTime: input.estimatedPrepTime ?? 20,
						})
						.returning(),
				);
				if (!row)
					return yield* new DbError({
						message: "Failed to create restaurant",
					});

				return toRestaurantRow(row);
			});

		const getMyRestaurant: RestaurantServiceShape["getMyRestaurant"] = (
			ownerId,
		) =>
			Effect.gen(function* () {
				const [row] = yield* dbQuery(
					db
						.select()
						.from(restaurants)
						.where(
							and(
								eq(restaurants.ownerId, ownerId),
								isNull(restaurants.deletedAt),
							),
						)
						.limit(1),
				);
				if (!row)
					return yield* new NotFoundError({
						resource: "Restaurant",
					});

				return toRestaurantRow(row);
			});

		const updateRestaurant: RestaurantServiceShape["updateRestaurant"] = (
			restaurantId,
			ownerId,
			input,
		) =>
			Effect.gen(function* () {
				const current = yield* assertOwner(ownerId, restaurantId);
				if (input.isOpen === true && current.approvalStatus !== "approved") {
					return yield* new BusinessRuleError({
						message: "Restaurant must be approved before it can open",
					});
				}
				const [updated] = yield* dbQuery(
					db
						.update(restaurants)
						.set({
							...input,
							updatedAt: new Date(),
						})
						.where(eq(restaurants.id, restaurantId))
						.returning(),
				);
				if (!updated)
					return yield* new DbError({
						message: "Failed to update restaurant",
					});

				return toRestaurantRow(updated);
			});

		const createCategory: RestaurantServiceShape["createCategory"] = (
			restaurantId,
			ownerId,
			input,
		) =>
			Effect.gen(function* () {
				yield* assertOwner(ownerId, restaurantId);
				const [row] = yield* dbQuery(
					db
						.insert(menuCategories)
						.values({
							restaurantId,
							name: input.name,
							description: input.description ?? null,
							sortOrder: input.sortOrder ?? 0,
						})
						.returning(),
				);
				if (!row)
					return yield* new DbError({
						message: "Failed to create category",
					});

				return {
					...row,
					createdAt: row.createdAt.toISOString(),
					updatedAt: row.updatedAt.toISOString(),
				};
			});

		const updateCategory: RestaurantServiceShape["updateCategory"] = (
			restaurantId,
			categoryId,
			ownerId,
			input,
		) =>
			Effect.gen(function* () {
				yield* assertOwner(ownerId, restaurantId);
				const [updated] = yield* dbQuery(
					db
						.update(menuCategories)
						.set({
							...input,
							updatedAt: new Date(),
						})
						.where(
							and(
								eq(menuCategories.id, categoryId),
								eq(menuCategories.restaurantId, restaurantId),
							),
						)
						.returning(),
				);
				if (!updated)
					return yield* new NotFoundError({
						resource: "MenuCategory",
						id: categoryId,
					});

				return {
					...updated,
					createdAt: updated.createdAt.toISOString(),
					updatedAt: updated.updatedAt.toISOString(),
				};
			});

		const deleteCategory: RestaurantServiceShape["deleteCategory"] = (
			restaurantId,
			categoryId,
			ownerId,
		) =>
			Effect.gen(function* () {
				yield* assertOwner(ownerId, restaurantId);
				const [deleted] = yield* dbQuery(
					db
						.update(menuCategories)
						.set({
							isActive: false,
							updatedAt: new Date(),
						})
						.where(
							and(
								eq(menuCategories.id, categoryId),
								eq(menuCategories.restaurantId, restaurantId),
							),
						)
						.returning({
							id: menuCategories.id,
						}),
				);
				if (!deleted)
					return yield* new NotFoundError({
						resource: "MenuCategory",
						id: categoryId,
					});
			});

		const createMenuItem: RestaurantServiceShape["createMenuItem"] = (
			restaurantId,
			categoryId,
			ownerId,
			input,
		) =>
			Effect.gen(function* () {
				yield* assertOwner(ownerId, restaurantId);
				const [row] = yield* dbQuery(
					db
						.insert(menuItems)
						.values({
							restaurantId,
							categoryId,
							name: input.name,
							description: input.description ?? null,
							price: input.price,
							isVegetarian: input.isVegetarian ?? false,
							calories: input.calories ?? null,
						})
						.returning(),
				);
				if (!row)
					return yield* new DbError({
						message: "Failed to create menu item",
					});

				return {
					...row,
					createdAt: row.createdAt.toISOString(),
					updatedAt: row.updatedAt.toISOString(),
				};
			});

		const updateMenuItem: RestaurantServiceShape["updateMenuItem"] = (
			restaurantId,
			itemId,
			ownerId,
			input,
		) =>
			Effect.gen(function* () {
				yield* assertOwner(ownerId, restaurantId);
				const [updated] = yield* dbQuery(
					db
						.update(menuItems)
						.set({
							...input,
							updatedAt: new Date(),
						})
						.where(
							and(
								eq(menuItems.id, itemId),
								eq(menuItems.restaurantId, restaurantId),
								isNull(menuItems.deletedAt),
							),
						)
						.returning(),
				);
				if (!updated)
					return yield* new NotFoundError({
						resource: "MenuItem",
						id: itemId,
					});

				return {
					...updated,
					createdAt: updated.createdAt.toISOString(),
					updatedAt: updated.updatedAt.toISOString(),
				};
			});

		const deleteMenuItem: RestaurantServiceShape["deleteMenuItem"] = (
			restaurantId,
			itemId,
			ownerId,
		) =>
			Effect.gen(function* () {
				yield* assertOwner(ownerId, restaurantId);
				const [deleted] = yield* dbQuery(
					db
						.update(menuItems)
						.set({
							deletedAt: new Date(),
						})
						.where(
							and(
								eq(menuItems.id, itemId),
								eq(menuItems.restaurantId, restaurantId),
								isNull(menuItems.deletedAt),
							),
						)
						.returning({
							id: menuItems.id,
						}),
				);
				if (!deleted)
					return yield* new NotFoundError({
						resource: "MenuItem",
						id: itemId,
					});
			});

		const createCustomizationGroup: RestaurantServiceShape["createCustomizationGroup"] =
			(restaurantId, itemId, ownerId, input) =>
				Effect.gen(function* () {
					yield* assertOwner(ownerId, restaurantId);
					yield* assertItemBelongsToRestaurant(itemId, restaurantId);
					const [row] = yield* dbQuery(
						db
							.insert(customizationGroups)
							.values({
								menuItemId: itemId,
								name: input.name,
								minSelectable: input.minSelectable ?? 0,
								maxSelectable: input.maxSelectable ?? 1,
								isRequired: input.isRequired ?? false,
							})
							.returning(),
					);
					if (!row)
						return yield* new DbError({
							message: "Failed to create customization group",
						});

					return {
						...row,
						createdAt: row.createdAt.toISOString(),
						updatedAt: row.updatedAt.toISOString(),
					};
				});

		const updateCustomizationGroup: RestaurantServiceShape["updateCustomizationGroup"] =
			(restaurantId, itemId, groupId, ownerId, input) =>
				Effect.gen(function* () {
					yield* assertOwner(ownerId, restaurantId);
					yield* assertItemBelongsToRestaurant(itemId, restaurantId);
					yield* assertGroupBelongsToItem(groupId, itemId);
					const [updated] = yield* dbQuery(
						db
							.update(customizationGroups)
							.set({
								...input,
								updatedAt: new Date(),
							})
							.where(
								and(
									eq(customizationGroups.id, groupId),
									eq(customizationGroups.menuItemId, itemId),
								),
							)
							.returning(),
					);
					if (!updated)
						return yield* new NotFoundError({
							resource: "CustomizationGroup",
							id: groupId,
						});

					return {
						...updated,
						createdAt: updated.createdAt.toISOString(),
						updatedAt: updated.updatedAt.toISOString(),
					};
				});

		const deleteCustomizationGroup: RestaurantServiceShape["deleteCustomizationGroup"] =
			(restaurantId, itemId, groupId, ownerId) =>
				Effect.gen(function* () {
					yield* assertOwner(ownerId, restaurantId);
					yield* assertItemBelongsToRestaurant(itemId, restaurantId);
					const [deleted] = yield* dbQuery(
						db
							.delete(customizationGroups)
							.where(
								and(
									eq(customizationGroups.id, groupId),
									eq(customizationGroups.menuItemId, itemId),
								),
							)
							.returning({
								id: customizationGroups.id,
							}),
					);
					if (!deleted)
						return yield* new NotFoundError({
							resource: "CustomizationGroup",
							id: groupId,
						});
				});

		const createCustomizationOption: RestaurantServiceShape["createCustomizationOption"] =
			(restaurantId, itemId, groupId, ownerId, input) =>
				Effect.gen(function* () {
					yield* assertOwner(ownerId, restaurantId);
					yield* assertItemBelongsToRestaurant(itemId, restaurantId);
					yield* assertGroupBelongsToItem(groupId, itemId);
					const [row] = yield* dbQuery(
						db
							.insert(customizationOptions)
							.values({
								groupId,
								name: input.name,
								price: input.price ?? "0.00",
								isAvailable: input.isAvailable ?? true,
							})
							.returning(),
					);
					if (!row)
						return yield* new DbError({
							message: "Failed to create customization option",
						});

					return {
						...row,
						createdAt: row.createdAt.toISOString(),
						updatedAt: row.updatedAt.toISOString(),
					};
				});

		const updateCustomizationOption: RestaurantServiceShape["updateCustomizationOption"] =
			(restaurantId, itemId, groupId, optionId, ownerId, input) =>
				Effect.gen(function* () {
					yield* assertOwner(ownerId, restaurantId);
					yield* assertItemBelongsToRestaurant(itemId, restaurantId);
					yield* assertGroupBelongsToItem(groupId, itemId);
					const [updated] = yield* dbQuery(
						db
							.update(customizationOptions)
							.set({
								...input,
								updatedAt: new Date(),
							})
							.where(
								and(
									eq(customizationOptions.id, optionId),
									eq(customizationOptions.groupId, groupId),
								),
							)
							.returning(),
					);
					if (!updated)
						return yield* new NotFoundError({
							resource: "CustomizationOption",
							id: optionId,
						});

					return {
						...updated,
						createdAt: updated.createdAt.toISOString(),
						updatedAt: updated.updatedAt.toISOString(),
					};
				});

		const deleteCustomizationOption: RestaurantServiceShape["deleteCustomizationOption"] =
			(restaurantId, itemId, groupId, optionId, ownerId) =>
				Effect.gen(function* () {
					yield* assertOwner(ownerId, restaurantId);
					yield* assertItemBelongsToRestaurant(itemId, restaurantId);
					yield* assertGroupBelongsToItem(groupId, itemId);
					const [deleted] = yield* dbQuery(
						db
							.delete(customizationOptions)
							.where(
								and(
									eq(customizationOptions.id, optionId),
									eq(customizationOptions.groupId, groupId),
								),
							)
							.returning({
								id: customizationOptions.id,
							}),
					);
					if (!deleted)
						return yield* new NotFoundError({
							resource: "CustomizationOption",
							id: optionId,
						});
				});

		const listRestaurants: RestaurantServiceShape["listRestaurants"] = (
			pagination,
			filters,
		) =>
			Effect.gen(function* () {
				const { page, limit } = pagination;
				const offset = (page - 1) * limit;

				const conditions = and(
					eq(restaurants.approvalStatus, "approved"),
					isNull(restaurants.deletedAt),
					filters?.city ? eq(restaurants.city, filters.city) : undefined,
					filters?.isOpen !== undefined
						? eq(restaurants.isOpen, filters.isOpen)
						: undefined,
				);
				const publicRestaurantSelect = {
					id: restaurants.id,
					name: restaurants.name,
					description: restaurants.description,
					logoUrl: restaurants.logoUrl,
					bannerUrl: restaurants.bannerUrl,
					city: restaurants.city,
					state: restaurants.state,
					latitude: restaurants.latitude,
					longitude: restaurants.longitude,
					isOpen: restaurants.isOpen,
					openingTime: restaurants.openingTime,
					closingTime: restaurants.closingTime,
					estimatedPrepTime: restaurants.estimatedPrepTime,
					ratingAvg: restaurants.ratingAvg,
					ratingCount: restaurants.ratingCount,
				};

				const [totalResult] = yield* dbQuery(
					db
						.select({
							count: count(),
						})
						.from(restaurants)
						.where(conditions),
				);

				const rows = yield* dbQuery(
					db
						.select(publicRestaurantSelect)
						.from(restaurants)
						.where(conditions)
						.limit(limit)
						.offset(offset),
				);

				const total = Number(totalResult?.count);

				return {
					data: rows.map(toPublicRestaurantRow),
					total,
					page,
					limit,
					totalPages: Math.ceil(total / limit),
					hasNext: page < Math.ceil(total / limit),
					hasPrev: page > 1,
				};
			});

		const getRestaurant: RestaurantServiceShape["getRestaurant"] = (
			restaurantId,
		) =>
			Effect.gen(function* () {
				const [rest] = yield* dbQuery(
					db
						.select({
							id: restaurants.id,
							name: restaurants.name,
							description: restaurants.description,
							logoUrl: restaurants.logoUrl,
							bannerUrl: restaurants.bannerUrl,
							city: restaurants.city,
							state: restaurants.state,
							latitude: restaurants.latitude,
							longitude: restaurants.longitude,
							isOpen: restaurants.isOpen,
							openingTime: restaurants.openingTime,
							closingTime: restaurants.closingTime,
							estimatedPrepTime: restaurants.estimatedPrepTime,
							ratingAvg: restaurants.ratingAvg,
							ratingCount: restaurants.ratingCount,
						})
						.from(restaurants)
						.where(
							and(
								eq(restaurants.id, restaurantId),
								eq(restaurants.approvalStatus, "approved"),
								isNull(restaurants.deletedAt),
							),
						)
						.limit(1),
				);
				if (!rest)
					return yield* new NotFoundError({
						resource: "Restaurant",
						id: restaurantId,
					});

				const cats = yield* dbQuery(
					db
						.select({
							id: menuCategories.id,
							name: menuCategories.name,
							description: menuCategories.description,
							sortOrder: menuCategories.sortOrder,
						})
						.from(menuCategories)
						.where(
							and(
								eq(menuCategories.restaurantId, restaurantId),
								eq(menuCategories.isActive, true),
							),
						),
				);

				if (cats.length === 0) {
					return {
						...toPublicRestaurantRow(rest),
						categories: [],
					};
				}

				const catIds = cats.map((c) => c.id);

				const items = yield* dbQuery(
					db
						.select({
							id: menuItems.id,
							categoryId: menuItems.categoryId,
							name: menuItems.name,
							description: menuItems.description,
							price: menuItems.price,
							imageUrl: menuItems.imageUrl,
							isAvailable: menuItems.isAvailable,
							isVegetarian: menuItems.isVegetarian,
							calories: menuItems.calories,
						})
						.from(menuItems)
						.where(
							and(
								eq(menuItems.restaurantId, restaurantId),
								eq(menuItems.isAvailable, true),
								isNull(menuItems.deletedAt),
							),
						),
				);

				const itemIds = items.map((i) => i.id);

				const groups =
					itemIds.length > 0
						? yield* dbQuery(
								db
									.select({
										id: customizationGroups.id,
										menuItemId: customizationGroups.menuItemId,
										name: customizationGroups.name,
										minSelectable: customizationGroups.minSelectable,
										maxSelectable: customizationGroups.maxSelectable,
										isRequired: customizationGroups.isRequired,
									})
									.from(customizationGroups)
									.where(inArray(customizationGroups.menuItemId, itemIds)),
							)
						: [];

				const groupIds = groups.map((g) => g.id);

				const options =
					groupIds.length > 0
						? yield* dbQuery(
								db
									.select({
										id: customizationOptions.id,
										groupId: customizationOptions.groupId,
										name: customizationOptions.name,
										price: customizationOptions.price,
										isAvailable: customizationOptions.isAvailable,
									})
									.from(customizationOptions)
									.where(inArray(customizationOptions.groupId, groupIds)),
							)
						: [];

				const optionsByGroup = new Map<string, typeof options>();
				for (const opt of options) {
					const list = optionsByGroup.get(opt.groupId) ?? [];
					list.push(opt);
					optionsByGroup.set(opt.groupId, list);
				}

				const groupsByItem = new Map<string, typeof groups>();
				for (const grp of groups) {
					const list = groupsByItem.get(grp.menuItemId) ?? [];
					list.push(grp);
					groupsByItem.set(grp.menuItemId, list);
				}

				const itemsByCategory = new Map<string, typeof items>();
				for (const item of items) {
					const list = itemsByCategory.get(item.categoryId) ?? [];
					list.push(item);
					itemsByCategory.set(item.categoryId, list);
				}

				const categories = cats
					.sort((a, b) => a.sortOrder - b.sortOrder)
					.map((cat) => ({
						id: cat.id,
						name: cat.name,
						description: cat.description,
						sortOrder: cat.sortOrder,
						items: (itemsByCategory.get(cat.id) ?? []).map((item) => ({
							id: item.id,
							name: item.name,
							description: item.description,
							price: item.price,
							imageUrl: item.imageUrl,
							isAvailable: item.isAvailable,
							isVegetarian: item.isVegetarian,
							calories: item.calories,
							customizationGroups: (groupsByItem.get(item.id) ?? []).map(
								(grp) => ({
									id: grp.id,
									name: grp.name,
									minSelectable: grp.minSelectable,
									maxSelectable: grp.maxSelectable,
									isRequired: grp.isRequired,
									options: (optionsByGroup.get(grp.id) ?? []).filter(
										(o) => o.isAvailable,
									),
								}),
							),
						})),
					}));

				return {
					...toPublicRestaurantRow(rest),
					categories,
				} satisfies PublicRestaurantDetailRow;
			});

		return {
			createRestaurant,
			getMyRestaurant,
			updateRestaurant,
			createCategory,
			updateCategory,
			deleteCategory,
			createMenuItem,
			updateMenuItem,
			deleteMenuItem,
			createCustomizationGroup,
			updateCustomizationGroup,
			deleteCustomizationGroup,
			createCustomizationOption,
			updateCustomizationOption,
			deleteCustomizationOption,
			listRestaurants,
			getRestaurant,
		};
	}),
);
