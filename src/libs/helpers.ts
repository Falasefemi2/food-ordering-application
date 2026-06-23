import * as Effect from "effect/Effect";
import * as crypto from "crypto";
import { DbError } from "../libs/errors";

export const verifyPassword = (
	password: string,
	hash: string,
): Effect.Effect<boolean, DbError> =>
	Effect.tryPromise({
		try: () => Bun.password.verify(password, hash),
		catch: (cause) =>
			new DbError({
				message: "failed to verify password",
				cause,
			}),
	});

export const hashToken = (token: string): string =>
	crypto.createHash("sha256").update(token).digest("hex");

export const refreshExpiry = (): Date => {
	const d = new Date();
	d.setDate(d.getDate() + 30);
	return d;
};

export const hashPassword = (
	password: string,
): Effect.Effect<string, DbError> =>
	Effect.tryPromise({
		try: () =>
			Bun.password.hash(password, { algorithm: "argon2id" }),
		catch: (cause) =>
			new DbError({
				message: "Failed to hash password",
				cause,
			}),
	});
