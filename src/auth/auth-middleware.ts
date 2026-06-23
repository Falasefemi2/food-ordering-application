import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import {
	HttpServerRequest,
	type HttpServerRequest as HttpServerRequestType,
} from "effect/unstable/http/HttpServerRequest";
import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";
import type { HttpServerResponse } from "effect/unstable/http/HttpServerResponse";
import type { unhandled } from "effect/Types";
import { AuthService, type JwtPayload } from "./auth-service";
import {
	ForbiddenError,
	InvalidTokenError,
	TokenExpiredError,
} from "../libs/errors";

export const BearerSecurity = HttpApiSecurity.bearer;

export class AuthContext extends Context.Service<AuthContext, JwtPayload>()(
	"chowdeck/AuthContext",
) {}

export const requireAuth = <A, E, R>(
	next: Effect.Effect<A, E, R>,
): Effect.Effect<
	A,
	E | InvalidTokenError | TokenExpiredError,
	Exclude<R, AuthContext> | AuthService | HttpServerRequestType
> =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest;
		const auth = yield* AuthService;
		const authHeader = request.headers["authorization"];

		if (!authHeader?.startsWith("Bearer ")) {
			return yield* new InvalidTokenError({
				message: "Missing or malformed Authorization header",
			});
		}

		const payload = yield* auth.verifyAccessToken(
			authHeader.slice(7),
		);
		return yield* Effect.provideService(next, AuthContext, payload);
	});

export const requireRole =
	(roles: ReadonlyArray<string>) =>
	<A, E, R>(
		next: Effect.Effect<A, E, R>,
	): Effect.Effect<A, E | ForbiddenError, R | AuthContext> =>
		Effect.gen(function* () {
			const { role } = yield* AuthContext;

			if (!roles.includes(role)) {
				return yield* new ForbiddenError({
					message: `Role '${role}' is not permitted. Required: ${roles.join(", ")}`,
				});
			}

			return yield* next;
		});

export class AuthMiddleware extends HttpApiMiddleware.Service<
	AuthMiddleware,
	{ provides: AuthContext; requires: AuthService }
>()("chowdeck/AuthMiddleware", {
	error: [InvalidTokenError, TokenExpiredError],
	security: { bearer: BearerSecurity },
}) {}

export const AuthMiddlewareLayer = Layer.effect(
	AuthMiddleware,
	Effect.gen(function* () {
		const auth = yield* AuthService;

		return {
			bearer: (
				httpEffect: Effect.Effect<
					HttpServerResponse,
					unhandled,
					AuthContext
				>,
				{
					credential,
				}: { credential: Redacted.Redacted<string> },
			) =>
				Effect.gen(function* () {
					const payload =
						yield* auth.verifyAccessToken(
							Redacted.value(
								credential,
							),
						);
					return yield* Effect.provideService(
						httpEffect,
						AuthContext,
						payload,
					);
				}),
		};
	}),
);

export const Roles = {
	Customer: ["customer"] as const,
	Vendor: ["vendor"] as const,
	Driver: ["driver"] as const,
	Admin: ["admin"] as const,
	Support: ["admin", "support"] as const,
	Any: ["customer", "driver", "vendor", "admin", "support"] as const,
} as const;
