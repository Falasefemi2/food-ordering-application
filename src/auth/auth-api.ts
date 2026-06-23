import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
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

const UserProfile = Schema.Struct({
	id: Schema.String,
	email: Schema.String,
	firstName: Schema.String,
	lastName: Schema.String,
	role: Schema.String,
	walletBalance: Schema.String,
	createdAt: Schema.String,
});

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
			success: TokenPair,
			error: [ConflictError],
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
			success: TokenPair,
			error: [UnauthorizedError],
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
