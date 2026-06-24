import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import type { DbError, NotFoundError, BusinessRuleError } from "../libs/errors";
import type { RestaurantRow } from "../restaurant/restaurant-service";

export type ApprovalAction = "approved" | "rejected" | "suspended";

export interface AdminRestaurantRow extends RestaurantRow {
	commissionRate: string;
	ownerEmail: string;
	ownerName: string;
}

export interface AdminUserRow {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	phoneNumber: string | null;
	role: string;
	isActive: boolean;
	walletBalance: string;
	createdAt: string;
}

export interface AdminServiceShape {
	listPendingRestaurants: () => Effect.Effect<
		AdminRestaurantRow[],
		DbError
	>;

	listAllRestaurants: (filters?: {
		approvalStatus?: string;
		city?: string;
	}) => Effect.Effect<AdminRestaurantRow[], DbError>;

	getRestaurantDetail: (
		restaurantId: string,
	) => Effect.Effect<AdminRestaurantRow, DbError | NotFoundError>;

	approveRestaurant: (
		restaurantId: string,
		adminId: string,
	) => Effect.Effect<
		AdminRestaurantRow,
		DbError | NotFoundError | BusinessRuleError
	>;

	rejectRestaurant: (
		restaurantId: string,
		adminId: string,
		reason: string,
	) => Effect.Effect<
		AdminRestaurantRow,
		DbError | NotFoundError | BusinessRuleError
	>;

	suspendRestaurant: (
		restaurantId: string,
		adminId: string,
		reason: string,
	) => Effect.Effect<AdminRestaurantRow, DbError | NotFoundError>;

	updateCommissionRate: (
		restaurantId: string,
		commissionRate: string,
	) => Effect.Effect<AdminRestaurantRow, DbError | NotFoundError>;

	listUsers: (filters?: {
		role?: string;
		isActive?: boolean;
	}) => Effect.Effect<AdminUserRow[], DbError>;

	deactivateUser: (
		userId: string,
	) => Effect.Effect<void, DbError | NotFoundError>;
	reactivateUser: (
		userId: string,
	) => Effect.Effect<void, DbError | NotFoundError>;

	listPendingDrivers: () => Effect.Effect<
		{
			id: string;
			userId: string;
			vehicleType: string;
			licenseNumber: string | null;
			approvalStatus: string;
			createdAt: string;
			user: {
				email: string;
				firstName: string;
				lastName: string;
			};
		}[],
		DbError
	>;

	approveDriver: (
		driverId: string,
		adminId: string,
	) => Effect.Effect<void, DbError | NotFoundError | BusinessRuleError>;

	rejectDriver: (
		driverId: string,
		adminId: string,
		reason: string,
	) => Effect.Effect<void, DbError | NotFoundError | BusinessRuleError>;
}

export class AdminService extends Context.Service<
	AdminService,
	AdminServiceShape
>()("chowdeck-assignment/admin/admin-service/AdminService") {}
