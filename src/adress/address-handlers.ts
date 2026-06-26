import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../api";
import { AuthContext } from "../auth/auth-middleware";
import { AddressService } from "./adress-service";

export const AddressHandlers = HttpApiBuilder.group(
	Api,
	"address",
	Effect.fn(function* (handlers) {
		const addressService = yield* AddressService;

		return handlers
			.handle("listAddresses", () =>
				Effect.gen(function* () {
					const { sub: userId } =
						yield* AuthContext;
					return yield* addressService
						.listAddresses(userId)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
				}),
			)

			.handle("getAddress", ({ params }) =>
				Effect.gen(function* () {
					const { sub: userId } =
						yield* AuthContext;
					return yield* addressService
						.getAddress(params.id, userId)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
				}),
			)

			.handle("createAddress", ({ payload }) =>
				Effect.gen(function* () {
					const { sub: userId } =
						yield* AuthContext;
					return yield* addressService
						.createAddress(userId, payload)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
				}),
			)

			.handle("updateAddress", ({ params, payload }) =>
				Effect.gen(function* () {
					const { sub: userId } =
						yield* AuthContext;
					return yield* addressService
						.updateAddress(
							params.id,
							userId,
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

			.handle("deleteAddress", ({ params }) =>
				Effect.gen(function* () {
					const { sub: userId } =
						yield* AuthContext;
					yield* addressService
						.deleteAddress(
							params.id,
							userId,
						)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
					return { message: "Address deleted" };
				}),
			)

			.handle("setDefaultAddress", ({ params }) =>
				Effect.gen(function* () {
					const { sub: userId } =
						yield* AuthContext;
					return yield* addressService
						.setDefaultAddress(
							params.id,
							userId,
						)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
				}),
			);
	}),
);
