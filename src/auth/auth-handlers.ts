import * as Effect from "effect/Effect";
import { HttpServerRequest } from "effect/unstable/http/HttpServerRequest";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../api";
import { ImageUploadService, UploadFolder } from "../libs/imageservice";
import { clientKey, RateLimterService } from "../libs/ratelimit";
import { AuthContext } from "./auth-middleware";
import { AuthService } from "./auth-service";

export const AuthHandlers = HttpApiBuilder.group(
	Api,
	"auth",
	Effect.fn(function* (handlers) {
		const auth = yield* AuthService;
		const limiter = yield* RateLimterService;
		const uploader = yield* ImageUploadService;

		return handlers
			.handle("register", ({ payload }) =>
				Effect.gen(function* () {
					const ip = yield* clientKey;
					yield* limiter.check("register", `register:${ip}`);
					return yield* auth
						.register(payload)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)
			.handle("login", ({ payload }) =>
				Effect.gen(function* () {
					const ip = yield* clientKey;
					yield* limiter.check("login", `login:${ip}`);
					yield* limiter.check("login", `login:email:${payload.email}`);
					return yield* auth
						.login(payload)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)
			.handle("refresh", ({ payload }) =>
				Effect.gen(function* () {
					const ip = yield* clientKey;
					yield* limiter.check("refresh", `refresh:${ip}`);
					return yield* auth
						.refresh(payload.refreshToken)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)
			.handle("logout", () =>
				Effect.gen(function* () {
					const { sessionId } = yield* AuthContext;
					yield* auth
						.revokeSession(sessionId)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
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
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			)
			.handle("uploadAvatar", () =>
				Effect.gen(function* () {
					const { sub: id } = yield* AuthContext;
					const request = yield* HttpServerRequest;
					const url = yield* Effect.scoped(
						uploader.uploadFromRequest(
							request,
							UploadFolder.userAvatar,
							`avatar-${id}`,
						),
					);

					return yield* auth
						.updateAvatar(id, url)
						.pipe(Effect.catchTag("DbError", Effect.orDie));
				}),
			);
	}),
);
