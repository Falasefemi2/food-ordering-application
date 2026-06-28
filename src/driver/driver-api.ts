import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { AuthMiddleware } from "../auth/auth-middleware";
import {
	BusinessRuleError,
	ConflictError,
	DbError,
	ForbiddenError,
	NotFoundError,
} from "../libs/errors";
import { ImageUploadError } from "../libs/imageservice";

const DriverProfileResponse = Schema.Struct({
	id: Schema.String,
	userId: Schema.String,
	vehicleType: Schema.Literals(["bicycle", "motorbike", "car"]),
	vehiclePlateNumber: Schema.NullOr(Schema.String),
	vehicleColor: Schema.NullOr(Schema.String),
	vehicleModel: Schema.NullOr(Schema.String),
	licenseNumber: Schema.NullOr(Schema.String),
	licenseImageUrl: Schema.NullOr(Schema.String),
	vehicleImageUrl: Schema.NullOr(Schema.String),
	nationalIdImageUrl: Schema.NullOr(Schema.String),
	approvalStatus: Schema.String,
	rejectionReason: Schema.NullOr(Schema.String),
	status: Schema.String,
	currentLatitude: Schema.NullOr(Schema.String),
	currentLongitude: Schema.NullOr(Schema.String),
	lastLocationUpdate: Schema.NullOr(Schema.String),
	ratingAvg: Schema.String,
	ratingCount: Schema.Number,
	totalDeliveries: Schema.Number,
	createdAt: Schema.String,
	updatedAt: Schema.String,
});

const DeliveryRequestResponse = Schema.Struct({
	id: Schema.String,
	orderId: Schema.String,
	driverId: Schema.String,
	status: Schema.Literals(["pending", "accepted", "declined", "expired"]),
	expiresAt: Schema.String,
	respondedAt: Schema.NullOr(Schema.String),
	createdAt: Schema.String,
});

export class DriverApiGroup extends HttpApiGroup.make("driver")
	.add(
		HttpApiEndpoint.post("createDriverProfile", "/drivers/me", {
			payload: Schema.Struct({
				vehicleType: Schema.Literals(["bicycle", "motorbike", "car"]),
				vehiclePlateNumber: Schema.optional(Schema.String),
				vehicleColor: Schema.optional(Schema.String),
				vehicleModel: Schema.optional(Schema.String),
				licenseNumber: Schema.optional(Schema.String),
			}),
			success: DriverProfileResponse,
			error: [ConflictError, ForbiddenError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.get("getMyDriverProfile", "/drivers/me", {
			success: DriverProfileResponse,
			error: [NotFoundError, ForbiddenError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.patch("updateMyDriverProfile", "/drivers/me", {
			payload: Schema.Struct({
				vehiclePlateNumber: Schema.optional(Schema.String),
				vehicleColor: Schema.optional(Schema.String),
				vehicleModel: Schema.optional(Schema.String),
				licenseNumber: Schema.optional(Schema.String),
			}),
			success: DriverProfileResponse,
			error: [NotFoundError, ForbiddenError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("uploadDriverLicenseImage", "/drivers/me/license-image", {
			disableCodecs: true,
			success: DriverProfileResponse,
			error: [NotFoundError, ForbiddenError, ImageUploadError, DbError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("uploadDriverVehicleImage", "/drivers/me/vehicle-image", {
			disableCodecs: true,
			success: DriverProfileResponse,
			error: [NotFoundError, ForbiddenError, ImageUploadError, DbError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post(
			"uploadDriverNationalIdImage",
			"/drivers/me/national-id-image",
			{
				disableCodecs: true,
				success: DriverProfileResponse,
				error: [NotFoundError, ForbiddenError, ImageUploadError, DbError],
			},
		).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.patch("updateDriverStatus", "/drivers/me/status", {
			payload: Schema.Struct({
				status: Schema.Literals(["offline", "online_idle"]),
			}),
			success: DriverProfileResponse,
			error: [NotFoundError, ForbiddenError, BusinessRuleError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("updateDriverLocation", "/drivers/me/location", {
			payload: Schema.Struct({
				latitude: Schema.String,
				longitude: Schema.String,
			}),
			success: Schema.Struct({
				message: Schema.String,
			}),
			error: [NotFoundError, ForbiddenError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.get("getMyPendingRequest", "/drivers/me/request", {
			success: Schema.NullOr(DeliveryRequestResponse),
			error: [ForbiddenError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post(
			"acceptDeliveryRequest",
			"/drivers/requests/:id/accept",
			{
				params: Schema.Struct({ id: Schema.String }),
				success: DeliveryRequestResponse,
				error: [NotFoundError, ForbiddenError, BusinessRuleError],
			},
		).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post(
			"declineDeliveryRequest",
			"/drivers/requests/:id/decline",
			{
				params: Schema.Struct({ id: Schema.String }),
				success: DeliveryRequestResponse,
				error: [NotFoundError, ForbiddenError, BusinessRuleError],
			},
		).middleware(AuthMiddleware),
	) {}
