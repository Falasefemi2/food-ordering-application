import * as PgClient from "@effect/sql-pg/PgClient";
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres";
import * as DrizzleEffect from "drizzle-orm/effect-postgres";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export type PgDatabase = EffectPgDatabase & { $client: PgClient.PgClient };

export const PgDatabase = Context.Service<PgDatabase>("auth/PgDatabase");

const PgClientLive = PgClient.layerConfig({
	url: Config.redacted("DATABASE_URL"),
	ssl: Config.succeed(true),
});

const PgDatabaseLive = Layer.effect(
	PgDatabase,
	DrizzleEffect.makeWithDefaults() as Effect.Effect<
		PgDatabase,
		never,
		PgClient.PgClient
	>,
);

export const DatabaseLive = Layer.provideMerge(PgDatabaseLive, PgClientLive);
