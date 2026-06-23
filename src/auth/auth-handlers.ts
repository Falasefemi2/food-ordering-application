import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../api";
import { AuthService } from "./auth-service";
import { AuthContext } from "./auth-middleware";

export const AuthHandlers = HttpApiBuilder.group(
	Api,
	"auth",
	Effect.fn(function* (handlers) {
		const auth = yield* AuthService;

		return handlers
			.handle("register", ({ payload }) =>
				auth
					.register(payload)
					.pipe(
						Effect.catchTag(
							"DbError",
							Effect.orDie,
						),
					),
			)
			.handle("login", ({ payload }) =>
				auth
					.login(payload)
					.pipe(
						Effect.catchTag(
							"DbError",
							Effect.orDie,
						),
					),
			)
			.handle("refresh", ({ payload }) =>
				auth
					.refresh(payload.refreshToken)
					.pipe(
						Effect.catchTag(
							"DbError",
							Effect.orDie,
						),
					),
			)
			.handle("logout", () =>
				Effect.gen(function* () {
					const { sessionId } =
						yield* AuthContext;
					yield* auth
						.revokeSession(sessionId)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
						);
					return {
						message: "logged out successfully",
					};
				}),
			)
			.handle("me", () =>
				Effect.gen(function* () {
					const { sub: id } = yield* AuthContext;
					return yield* auth
						.getMe(id)
						.pipe(
							Effect.catchTag(
								"DbError",
								Effect.orDie,
							),
							Effect.catchTag(
								"NotFoundError",
								Effect.orDie,
							),
						);
				}),
			);
	}),
);
