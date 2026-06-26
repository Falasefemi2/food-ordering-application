import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
	ConflictError,
	DbError,
	InvalidTokenError,
	NotFoundError,
	TokenExpiredError,
	UnauthorizedError,
} from "../libs/errors";

export interface RegisterInput {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
	phoneNumber?: string | undefined;
	role?: "customer" | "driver" | "vendor" | "admin" | undefined;
}

export interface LoginInput {
	email: string;
	password: string;
}

export interface TokenPair {
	accessToken: string;
	refreshToken: string;
}

export interface JwtPayload {
	sub: string;
	email: string;
	role: string;
	sessionId: string;
}

export interface AuthServiceShape {
	register: (
		input: RegisterInput,
		meta?: { userAgent?: string; ipAddress?: string },
	) => Effect.Effect<TokenPair & { userId: string }, DbError | ConflictError>;

	login: (
		input: LoginInput,
		meta?: { userAgent?: string; ipAddress?: string },
	) => Effect.Effect<
		TokenPair & { userId: string },
		DbError | UnauthorizedError
	>;

	refresh: (
		rawRefreshToken: string,
		meta?: { userAgent?: string; ipAddress?: string },
	) => Effect.Effect<
		TokenPair,
		DbError | InvalidTokenError | TokenExpiredError | UnauthorizedError
	>;

	verifyAccessToken: (
		token: string,
	) => Effect.Effect<JwtPayload, InvalidTokenError | TokenExpiredError>;

	revokeSession: (sessionId: string) => Effect.Effect<void, DbError>;

	revokeAllUserSessions: (userId: string) => Effect.Effect<void, DbError>;

	getMe: (id: string) => Effect.Effect<
		{
			id: string;
			email: string;
			firstName: string;
			lastName: string;
			role: string;
			walletBalance: string;
			createdAt: string;
		},
		DbError | NotFoundError
	>;
}

export class AuthService extends Context.Service<
	AuthService,
	AuthServiceShape
>()("chowdeck-assignment/auth/auth-service/AuthService") {}
