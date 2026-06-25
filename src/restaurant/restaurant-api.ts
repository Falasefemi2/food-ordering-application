import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { AuthMiddleware } from "../auth/auth-middleware";
import {
	NotFoundError,
	ConflictError,
	ForbiddenError,
	BusinessRuleError,
} from "../libs/errors";

export const RestaurantResponse = Schema.Struct({
	id: Schema.String,
	ownerId: Schema.String,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	logoUrl: Schema.NullOr(Schema.String),
	bannerUrl: Schema.NullOr(Schema.String),
	phoneNumber: Schema.String,
	email: Schema.String,
	addressLine: Schema.String,
	city: Schema.String,
	state: Schema.String,
	country: Schema.String,
	approvalStatus: Schema.String,
	latitude: Schema.String,
	longitude: Schema.String,
	isOpen: Schema.Boolean,
	openingTime: Schema.String,
	closingTime: Schema.String,
	estimatedPrepTime: Schema.Number,
	ratingAvg: Schema.String,
	ratingCount: Schema.Number,
	createdAt: Schema.String,
	updatedAt: Schema.String,
});

const PublicRestaurantResponse = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	logoUrl: Schema.NullOr(Schema.String),
	bannerUrl: Schema.NullOr(Schema.String),
	city: Schema.String,
	state: Schema.String,
	latitude: Schema.String,
	longitude: Schema.String,
	isOpen: Schema.Boolean,
	openingTime: Schema.String,
	closingTime: Schema.String,
	estimatedPrepTime: Schema.Number,
	ratingAvg: Schema.String,
	ratingCount: Schema.Number,
});

const CustomizationOptionResponse = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	price: Schema.String,
	isAvailable: Schema.Boolean,
});

const CustomizationGroupResponse = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	minSelectable: Schema.Number,
	maxSelectable: Schema.Number,
	isRequired: Schema.Boolean,
	options: Schema.Array(CustomizationOptionResponse),
});

const MenuItemResponse = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	price: Schema.String,
	imageUrl: Schema.NullOr(Schema.String),
	isAvailable: Schema.Boolean,
	isVegetarian: Schema.Boolean,
	calories: Schema.NullOr(Schema.Number),
	customizationGroups: Schema.Array(CustomizationGroupResponse),
});

const MenuCategoryResponse = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	sortOrder: Schema.Number,
	items: Schema.Array(MenuItemResponse),
});

const PublicRestaurantDetailResponse = Schema.Struct({
	...PublicRestaurantResponse.fields,
	categories: Schema.Array(MenuCategoryResponse),
});

const FlatMenuCategoryResponse = Schema.Struct({
	id: Schema.String,
	restaurantId: Schema.String,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	sortOrder: Schema.Number,
	isActive: Schema.Boolean,
	createdAt: Schema.String,
	updatedAt: Schema.String,
});

const FlatMenuItemResponse = Schema.Struct({
	id: Schema.String,
	categoryId: Schema.String,
	restaurantId: Schema.String,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
	price: Schema.String,
	imageUrl: Schema.NullOr(Schema.String),
	isAvailable: Schema.Boolean,
	isVegetarian: Schema.Boolean,
	calories: Schema.NullOr(Schema.Number),
	createdAt: Schema.String,
	updatedAt: Schema.String,
});

const FlatCustomizationGroupResponse = Schema.Struct({
	id: Schema.String,
	menuItemId: Schema.String,
	name: Schema.String,
	minSelectable: Schema.Number,
	maxSelectable: Schema.Number,
	isRequired: Schema.Boolean,
	createdAt: Schema.String,
	updatedAt: Schema.String,
});

const FlatCustomizationOptionResponse = Schema.Struct({
	id: Schema.String,
	groupId: Schema.String,
	name: Schema.String,
	price: Schema.String,
	isAvailable: Schema.Boolean,
	createdAt: Schema.String,
	updatedAt: Schema.String,
});

const DeletedResponse = Schema.Struct({ message: Schema.String });
const TimePattern = Schema.String.pipe(
	Schema.check(Schema.isPattern(/^\d{2}:\d{2}$/)),
);

export const PaginationSchema = Schema.Struct({
	page: Schema.optional(
		Schema.NumberFromString.pipe(
			Schema.check(Schema.isGreaterThanOrEqualTo(1)),
		),
	),
	limit: Schema.optional(
		Schema.NumberFromString.pipe(
			Schema.check(Schema.isGreaterThanOrEqualTo(1)),
			Schema.check(Schema.isLessThanOrEqualTo(100)),
		),
	),

	city: Schema.optional(Schema.String),
	isOpen: Schema.optional(Schema.Boolean),
});

const PaginatedRestaurantSchema = Schema.Struct({
	data: Schema.Array(PublicRestaurantResponse),
	total: Schema.Number,
	page: Schema.Number,
	limit: Schema.Number,
	totalPages: Schema.Number,
	hasNext: Schema.Boolean,
	hasPrev: Schema.Boolean,
});

export class RestaurantApiGroup extends HttpApiGroup.make("restaurant")
	.add(
		HttpApiEndpoint.get("listRestaurants", "/restaurants", {
			query: Schema.Struct({
				...PaginationSchema.fields,
			}),
			success: PaginatedRestaurantSchema,
			error: [],
		}),
	)
	.add(
		HttpApiEndpoint.get("getRestaurant", "/restaurants/:id", {
			params: Schema.Struct({ id: Schema.String }),
			success: PublicRestaurantDetailResponse,
			error: [NotFoundError],
		}),
	)
	.add(
		HttpApiEndpoint.post("createRestaurant", "/restaurants", {
			payload: Schema.Struct({
				name: Schema.String.pipe(
					Schema.check(Schema.isMinLength(1)),
				),
				description: Schema.optional(Schema.String),
				phoneNumber: Schema.String,
				email: Schema.String.pipe(
					Schema.check(
						Schema.isPattern(
							/^\S+@\S+\.\S+$/,
						),
					),
				),
				addressLine: Schema.String,
				city: Schema.String,
				state: Schema.String,
				country: Schema.optional(Schema.String),
				latitude: Schema.String,
				longitude: Schema.String,
				openingTime: TimePattern,
				closingTime: TimePattern,
				estimatedPrepTime: Schema.optional(
					Schema.Number,
				),
			}),
			success: RestaurantResponse,
			error: [ConflictError, ForbiddenError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.get("getMyRestaurant", "/restaurants/me", {
			success: RestaurantResponse,
			error: [NotFoundError, ForbiddenError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.patch("updateRestaurant", "/restaurants/:id", {
			params: Schema.Struct({ id: Schema.String }),
			payload: Schema.Struct({
				name: Schema.optional(Schema.String),
				description: Schema.optional(Schema.String),
				phoneNumber: Schema.optional(Schema.String),
				email: Schema.optional(
					Schema.String.pipe(
						Schema.check(
							Schema.isPattern(
								/^\S+@\S+\.\S+$/,
							),
						),
					),
				),
				addressLine: Schema.optional(Schema.String),
				city: Schema.optional(Schema.String),
				state: Schema.optional(Schema.String),
				openingTime: Schema.optional(TimePattern),
				closingTime: Schema.optional(TimePattern),
				estimatedPrepTime: Schema.optional(
					Schema.Number,
				),
				isOpen: Schema.optional(Schema.Boolean),
			}),
			success: RestaurantResponse,
			error: [
				NotFoundError,
				ForbiddenError,
				BusinessRuleError,
			],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post(
			"createCategory",
			"/restaurants/:id/categories",
			{
				params: Schema.Struct({ id: Schema.String }),
				payload: Schema.Struct({
					name: Schema.String.pipe(
						Schema.check(
							Schema.isMinLength(1),
						),
					),
					description: Schema.optional(
						Schema.String,
					),
					sortOrder: Schema.optional(
						Schema.Number,
					),
				}),
				success: FlatMenuCategoryResponse,
				error: [NotFoundError, ForbiddenError],
			},
		).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.patch(
			"updateCategory",
			"/restaurants/:id/categories/:categoryId",
			{
				params: Schema.Struct({
					id: Schema.String,
					categoryId: Schema.String,
				}),
				payload: Schema.Struct({
					name: Schema.optional(Schema.String),
					description: Schema.optional(
						Schema.String,
					),
					sortOrder: Schema.optional(
						Schema.Number,
					),
					isActive: Schema.optional(
						Schema.Boolean,
					),
				}),
				success: FlatMenuCategoryResponse,
				error: [NotFoundError, ForbiddenError],
			},
		).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.delete(
			"deleteCategory",
			"/restaurants/:id/categories/:categoryId",
			{
				params: Schema.Struct({
					id: Schema.String,
					categoryId: Schema.String,
				}),
				success: DeletedResponse,
				error: [NotFoundError, ForbiddenError],
			},
		).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post(
			"createMenuItem",
			"/restaurants/:id/categories/:categoryId/items",
			{
				params: Schema.Struct({
					id: Schema.String,
					categoryId: Schema.String,
				}),
				payload: Schema.Struct({
					name: Schema.String.pipe(
						Schema.check(
							Schema.isMinLength(1),
						),
					),
					description: Schema.optional(
						Schema.String,
					),
					price: Schema.String,
					isVegetarian: Schema.optional(
						Schema.Boolean,
					),
					calories: Schema.optional(
						Schema.Number,
					),
				}),
				success: FlatMenuItemResponse,
				error: [NotFoundError, ForbiddenError],
			},
		).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.patch(
			"updateMenuItem",
			"/restaurants/:id/items/:itemId",
			{
				params: Schema.Struct({
					id: Schema.String,
					itemId: Schema.String,
				}),
				payload: Schema.Struct({
					name: Schema.optional(Schema.String),
					description: Schema.optional(
						Schema.String,
					),
					price: Schema.optional(Schema.String),
					isAvailable: Schema.optional(
						Schema.Boolean,
					),
					isVegetarian: Schema.optional(
						Schema.Boolean,
					),
					calories: Schema.optional(
						Schema.Number,
					),
				}),
				success: FlatMenuItemResponse,
				error: [NotFoundError, ForbiddenError],
			},
		).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.delete(
			"deleteMenuItem",
			"/restaurants/:id/items/:itemId",
			{
				params: Schema.Struct({
					id: Schema.String,
					itemId: Schema.String,
				}),
				success: DeletedResponse,
				error: [NotFoundError, ForbiddenError],
			},
		).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post(
			"createCustomizationGroup",
			"/restaurants/:id/items/:itemId/groups",
			{
				params: Schema.Struct({
					id: Schema.String,
					itemId: Schema.String,
				}),
				payload: Schema.Struct({
					name: Schema.String.pipe(
						Schema.check(
							Schema.isMinLength(1),
						),
					),
					minSelectable: Schema.optional(
						Schema.Number,
					),
					maxSelectable: Schema.optional(
						Schema.Number,
					),
					isRequired: Schema.optional(
						Schema.Boolean,
					),
				}),
				success: FlatCustomizationGroupResponse,
				error: [NotFoundError, ForbiddenError],
			},
		).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.patch(
			"updateCustomizationGroup",
			"/restaurants/:id/items/:itemId/groups/:groupId",
			{
				params: Schema.Struct({
					id: Schema.String,
					itemId: Schema.String,
					groupId: Schema.String,
				}),
				payload: Schema.Struct({
					name: Schema.optional(Schema.String),
					minSelectable: Schema.optional(
						Schema.Number,
					),
					maxSelectable: Schema.optional(
						Schema.Number,
					),
					isRequired: Schema.optional(
						Schema.Boolean,
					),
				}),
				success: FlatCustomizationGroupResponse,
				error: [NotFoundError, ForbiddenError],
			},
		).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.delete(
			"deleteCustomizationGroup",
			"/restaurants/:id/items/:itemId/groups/:groupId",
			{
				params: Schema.Struct({
					id: Schema.String,
					itemId: Schema.String,
					groupId: Schema.String,
				}),
				success: DeletedResponse,
				error: [NotFoundError, ForbiddenError],
			},
		).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post(
			"createCustomizationOption",
			"/restaurants/:id/items/:itemId/groups/:groupId/options",
			{
				params: Schema.Struct({
					id: Schema.String,
					itemId: Schema.String,
					groupId: Schema.String,
				}),
				payload: Schema.Struct({
					name: Schema.String.pipe(
						Schema.check(
							Schema.isMinLength(1),
						),
					),
					price: Schema.optional(Schema.String),
					isAvailable: Schema.optional(
						Schema.Boolean,
					),
				}),
				success: FlatCustomizationOptionResponse,
				error: [NotFoundError, ForbiddenError],
			},
		).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.patch(
			"updateCustomizationOption",
			"/restaurants/:id/items/:itemId/groups/:groupId/options/:optionId",
			{
				params: Schema.Struct({
					id: Schema.String,
					itemId: Schema.String,
					groupId: Schema.String,
					optionId: Schema.String,
				}),
				payload: Schema.Struct({
					name: Schema.optional(Schema.String),
					price: Schema.optional(Schema.String),
					isAvailable: Schema.optional(
						Schema.Boolean,
					),
				}),
				success: FlatCustomizationOptionResponse,
				error: [NotFoundError, ForbiddenError],
			},
		).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.delete(
			"deleteCustomizationOption",
			"/restaurants/:id/items/:itemId/groups/:groupId/options/:optionId",
			{
				params: Schema.Struct({
					id: Schema.String,
					itemId: Schema.String,
					groupId: Schema.String,
					optionId: Schema.String,
				}),
				success: DeletedResponse,
				error: [NotFoundError, ForbiddenError],
			},
		).middleware(AuthMiddleware),
	) {}
