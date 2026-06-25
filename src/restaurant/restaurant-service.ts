import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import type {
	DbError,
	NotFoundError,
	ConflictError,
	ForbiddenError,
	BusinessRuleError,
} from "../libs/errors";
import type { PaginatedResult, PaginationParams } from "../libs/types";

export interface CreateRestaurantInput {
	name: string;
	description?: string;
	phoneNumber: string;
	email: string;
	addressLine: string;
	city: string;
	state: string;
	country?: string;
	latitude: string;
	longitude: string;
	openingTime: string;
	closingTime: string;
	estimatedPrepTime?: number;
}

export interface UpdateRestaurantInput {
	name?: string;
	description?: string;
	phoneNumber?: string;
	email?: string;
	addressLine?: string;
	city?: string;
	state?: string;
	openingTime?: string;
	closingTime?: string;
	estimatedPrepTime?: number;
	isOpen?: boolean;
}

export interface RestaurantRow {
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
	createdAt: string;
	updatedAt: string;
}

export interface CustomizationOptionRow {
	id: string;
	groupId: string;
	name: string;
	price: string;
	isAvailable: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CustomizationGroupRow {
	id: string;
	menuItemId: string;
	name: string;
	minSelectable: number;
	maxSelectable: number;
	isRequired: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface MenuItemRow {
	id: string;
	categoryId: string;
	restaurantId: string;
	name: string;
	description: string | null;
	price: string;
	imageUrl: string | null;
	isAvailable: boolean;
	isVegetarian: boolean;
	calories: number | null;
	createdAt: string;
	updatedAt: string;
}

export interface MenuCategoryRow {
	id: string;
	restaurantId: string;
	name: string;
	description: string | null;
	sortOrder: number;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface PublicOptionRow {
	id: string;
	name: string;
	price: string;
	isAvailable: boolean;
}

export interface PublicGroupRow {
	id: string;
	name: string;
	minSelectable: number;
	maxSelectable: number;
	isRequired: boolean;
	options: PublicOptionRow[];
}

export interface PublicItemRow {
	id: string;
	name: string;
	description: string | null;
	price: string;
	imageUrl: string | null;
	isAvailable: boolean;
	isVegetarian: boolean;
	calories: number | null;
	customizationGroups: PublicGroupRow[];
}

export interface PublicCategoryRow {
	id: string;
	name: string;
	description: string | null;
	sortOrder: number;
	items: PublicItemRow[];
}

export interface PublicRestaurantRow {
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
}

export interface PublicRestaurantDetailRow extends PublicRestaurantRow {
	categories: PublicCategoryRow[];
}

export interface RestaurantServiceShape {
	createRestaurant: (
		ownerId: string,
		input: CreateRestaurantInput,
	) => Effect.Effect<RestaurantRow, DbError | ConflictError>;

	getMyRestaurant: (
		ownerId: string,
	) => Effect.Effect<RestaurantRow, DbError | NotFoundError>;

	updateRestaurant: (
		restaurantId: string,
		ownerId: string,
		input: UpdateRestaurantInput,
	) => Effect.Effect<
		RestaurantRow,
		DbError | NotFoundError | ForbiddenError | BusinessRuleError
	>;

	createCategory: (
		restaurantId: string,
		ownerId: string,
		input: {
			name: string;
			description?: string;
			sortOrder?: number;
		},
	) => Effect.Effect<
		MenuCategoryRow,
		DbError | NotFoundError | ForbiddenError
	>;

	updateCategory: (
		restaurantId: string,
		categoryId: string,
		ownerId: string,
		input: {
			name?: string;
			description?: string;
			sortOrder?: number;
			isActive?: boolean;
		},
	) => Effect.Effect<
		MenuCategoryRow,
		DbError | NotFoundError | ForbiddenError
	>;

	deleteCategory: (
		restaurantId: string,
		categoryId: string,
		ownerId: string,
	) => Effect.Effect<void, DbError | NotFoundError | ForbiddenError>;

	createMenuItem: (
		restaurantId: string,
		categoryId: string,
		ownerId: string,
		input: {
			name: string;
			description?: string;
			price: string;
			isVegetarian?: boolean;
			calories?: number;
		},
	) => Effect.Effect<
		MenuItemRow,
		DbError | NotFoundError | ForbiddenError
	>;

	updateMenuItem: (
		restaurantId: string,
		itemId: string,
		ownerId: string,
		input: {
			name?: string;
			description?: string;
			price?: string;
			isAvailable?: boolean;
			isVegetarian?: boolean;
			calories?: number;
		},
	) => Effect.Effect<
		MenuItemRow,
		DbError | NotFoundError | ForbiddenError
	>;

	deleteMenuItem: (
		restaurantId: string,
		itemId: string,
		ownerId: string,
	) => Effect.Effect<void, DbError | NotFoundError | ForbiddenError>;

	createCustomizationGroup: (
		restaurantId: string,
		itemId: string,
		ownerId: string,
		input: {
			name: string;
			minSelectable?: number;
			maxSelectable?: number;
			isRequired?: boolean;
		},
	) => Effect.Effect<
		CustomizationGroupRow,
		DbError | NotFoundError | ForbiddenError
	>;

	updateCustomizationGroup: (
		restaurantId: string,
		itemId: string,
		groupId: string,
		ownerId: string,
		input: {
			name?: string;
			minSelectable?: number;
			maxSelectable?: number;
			isRequired?: boolean;
		},
	) => Effect.Effect<
		CustomizationGroupRow,
		DbError | NotFoundError | ForbiddenError
	>;

	deleteCustomizationGroup: (
		restaurantId: string,
		itemId: string,
		groupId: string,
		ownerId: string,
	) => Effect.Effect<void, DbError | NotFoundError | ForbiddenError>;

	createCustomizationOption: (
		restaurantId: string,
		itemId: string,
		groupId: string,
		ownerId: string,
		input: { name: string; price?: string; isAvailable?: boolean },
	) => Effect.Effect<
		CustomizationOptionRow,
		DbError | NotFoundError | ForbiddenError
	>;

	updateCustomizationOption: (
		restaurantId: string,
		itemId: string,
		groupId: string,
		optionId: string,
		ownerId: string,
		input: { name?: string; price?: string; isAvailable?: boolean },
	) => Effect.Effect<
		CustomizationOptionRow,
		DbError | NotFoundError | ForbiddenError
	>;

	deleteCustomizationOption: (
		restaurantId: string,
		itemId: string,
		groupId: string,
		optionId: string,
		ownerId: string,
	) => Effect.Effect<void, DbError | NotFoundError | ForbiddenError>;

	listRestaurants: (
		pagination: PaginationParams,
		filters?: {
			city?: string;
			isOpen?: boolean;
		},
	) => Effect.Effect<PaginatedResult<PublicRestaurantRow>, DbError>;

	getRestaurant: (
		restaurantId: string,
	) => Effect.Effect<PublicRestaurantDetailRow, DbError | NotFoundError>;
}

export class RestaurantService extends Context.Service<
	RestaurantService,
	RestaurantServiceShape
>()("chowdeck/RestaurantService") {}
