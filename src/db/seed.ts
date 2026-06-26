import { BunRuntime } from "@effect/platform-bun";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { DatabaseLive, PgDatabase } from "./index";
import { users } from "./schema";

const seed = Effect.gen(function* () {
	const db = yield* PgDatabase;

	const passwordHash = yield* Effect.promise(() =>
		Bun.password.hash("admin123", { algorithm: "argon2id" }),
	);

	const [existing] = yield* db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, "admin@chowdeck.com"))
		.limit(1);

	if (existing) {
		console.log("Admin already exists — skipping");
		return;
	}

	yield* db.insert(users).values({
		firstName: "Super",
		lastName: "Admin",
		email: "admin@chowdeck.com",
		passwordHash,
		role: "admin",
	});

	console.log("Admin seeded successfully");
	console.log("   Email:    admin@chowdeck.com");
	console.log("   Password: admin123");
	console.log("   !  Change this password before deploying to production");
});

BunRuntime.runMain(seed.pipe(Effect.provide(DatabaseLive)));
