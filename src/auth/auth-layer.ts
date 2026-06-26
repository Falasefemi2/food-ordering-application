import * as crypto from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { jwtVerify, SignJWT } from "jose";
import { PgDatabase } from "../db";
import { sessions, users } from "../db/schema";
import { loadConfig } from "../libs/config";
import {
	ConflictError,
	DbError,
	InvalidTokenError,
	NotFoundError,
	TokenExpiredError,
	UnauthorizedError,
} from "../libs/errors";
import {
	hashPassword,
	hashToken,
	refreshExpiry,
	verifyPassword,
} from "../libs/helpers";
import {
	AuthService,
	type AuthServiceShape,
	type JwtPayload,
	type TokenPair,
} from "./auth-service";

const textEncoder = new TextEncoder();

export const dbQuery = <A>(effect: Effect.Effect<A, EffectDrizzleQueryError>) =>
	effect.pipe(
		Effect.mapError(
			(cause) =>
				new DbError({
					message: "Database error",
					cause,
				}),
		),
	);

export const AuthLive = Layer.effect(
	AuthService,
	Effect.gen(function* () {
		const config = yield* loadConfig;
		const db = yield* PgDatabase;

		const accessSecret = textEncoder.encode(config.JWT_ACCESS_SECRET);
		const refreshSecret = textEncoder.encode(config.JWT_REFRESH_SECRET);

		const signTokens = (
			payload: JwtPayload,
		): Effect.Effect<TokenPair, DbError> =>
			Effect.tryPromise({
				try: async () => {
					const now = Math.floor(Date.now() / 1000);

					const accessToken = await new SignJWT({
						email: payload.email,
						role: payload.role,
						sessionId: payload.sessionId,
					})
						.setProtectedHeader({
							alg: "HS256",
						})
						.setSubject(payload.sub)
						.setIssuedAt(now)
						.setExpirationTime(config.JWT_ACCESS_EXPIRES_IN)
						.sign(accessSecret);

					const refreshToken = await new SignJWT({
						sessionId: payload.sessionId,
					})
						.setProtectedHeader({
							alg: "HS256",
						})
						.setSubject(payload.sub)
						.setIssuedAt(now)
						.setExpirationTime(config.JWT_REFRESH_EXPIRES_IN)
						.sign(refreshSecret);

					return { accessToken, refreshToken };
				},
				catch: (cause) =>
					new DbError({
						message: "Failed to sign tokens",
						cause,
					}),
			});

		const createSession = (
			userId: string,
			meta: {
				userAgent?: string | undefined;
				ipAddress?: string | undefined;
			},
		): Effect.Effect<{ sessionId: string; rawRefreshToken: string }, DbError> =>
			Effect.gen(function* () {
				const rawRefreshToken = crypto.randomBytes(40).toString("hex");
				const tokenHash = hashToken(rawRefreshToken);
				const expiry = refreshExpiry();

				const [session] = yield* db
					.insert(sessions)
					.values({
						userId,
						refreshTokenHash: tokenHash,
						userAgent: meta.userAgent ?? null,
						ipAddress: meta.ipAddress ?? null,
						expiresAt: expiry,
					})
					.returning({ id: sessions.id })
					.pipe(
						Effect.mapError(
							(cause) =>
								new DbError({
									message: "Failed to insert session",
									cause,
								}),
						),
					);

				if (!session) {
					return yield* new DbError({
						message: "Failed to create session",
					});
				}

				return {
					sessionId: session.id,
					rawRefreshToken,
				};
			});

		const register: AuthServiceShape["register"] = (input, meta = {}) =>
			Effect.gen(function* () {
				const [existingEmail] = yield* dbQuery(
					db
						.select({ id: users.id })
						.from(users)
						.where(and(eq(users.email, input.email), isNull(users.deletedAt)))
						.limit(1),
				);

				if (existingEmail) {
					return yield* new ConflictError({
						message: "Email already in use",
					});
				}

				if (input.phoneNumber) {
					const [existingPhone] = yield* dbQuery(
						db
							.select({
								id: users.id,
							})
							.from(users)
							.where(
								and(
									eq(users.phoneNumber, input.phoneNumber),
									isNull(users.deletedAt),
								),
							)
							.limit(1),
					);

					if (existingPhone) {
						return yield* new ConflictError({
							message: "Phone number already in use",
						});
					}
				}

				const passwordHash = yield* hashPassword(input.password);
				const role = input.role ?? "customer";

				const [user] = yield* dbQuery(
					db
						.insert(users)
						.values({
							firstName: input.firstName,
							lastName: input.lastName,
							email: input.email,
							phoneNumber: input.phoneNumber ?? null,
							passwordHash,
							role,
						})
						.returning({
							id: users.id,
							email: users.email,
							role: users.role,
						}),
				);

				if (!user) {
					return yield* new DbError({
						message: "Failed to create user",
					});
				}

				const { sessionId, rawRefreshToken } = yield* createSession(
					user.id,
					meta,
				);
				const { accessToken } = yield* signTokens({
					sub: user.id,
					email: user.email,
					role: user.role,
					sessionId,
				});

				return {
					accessToken,
					refreshToken: rawRefreshToken,
					userId: user.id,
				};
			});

		const login: AuthServiceShape["login"] = (input, meta = {}) =>
			Effect.gen(function* () {
				const [user] = yield* dbQuery(
					db
						.select({
							id: users.id,
							email: users.email,
							role: users.role,
							passwordHash: users.passwordHash,
							isActive: users.isActive,
						})
						.from(users)
						.where(and(eq(users.email, input.email), isNull(users.deletedAt)))
						.limit(1),
				);

				if (!user || !user.isActive) {
					return yield* new UnauthorizedError({
						message: "Invalid email or password",
					});
				}

				if (!user.passwordHash) {
					return yield* new UnauthorizedError({
						message: "Password login not available for this account",
					});
				}

				const valid = yield* verifyPassword(input.password, user.passwordHash);
				if (!valid) {
					return yield* new UnauthorizedError({
						message: "Invalid email or password",
					});
				}

				const { sessionId, rawRefreshToken } = yield* createSession(
					user.id,
					meta,
				);
				const { accessToken } = yield* signTokens({
					sub: user.id,
					email: user.email,
					role: user.role,
					sessionId,
				});

				return {
					accessToken,
					refreshToken: rawRefreshToken,
					userId: user.id,
				};
			});

		const refresh: AuthServiceShape["refresh"] = (rawRefreshToken, meta = {}) =>
			Effect.gen(function* () {
				const verified = yield* Effect.tryPromise({
					try: () =>
						jwtVerify(rawRefreshToken, refreshSecret, {
							algorithms: ["HS256"],
						}),
					catch: (cause) => {
						const msg = cause instanceof Error ? cause.message : String(cause);
						if (msg.includes("expired")) {
							return new TokenExpiredError({
								message: "Refresh token expired",
							});
						}
						return new InvalidTokenError({
							message: "Invalid refresh token",
						});
					},
				});

				const sessionId = verified.payload["sessionId"] as string | undefined;
				const userId = verified.payload.sub;

				if (!sessionId || !userId) {
					return yield* new InvalidTokenError({
						message: "Malformed token payload",
					});
				}

				const tokenHash = hashToken(rawRefreshToken);

				const [session] = yield* dbQuery(
					db
						.select({
							id: sessions.id,
							userId: sessions.userId,
							revokedAt: sessions.revokedAt,
							expiresAt: sessions.expiresAt,
						})
						.from(sessions)
						.where(
							and(
								eq(sessions.id, sessionId),
								eq(sessions.refreshTokenHash, tokenHash),
							),
						)
						.limit(1),
				);

				if (!session) {
					return yield* new InvalidTokenError({
						message: "Session not found",
					});
				}

				if (session.revokedAt) {
					yield* dbQuery(
						db
							.update(sessions)
							.set({
								revokedAt: new Date(),
							})
							.where(
								and(
									eq(sessions.userId, session.userId),
									isNull(sessions.revokedAt),
								),
							),
					);
					return yield* new UnauthorizedError({
						message: "Session has been revoked",
					});
				}

				if (session.expiresAt < new Date()) {
					return yield* new TokenExpiredError({
						message: "Session expired",
					});
				}

				const [user] = yield* dbQuery(
					db
						.select({
							id: users.id,
							email: users.email,
							role: users.role,
							isActive: users.isActive,
						})
						.from(users)
						.where(and(eq(users.id, session.userId), isNull(users.deletedAt)))
						.limit(1),
				);

				if (!user || !user.isActive) {
					return yield* new UnauthorizedError({
						message: "User not found or deactivated",
					});
				}

				const newRawToken = crypto.randomBytes(40).toString("hex");
				const newTokenHash = hashToken(newRawToken);
				const expiry = refreshExpiry();

				yield* dbQuery(
					db
						.update(sessions)
						.set({ revokedAt: new Date() })
						.where(eq(sessions.id, sessionId)),
				);

				const [newSession] = yield* dbQuery(
					db
						.insert(sessions)
						.values({
							userId: user.id,
							refreshTokenHash: newTokenHash,
							userAgent: meta.userAgent ?? null,
							ipAddress: meta.ipAddress ?? null,
							expiresAt: expiry,
						})
						.returning({ id: sessions.id }),
				);

				if (!newSession) {
					return yield* new DbError({
						message: "Failed to rotate session",
					});
				}

				const tokens = yield* signTokens({
					sub: user.id,
					email: user.email,
					role: user.role,
					sessionId: newSession.id,
				});

				return { ...tokens, refreshToken: newRawToken };
			});

		const verifyAccessToken: AuthServiceShape["verifyAccessToken"] = (token) =>
			Effect.tryPromise({
				try: async () => {
					const { payload } = await jwtVerify(token, accessSecret, {
						algorithms: ["HS256"],
					});
					return {
						sub: payload.sub as string,
						email: payload["email"] as string,
						role: payload["role"] as string,
						sessionId: payload["sessionId"] as string,
					};
				},
				catch: (cause) => {
					const msg = cause instanceof Error ? cause.message : String(cause);
					if (msg.includes("expired")) {
						return new TokenExpiredError({
							message: "Access token expired",
						});
					}
					return new InvalidTokenError({
						message: "Invalid access token",
					});
				},
			});

		const revokeSession: AuthServiceShape["revokeSession"] = (sessionId) =>
			dbQuery(
				db
					.update(sessions)
					.set({ revokedAt: new Date() })
					.where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt))),
			);

		const revokeAllUserSessions: AuthServiceShape["revokeAllUserSessions"] = (
			userId,
		) =>
			dbQuery(
				db
					.update(sessions)
					.set({
						revokedAt: new Date(),
					})
					.where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt))),
			);

		const getMe: AuthServiceShape["getMe"] = (id) =>
			Effect.gen(function* () {
				const [user] = yield* dbQuery(
					db
						.select({
							id: users.id,
							email: users.email,
							firstName: users.firstName,
							lastName: users.lastName,
							role: users.role,
							walletBalance: users.walletBalance,
							createdAt: users.createdAt,
						})
						.from(users)
						.where(and(eq(users.id, id), isNull(users.deletedAt)))
						.limit(1),
				);
				if (!user)
					return yield* new NotFoundError({
						resource: "User",
						id,
					});
				return {
					...user,
					walletBalance: user.walletBalance.toString(),
					createdAt: user.createdAt.toISOString(),
				};
			});

		return {
			register,
			login,
			refresh,
			verifyAccessToken,
			revokeSession,
			revokeAllUserSessions,
			getMe,
		};
	}),
);
