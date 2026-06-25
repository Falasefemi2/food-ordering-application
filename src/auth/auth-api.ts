import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { RateLimiter } from "effect/unstable/persistence";
import { HttpApiSchema } from "effect/unstable/httpapi";
import {
	ConflictError,
	InvalidTokenError,
	TokenExpiredError,
	UnauthorizedError,
} from "../libs/errors";
import { AuthMiddleware } from "./auth-middleware";

const TokenPair = Schema.Struct({
	accessToken: Schema.String,
	refreshToken: Schema.String,
});

const AuthSuccess = Schema.Struct({
	accessToken: Schema.String,
	refreshToken: Schema.String,
	userId: Schema.String,
});

const UserProfile = Schema.Struct({
	id: Schema.String,
	email: Schema.String,
	firstName: Schema.String,
	lastName: Schema.String,
	role: Schema.String,
	walletBalance: Schema.String,
	createdAt: Schema.String,
});

const RateLimitError = RateLimiter.RateLimiterError.pipe(
	HttpApiSchema.status(429),
);

export class AuthApiGroup extends HttpApiGroup.make("auth")
	.add(
		HttpApiEndpoint.post("register", "/auth/register", {
			payload: Schema.Struct({
				firstName: Schema.String.pipe(
					Schema.check(Schema.isMinLength(1)),
				),
				lastName: Schema.String.pipe(
					Schema.check(Schema.isMinLength(1)),
				),
				email: Schema.String.pipe(
					Schema.check(
						Schema.isPattern(
							/^\S+@\S+\.\S+$/,
						),
					),
				),
				password: Schema.String.pipe(
					Schema.check(Schema.isMinLength(8)),
				),
				phoneNumber: Schema.optional(
					Schema.String.pipe(
						Schema.check(
							Schema.isPattern(
								/^\+?[0-9]\d{7,14}$/,
							),
						),
					),
				),
				role: Schema.optional(
					Schema.Union([
						Schema.Literal("customer"),
						Schema.Literal("driver"),
						Schema.Literal("vendor"),
					]),
				),
			}),
			success: AuthSuccess,
			error: [ConflictError, RateLimitError],
		}),
	)
	.add(
		HttpApiEndpoint.post("login", "/auth/login", {
			payload: Schema.Struct({
				email: Schema.String.pipe(
					Schema.check(
						Schema.isPattern(
							/^\S+@\S+\.\S+$/,
						),
					),
				),
				password: Schema.String.pipe(
					Schema.check(Schema.isMinLength(1)),
				),
			}),
			success: AuthSuccess,
			error: [UnauthorizedError, RateLimitError],
		}),
	)
	.add(
		HttpApiEndpoint.post("refresh", "/auth/refresh", {
			payload: Schema.Struct({
				refreshToken: Schema.String,
			}),
			success: TokenPair,
			error: [
				InvalidTokenError,
				TokenExpiredError,
				UnauthorizedError,
				RateLimitError,
			],
		}),
	)
	.add(
		HttpApiEndpoint.post("logout", "/auth/logout", {
			success: Schema.Struct({ message: Schema.String }),
			error: [],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.get("me", "/auth/me", {
			success: UserProfile,
			error: [],
		}).middleware(AuthMiddleware),
	) {}
