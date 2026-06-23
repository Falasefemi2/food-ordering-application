import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export class EnvConfigError extends Data.TaggedError("EnvConfigError")<{
	message: string;
}> {}

export class EnvConfig extends Schema.Class<EnvConfig>("EnvConfig")({
	DATABASE_URL: Schema.String,
	JWT_ACCESS_SECRET: Schema.String,
	JWT_REFRESH_SECRET: Schema.String,
	JWT_ACCESS_EXPIRES_IN: Schema.String,
	JWT_REFRESH_EXPIRES_IN: Schema.String,
	PORT: Schema.String,
}) {}

export const loadConfig = Schema.decodeUnknownExit(EnvConfig)(process.env).pipe(
	Effect.mapError(
		(error) =>
			new EnvConfigError({
				message: `invalid env variables: ${error.message}`,
			}),
	),
);
