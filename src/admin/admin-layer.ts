import { and, eq, isNull } from "drizzle-orm";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { PgDatabase } from "../db";
import { drivers, restaurants, users } from "../db/schema";
import { BusinessRuleError, DbError, NotFoundError } from "../libs/errors";
import {
	type AdminRestaurantRow,
	AdminService,
	type AdminServiceShape,
	type AdminUserRow,
} from "./admin-service";

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

export const AdminLive = Layer.effect(
	AdminService,
	Effect.gen(function* () {
		const db = yield* PgDatabase;

		const getAdminRestaurantRow = (restaurantId: string) =>
			Effect.gen(function* () {
				const [row] = yield* dbQuery(
					db
						.select({
							id: restaurants.id,
							ownerId: restaurants.ownerId,
							name: restaurants.name,
							description: restaurants.description,
							logoUrl: restaurants.logoUrl,
							bannerUrl: restaurants.bannerUrl,
							phoneNumber: restaurants.phoneNumber,
							email: restaurants.email,
							addressLine: restaurants.addressLine,
							city: restaurants.city,
							state: restaurants.state,
							country: restaurants.country,
							approvalStatus: restaurants.approvalStatus,
							rejectionReason: restaurants.rejectionReason,
							latitude: restaurants.latitude,
							longitude: restaurants.longitude,
							isOpen: restaurants.isOpen,
							openingTime: restaurants.openingTime,
							closingTime: restaurants.closingTime,
							estimatedPrepTime: restaurants.estimatedPrepTime,
							commissionRate: restaurants.commissionRate,
							ratingAvg: restaurants.ratingAvg,
							ratingCount: restaurants.ratingCount,
							createdAt: restaurants.createdAt,
							updatedAt: restaurants.updatedAt,
							ownerEmail: users.email,
							ownerFirstName: users.firstName,
							ownerLastName: users.lastName,
						})
						.from(restaurants)
						.innerJoin(users, eq(restaurants.ownerId, users.id))
						.where(
							and(
								eq(restaurants.id, restaurantId),
								isNull(restaurants.deletedAt),
							),
						)
						.limit(1),
				);
				if (!row)
					return yield* new NotFoundError({
						resource: "Restaurant",
						id: restaurantId,
					});

				return {
					...row,
					ownerName: `${row.ownerFirstName} ${row.ownerLastName}`,
					createdAt: row.createdAt.toISOString(),
					updatedAt: row.updatedAt.toISOString(),
				} as AdminRestaurantRow;
			});

		const listPendingRestaurants: AdminServiceShape["listPendingRestaurants"] =
			() =>
				Effect.gen(function* () {
					const rows = yield* dbQuery(
						db
							.select({
								id: restaurants.id,
								ownerId: restaurants.ownerId,
								name: restaurants.name,
								description: restaurants.description,
								logoUrl: restaurants.logoUrl,
								bannerUrl: restaurants.bannerUrl,
								phoneNumber: restaurants.phoneNumber,
								email: restaurants.email,
								addressLine: restaurants.addressLine,
								city: restaurants.city,
								state: restaurants.state,
								country: restaurants.country,
								approvalStatus: restaurants.approvalStatus,
								rejectionReason: restaurants.rejectionReason,
								latitude: restaurants.latitude,
								longitude: restaurants.longitude,
								isOpen: restaurants.isOpen,
								openingTime: restaurants.openingTime,
								closingTime: restaurants.closingTime,
								estimatedPrepTime: restaurants.estimatedPrepTime,
								commissionRate: restaurants.commissionRate,
								ratingAvg: restaurants.ratingAvg,
								ratingCount: restaurants.ratingCount,
								createdAt: restaurants.createdAt,
								updatedAt: restaurants.updatedAt,
								ownerEmail: users.email,
								ownerFirstName: users.firstName,
								ownerLastName: users.lastName,
							})
							.from(restaurants)
							.innerJoin(users, eq(restaurants.ownerId, users.id))
							.where(
								and(
									eq(restaurants.approvalStatus, "pending"),
									isNull(restaurants.deletedAt),
								),
							),
					);
					return rows.map((r) => ({
						...r,
						ownerName: `${r.ownerFirstName} ${r.ownerLastName}`,
						createdAt: r.createdAt.toISOString(),
						updatedAt: r.updatedAt.toISOString(),
					})) as AdminRestaurantRow[];
				});

		const listAllRestaurants: AdminServiceShape["listAllRestaurants"] = (
			filters,
		) =>
			Effect.gen(function* () {
				const rows = yield* dbQuery(
					db
						.select({
							id: restaurants.id,
							ownerId: restaurants.ownerId,
							name: restaurants.name,
							description: restaurants.description,
							logoUrl: restaurants.logoUrl,
							bannerUrl: restaurants.bannerUrl,
							phoneNumber: restaurants.phoneNumber,
							email: restaurants.email,
							addressLine: restaurants.addressLine,
							city: restaurants.city,
							state: restaurants.state,
							country: restaurants.country,
							approvalStatus: restaurants.approvalStatus,
							rejectionReason: restaurants.rejectionReason,
							latitude: restaurants.latitude,
							longitude: restaurants.longitude,
							isOpen: restaurants.isOpen,
							openingTime: restaurants.openingTime,
							closingTime: restaurants.closingTime,
							estimatedPrepTime: restaurants.estimatedPrepTime,
							commissionRate: restaurants.commissionRate,
							ratingAvg: restaurants.ratingAvg,
							ratingCount: restaurants.ratingCount,
							createdAt: restaurants.createdAt,
							updatedAt: restaurants.updatedAt,
							ownerEmail: users.email,
							ownerFirstName: users.firstName,
							ownerLastName: users.lastName,
						})
						.from(restaurants)
						.innerJoin(users, eq(restaurants.ownerId, users.id))
						.where(
							and(
								isNull(restaurants.deletedAt),
								filters?.approvalStatus
									? eq(
											restaurants.approvalStatus,
											filters.approvalStatus as any,
										)
									: undefined,
								filters?.city ? eq(restaurants.city, filters.city) : undefined,
							),
						),
				);
				return rows.map((r) => ({
					...r,
					ownerName: `${r.ownerFirstName} ${r.ownerLastName}`,
					createdAt: r.createdAt.toISOString(),
					updatedAt: r.updatedAt.toISOString(),
				})) as AdminRestaurantRow[];
			});

		const getRestaurantDetail: AdminServiceShape["getRestaurantDetail"] = (
			restaurantId,
		) => getAdminRestaurantRow(restaurantId);

		const approveRestaurant: AdminServiceShape["approveRestaurant"] = (
			restaurantId,
			_adminId,
		) =>
			Effect.gen(function* () {
				const current = yield* getAdminRestaurantRow(restaurantId);
				if (current.approvalStatus === "approved") {
					return yield* new BusinessRuleError({
						message: "Restaurant is already approved",
					});
				}
				yield* dbQuery(
					db
						.update(restaurants)
						.set({
							approvalStatus: "approved",
							rejectionReason: null,
							updatedAt: new Date(),
						})
						.where(eq(restaurants.id, restaurantId)),
				);
				return yield* getAdminRestaurantRow(restaurantId);
			});

		const rejectRestaurant: AdminServiceShape["rejectRestaurant"] = (
			restaurantId,
			_adminId,
			reason,
		) =>
			Effect.gen(function* () {
				const current = yield* getAdminRestaurantRow(restaurantId);
				if (current.approvalStatus === "approved") {
					return yield* new BusinessRuleError({
						message: "Cannot reject an approved restaurant — suspend instead",
					});
				}
				yield* dbQuery(
					db
						.update(restaurants)
						.set({
							approvalStatus: "rejected",
							rejectionReason: reason,
							isOpen: false,
							updatedAt: new Date(),
						})
						.where(eq(restaurants.id, restaurantId)),
				);
				return yield* getAdminRestaurantRow(restaurantId);
			});

		const suspendRestaurant: AdminServiceShape["suspendRestaurant"] = (
			restaurantId,
			_adminId,
			reason,
		) =>
			Effect.gen(function* () {
				yield* getAdminRestaurantRow(restaurantId);
				yield* dbQuery(
					db
						.update(restaurants)
						.set({
							approvalStatus: "suspended",
							rejectionReason: reason,
							isOpen: false,
							updatedAt: new Date(),
						})
						.where(eq(restaurants.id, restaurantId)),
				);
				return yield* getAdminRestaurantRow(restaurantId);
			});

		const updateCommissionRate: AdminServiceShape["updateCommissionRate"] = (
			restaurantId,
			commissionRate,
		) =>
			Effect.gen(function* () {
				yield* getAdminRestaurantRow(restaurantId);
				yield* dbQuery(
					db
						.update(restaurants)
						.set({
							commissionRate,
							updatedAt: new Date(),
						})
						.where(eq(restaurants.id, restaurantId)),
				);
				return yield* getAdminRestaurantRow(restaurantId);
			});

		const listUsers: AdminServiceShape["listUsers"] = (filters) =>
			Effect.gen(function* () {
				const rows = yield* dbQuery(
					db
						.select({
							id: users.id,
							firstName: users.firstName,
							lastName: users.lastName,
							email: users.email,
							phoneNumber: users.phoneNumber,
							role: users.role,
							isActive: users.isActive,
							walletBalance: users.walletBalance,
							createdAt: users.createdAt,
						})
						.from(users)
						.where(
							and(
								isNull(users.deletedAt),
								filters?.role ? eq(users.role, filters.role as any) : undefined,
								filters?.isActive !== undefined
									? eq(users.isActive, filters.isActive)
									: undefined,
							),
						),
				);
				return rows.map((r) => ({
					...r,
					createdAt: r.createdAt.toISOString(),
				})) as AdminUserRow[];
			});

		const deactivateUser: AdminServiceShape["deactivateUser"] = (userId) =>
			Effect.gen(function* () {
				const [row] = yield* dbQuery(
					db
						.update(users)
						.set({
							isActive: false,
							updatedAt: new Date(),
						})
						.where(and(eq(users.id, userId), isNull(users.deletedAt)))
						.returning({ id: users.id }),
				);
				if (!row)
					return yield* new NotFoundError({
						resource: "User",
						id: userId,
					});
			});

		const reactivateUser: AdminServiceShape["reactivateUser"] = (userId) =>
			Effect.gen(function* () {
				const [row] = yield* dbQuery(
					db
						.update(users)
						.set({
							isActive: true,
							updatedAt: new Date(),
						})
						.where(and(eq(users.id, userId), isNull(users.deletedAt)))
						.returning({ id: users.id }),
				);
				if (!row)
					return yield* new NotFoundError({
						resource: "User",
						id: userId,
					});
			});

		const listPendingDrivers: AdminServiceShape["listPendingDrivers"] = () =>
			Effect.gen(function* () {
				const rows = yield* dbQuery(
					db
						.select({
							id: drivers.id,
							userId: drivers.userId,
							vehicleType: drivers.vehicleType,
							licenseNumber: drivers.licenseNumber,
							approvalStatus: drivers.approvalStatus,
							createdAt: drivers.createdAt,
							email: users.email,
							firstName: users.firstName,
							lastName: users.lastName,
						})
						.from(drivers)
						.innerJoin(users, eq(drivers.userId, users.id))
						.where(eq(drivers.approvalStatus, "pending")),
				);
				return rows.map((r) => ({
					id: r.id,
					userId: r.userId,
					vehicleType: r.vehicleType,
					licenseNumber: r.licenseNumber,
					approvalStatus: r.approvalStatus,
					createdAt: r.createdAt.toISOString(),
					user: {
						email: r.email,
						firstName: r.firstName,
						lastName: r.lastName,
					},
				}));
			});

		const approveDriver: AdminServiceShape["approveDriver"] = (
			driverId,
			adminId,
		) =>
			Effect.gen(function* () {
				const [current] = yield* dbQuery(
					db
						.select({
							approvalStatus: drivers.approvalStatus,
						})
						.from(drivers)
						.where(eq(drivers.id, driverId))
						.limit(1),
				);
				if (!current)
					return yield* new NotFoundError({
						resource: "Driver",
						id: driverId,
					});

				if (current.approvalStatus === "approved") {
					return yield* new BusinessRuleError({
						message: "Driver is already approved",
					});
				}
				yield* dbQuery(
					db
						.update(drivers)
						.set({
							approvalStatus: "approved",
							approvedAt: new Date(),
							approvedBy: adminId,
							updatedAt: new Date(),
						})
						.where(eq(drivers.id, driverId)),
				);
			});

		const rejectDriver: AdminServiceShape["rejectDriver"] = (
			driverId,
			_adminId,
			reason,
		) =>
			Effect.gen(function* () {
				const [current] = yield* dbQuery(
					db
						.select({
							approvalStatus: drivers.approvalStatus,
						})
						.from(drivers)
						.where(eq(drivers.id, driverId))
						.limit(1),
				);
				if (!current)
					return yield* new NotFoundError({
						resource: "Driver",
						id: driverId,
					});

				if (current.approvalStatus === "approved") {
					return yield* new BusinessRuleError({
						message: "Cannot reject an approved driver — suspend instead",
					});
				}
				yield* dbQuery(
					db
						.update(drivers)
						.set({
							approvalStatus: "rejected",
							rejectionReason: reason,
							updatedAt: new Date(),
						})
						.where(eq(drivers.id, driverId)),
				);
			});

		return {
			listPendingRestaurants,
			listAllRestaurants,
			getRestaurantDetail,
			approveRestaurant,
			rejectRestaurant,
			suspendRestaurant,
			updateCommissionRate,
			listUsers,
			deactivateUser,
			reactivateUser,
			listPendingDrivers,
			approveDriver,
			rejectDriver,
		};
	}),
);
