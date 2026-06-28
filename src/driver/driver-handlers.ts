import { Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http/HttpServerRequest";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../api";
import { AuthContext } from "../auth/auth-middleware";
import { DispatchService } from "../dispatch/dispatch-service";
import { ForbiddenError } from "../libs/errors";
import { ImageUploadService, UploadFolder } from "../libs/imageservice";
import { DriverService } from "./driver-service";

export const DriverHandlers = HttpApiBuilder.group(
	Api,
	"driver",
	Effect.fn(function* (handlers) {
		const driverService = yield* DriverService;
		const dispatchService = yield* DispatchService;
		const uploader = yield* ImageUploadService;

		const driverOnly = (role: string) =>
			role === "driver"
				? Effect.void
				: Effect.fail(
						new ForbiddenError({
							message: "Drivers only",
						}),
					);

		const uploadDriverImage = (
			field: "licenseImageUrl" | "vehicleImageUrl" | "nationalIdImageUrl",
			folder: UploadFolder,
			publicIdPrefix: string,
		) =>
			Effect.gen(function* () {
				const { sub: userId, role } = yield* AuthContext;
				yield* driverOnly(role);
				const request = yield* HttpServerRequest;
				const url = yield* Effect.scoped(
					uploader.uploadFromRequest(request, folder, `${publicIdPrefix}-${userId}`),
				);

				return yield* driverService
					.updateDocumentUrl(userId, field, url)
					.pipe(Effect.catchTag("DbError", Effect.orDie));
			});

		return handlers
			.handle("createDriverProfile", ({ payload }) =>
				Effect.gen(function* () {
					const { sub: userId, role } = yield* AuthContext;
					yield* driverOnly(role);
					return yield* driverService
						.createProfile(userId, payload)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("getMyDriverProfile", () =>
				Effect.gen(function* () {
					const { sub: userId, role } = yield* AuthContext;
					yield* driverOnly(role);
					return yield* driverService
						.getMyProfile(userId)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("updateMyDriverProfile", ({ payload }) =>
				Effect.gen(function* () {
					const { sub: userId, role } = yield* AuthContext;
					yield* driverOnly(role);
					return yield* driverService
						.updateMyProfile(userId, payload)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("uploadDriverLicenseImage", () =>
				uploadDriverImage(
					"licenseImageUrl",
					UploadFolder.driverLicense,
					"license",
				),
			)

			.handle("uploadDriverVehicleImage", () =>
				uploadDriverImage("vehicleImageUrl", UploadFolder.driverVehicle, "vehicle"),
			)

			.handle("uploadDriverNationalIdImage", () =>
				uploadDriverImage(
					"nationalIdImageUrl",
					UploadFolder.driverNationalId,
					"national-id",
				),
			)

			.handle("updateDriverStatus", ({ payload }) =>
				Effect.gen(function* () {
					const { sub: userId, role } = yield* AuthContext;
					yield* driverOnly(role);
					return yield* driverService
						.updateStatus(userId, payload.status)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("updateDriverLocation", ({ payload }) =>
				Effect.gen(function* () {
					const { sub: userId, role } = yield* AuthContext;
					yield* driverOnly(role);
					yield* driverService
						.updateLocation(userId, payload.latitude, payload.longitude)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
					return {
						message: "Location updated",
					};
				}),
			)

			.handle("getMyPendingRequest", () =>
				Effect.gen(function* () {
					const { sub: userId, role } = yield* AuthContext;
					yield* driverOnly(role);
					const profile = yield* driverService.getMyProfile(userId).pipe(
						Effect.catchTag("DbError", Effect.orDie),
						Effect.catchTag("NotFoundError", () => Effect.succeed(null)),
					);

					if (!profile) return null;

					return yield* dispatchService
						.getMyPendingRequest(profile.id)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("acceptDeliveryRequest", ({ params }) =>
				Effect.gen(function* () {
					const { sub: userId, role } = yield* AuthContext;
					yield* driverOnly(role);

					const profile = yield* driverService
						.getMyProfile(userId)
						.pipe(Effect.catchTag("DbError", Effect.orDie));

					return yield* dispatchService
						.acceptDeliveryRequest(params.id, profile.id)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)

			.handle("declineDeliveryRequest", ({ params }) =>
				Effect.gen(function* () {
					const { sub: userId, role } = yield* AuthContext;
					yield* driverOnly(role);

					const profile = yield* driverService
						.getMyProfile(userId)
						.pipe(Effect.catchTag("DbError", Effect.orDie));

					return yield* dispatchService
						.declineDeliveryRequest(params.id, profile.id)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			);
	}),
);
