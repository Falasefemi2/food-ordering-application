import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../api";
import { AuthContext } from "../auth/auth-middleware";
import { DispatchService } from "../dispatch/dispatch-service";
import { ForbiddenError } from "../libs/errors";
import { DriverService } from "./driver-service";

export const DriverHandlers = HttpApiBuilder.group(
	Api,
	"driver",
	Effect.fn(function* (handlers) {
		const driverService = yield* DriverService;
		const dispatchService = yield* DispatchService;

		const driverOnly = (role: string) =>
			role === "driver"
				? Effect.void
				: Effect.fail(
						new ForbiddenError({
							message: "Drivers only",
						}),
					);

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
