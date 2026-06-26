import { eq } from "drizzle-orm";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { PgDatabase } from "../db";
import { drivers } from "../db/schema";
import {
	BusinessRuleError,
	ConflictError,
	DbError,
	NotFoundError,
} from "../libs/errors";
import {
	type DriverProfileRow,
	DriverService,
	type DriverServiceShape,
} from "./driver-service";

const dbQuery = <A>(effect: Effect.Effect<A, EffectDrizzleQueryError>) =>
	effect.pipe(
		Effect.mapError(
			(cause) =>
				new DbError({
					message: "Database error",
					cause,
				}),
		),
	);

const toDriverRow = (r: typeof drivers.$inferSelect): DriverProfileRow => ({
	id: r.id,
	userId: r.userId,
	vehicleType: r.vehicleType,
	vehiclePlateNumber: r.vehiclePlateNumber,
	vehicleColor: r.vehicleColor,
	vehicleModel: r.vehicleModel,
	licenseNumber: r.licenseNumber,
	licenseImageUrl: r.licenseImageUrl,
	vehicleImageUrl: r.vehicleImageUrl,
	nationalIdImageUrl: r.nationalIdImageUrl,
	approvalStatus: r.approvalStatus,
	rejectionReason: r.rejectionReason,
	status: r.status,
	currentLatitude: r.currentLatitude,
	currentLongitude: r.currentLongitude,
	lastLocationUpdate: r.lastLocationUpdate?.toISOString() ?? null,
	ratingAvg: r.ratingAvg,
	ratingCount: r.ratingCount,
	totalDeliveries: r.totalDeliveries,
	createdAt: r.createdAt.toISOString(),
	updatedAt: r.updatedAt.toISOString(),
});

export const DriverLive = Layer.effect(
	DriverService,
	Effect.gen(function* () {
		const db = yield* PgDatabase;

		const getDriver = (userId: string) =>
			Effect.gen(function* () {
				const [row] = yield* dbQuery(
					db.select().from(drivers).where(eq(drivers.userId, userId)).limit(1),
				);
				if (!row)
					return yield* new NotFoundError({
						resource: "DriverProfile",
					});
				return row;
			});

		const createProfile: DriverServiceShape["createProfile"] = (
			userId,
			input,
		) =>
			Effect.gen(function* () {
				const [existing] = yield* dbQuery(
					db
						.select({ id: drivers.id })
						.from(drivers)
						.where(eq(drivers.userId, userId))
						.limit(1),
				);
				if (existing) {
					return yield* new ConflictError({
						message: "Driver profile already exists",
					});
				}

				const [row] = yield* dbQuery(
					db
						.insert(drivers)
						.values({
							userId,
							vehicleType: input.vehicleType,
							vehiclePlateNumber: input.vehiclePlateNumber ?? null,
							vehicleColor: input.vehicleColor ?? null,
							vehicleModel: input.vehicleModel ?? null,
							licenseNumber: input.licenseNumber ?? null,
						})
						.returning(),
				);

				if (!row)
					return yield* new DbError({
						message: "Failed to create driver profile",
					});
				return toDriverRow(row);
			});

		const getMyProfile: DriverServiceShape["getMyProfile"] = (userId) =>
			Effect.gen(function* () {
				const row = yield* getDriver(userId);
				return toDriverRow(row);
			});

		const updateMyProfile: DriverServiceShape["updateMyProfile"] = (
			userId,
			input,
		) =>
			Effect.gen(function* () {
				yield* getDriver(userId);
				const [updated] = yield* dbQuery(
					db
						.update(drivers)
						.set({
							...input,
							updatedAt: new Date(),
						})
						.where(eq(drivers.userId, userId))
						.returning(),
				);
				if (!updated)
					return yield* new NotFoundError({
						resource: "DriverProfile",
					});
				return toDriverRow(updated);
			});

		const updateStatus: DriverServiceShape["updateStatus"] = (userId, status) =>
			Effect.gen(function* () {
				const row = yield* getDriver(userId);

				if (row.approvalStatus !== "approved" && status !== "offline") {
					return yield* new BusinessRuleError({
						message: "Driver must be approved before going online",
					});
				}

				const [updated] = yield* dbQuery(
					db
						.update(drivers)
						.set({
							status,
							updatedAt: new Date(),
						})
						.where(eq(drivers.userId, userId))
						.returning(),
				);
				if (!updated)
					return yield* new NotFoundError({
						resource: "DriverProfile",
					});
				return toDriverRow(updated);
			});

		const updateLocation: DriverServiceShape["updateLocation"] = (
			userId,
			latitude,
			longitude,
		) =>
			Effect.gen(function* () {
				yield* dbQuery(
					db
						.update(drivers)
						.set({
							currentLatitude: latitude,
							currentLongitude: longitude,
							lastLocationUpdate: new Date(),
							updatedAt: new Date(),
						})
						.where(eq(drivers.userId, userId)),
				);
			});

		const updateDocumentUrl: DriverServiceShape["updateDocumentUrl"] = (
			userId,
			field,
			url,
		) =>
			Effect.gen(function* () {
				yield* getDriver(userId);
				const [updated] = yield* dbQuery(
					db
						.update(drivers)
						.set({
							[field]: url,
							updatedAt: new Date(),
						})
						.where(eq(drivers.userId, userId))
						.returning(),
				);
				if (!updated)
					return yield* new NotFoundError({
						resource: "DriverProfile",
					});
				return toDriverRow(updated);
			});

		return {
			createProfile,
			getMyProfile,
			updateMyProfile,
			updateStatus,
			updateLocation,
			updateDocumentUrl,
		};
	}),
);
