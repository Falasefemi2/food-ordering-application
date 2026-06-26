import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { AuthMiddleware } from "../auth/auth-middleware";
import {
	BusinessRuleError,
	ForbiddenError,
	NotFoundError,
} from "../libs/errors";

const AdminRestaurantResponse = Schema.Struct({
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
	commissionRate: Schema.String,
	ratingAvg: Schema.String,
	ratingCount: Schema.Number,
	ownerEmail: Schema.String,
	ownerName: Schema.String,
	createdAt: Schema.String,
	updatedAt: Schema.String,
});

const AdminUserResponse = Schema.Struct({
	id: Schema.String,
	firstName: Schema.String,
	lastName: Schema.String,
	email: Schema.String,
	phoneNumber: Schema.NullOr(Schema.String),
	role: Schema.String,
	isActive: Schema.Boolean,
	walletBalance: Schema.String,
	createdAt: Schema.String,
});

const PendingDriverResponse = Schema.Struct({
	id: Schema.String,
	userId: Schema.String,
	vehicleType: Schema.String,
	licenseNumber: Schema.NullOr(Schema.String),
	approvalStatus: Schema.String,
	createdAt: Schema.String,
	user: Schema.Struct({
		email: Schema.String,
		firstName: Schema.String,
		lastName: Schema.String,
	}),
});

const DeletedResponse = Schema.Struct({ message: Schema.String });

export class AdminApiGroup extends HttpApiGroup.make("admin")
	.middleware(AuthMiddleware)
	.add(
		HttpApiEndpoint.get(
			"listPendingRestaurants",
			"/admin/restaurants/pending",
			{
				success: Schema.Array(AdminRestaurantResponse),
				error: [ForbiddenError],
			},
		),
	)
	.add(
		HttpApiEndpoint.get("listAllRestaurants", "/admin/restaurants", {
			success: Schema.Array(AdminRestaurantResponse),
			error: [ForbiddenError],
		}),
	)
	.add(
		HttpApiEndpoint.get("getRestaurantDetail", "/admin/restaurants/:id", {
			params: Schema.Struct({ id: Schema.String }),
			success: AdminRestaurantResponse,
			error: [NotFoundError, ForbiddenError],
		}),
	)
	.add(
		HttpApiEndpoint.post(
			"approveRestaurant",
			"/admin/restaurants/:id/approve",
			{
				params: Schema.Struct({ id: Schema.String }),
				success: AdminRestaurantResponse,
				error: [NotFoundError, ForbiddenError, BusinessRuleError],
			},
		),
	)
	.add(
		HttpApiEndpoint.post("rejectRestaurant", "/admin/restaurants/:id/reject", {
			params: Schema.Struct({ id: Schema.String }),
			payload: Schema.Struct({
				reason: Schema.String.pipe(Schema.check(Schema.isMinLength(10))),
			}),
			success: AdminRestaurantResponse,
			error: [NotFoundError, ForbiddenError, BusinessRuleError],
		}),
	)
	.add(
		HttpApiEndpoint.post(
			"suspendRestaurant",
			"/admin/restaurants/:id/suspend",
			{
				params: Schema.Struct({ id: Schema.String }),
				payload: Schema.Struct({
					reason: Schema.String.pipe(Schema.check(Schema.isMinLength(10))),
				}),
				success: AdminRestaurantResponse,
				error: [NotFoundError, ForbiddenError],
			},
		),
	)
	.add(
		HttpApiEndpoint.patch(
			"updateCommissionRate",
			"/admin/restaurants/:id/commission",
			{
				params: Schema.Struct({ id: Schema.String }),
				payload: Schema.Struct({
					commissionRate: Schema.String,
				}),
				success: AdminRestaurantResponse,
				error: [NotFoundError, ForbiddenError],
			},
		),
	)
	.add(
		HttpApiEndpoint.get("listUsers", "/admin/users", {
			success: Schema.Array(AdminUserResponse),
			error: [ForbiddenError],
		}),
	)
	.add(
		HttpApiEndpoint.post("deactivateUser", "/admin/users/:id/deactivate", {
			params: Schema.Struct({ id: Schema.String }),
			success: DeletedResponse,
			error: [NotFoundError, ForbiddenError],
		}),
	)
	.add(
		HttpApiEndpoint.post("reactivateUser", "/admin/users/:id/reactivate", {
			params: Schema.Struct({ id: Schema.String }),
			success: DeletedResponse,
			error: [NotFoundError, ForbiddenError],
		}),
	)
	.add(
		HttpApiEndpoint.get("listPendingDrivers", "/admin/drivers/pending", {
			success: Schema.Array(PendingDriverResponse),
			error: [ForbiddenError],
		}),
	)
	.add(
		HttpApiEndpoint.post("approveDriver", "/admin/drivers/:id/approve", {
			params: Schema.Struct({ id: Schema.String }),
			success: DeletedResponse,
			error: [NotFoundError, ForbiddenError, BusinessRuleError],
		}),
	)
	.add(
		HttpApiEndpoint.post("rejectDriver", "/admin/drivers/:id/reject", {
			params: Schema.Struct({ id: Schema.String }),
			payload: Schema.Struct({
				reason: Schema.String.pipe(Schema.check(Schema.isMinLength(10))),
			}),
			success: DeletedResponse,
			error: [NotFoundError, ForbiddenError, BusinessRuleError],
		}),
	)
	.middleware(AuthMiddleware) {}
