import { and, eq } from "drizzle-orm";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { PgDatabase } from "../db";
import { addresses } from "../db/schema";
import {
	BusinessRuleError,
	DbError,
	ForbiddenError,
	NotFoundError,
} from "../libs/errors";
import {
	type AddressRow,
	AddressService,
	type AddressServiceShape,
} from "./adress-service";

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

const toAddressRow = (r: {
	id: string;
	userId: string;
	label: string;
	addressLine1: string;
	addressLine2: string | null;
	city: string;
	state: string;
	country: string;
	postalCode: string | null;
	latitude: string;
	longitude: string;
	isDefault: boolean;
	createdAt: Date;
	updatedAt: Date;
}): AddressRow => ({
	id: r.id,
	userId: r.userId,
	label: r.label,
	addressLine1: r.addressLine1,
	addressLine2: r.addressLine2,
	city: r.city,
	state: r.state,
	country: r.country,
	postalCode: r.postalCode,
	latitude: r.latitude,
	longitude: r.longitude,
	isDefault: r.isDefault,
	createdAt: r.createdAt.toISOString(),
	updatedAt: r.updatedAt.toISOString(),
});

export const AddressLive = Layer.effect(
	AddressService,
	Effect.gen(function* () {
		const db = yield* PgDatabase;

		const assertOwner = (addressId: string, userId: string) =>
			Effect.gen(function* () {
				const [row] = yield* dbQuery(
					db
						.select()
						.from(addresses)
						.where(
							and(eq(addresses.id, addressId), eq(addresses.userId, userId)),
						)
						.limit(1),
				);
				if (!row) {
					return yield* new NotFoundError({
						resource: "Address",
						id: addressId,
					});
				}
				if (row.userId !== userId) {
					return yield* new ForbiddenError({
						message: "You do not own this address",
					});
				}
				return row;
			});
		const listAddresses: AddressServiceShape["listAddresses"] = (userId) =>
			Effect.gen(function* () {
				const rows = yield* dbQuery(
					db
						.select()
						.from(addresses)
						.where(eq(addresses.userId, userId))
						.orderBy(addresses.isDefault, addresses.createdAt),
				);
				return rows.map(toAddressRow);
			});
		const getAddress: AddressServiceShape["getAddress"] = (addressId, userId) =>
			Effect.gen(function* () {
				const row = yield* assertOwner(addressId, userId);
				return toAddressRow(row);
			});
		const createAddress: AddressServiceShape["createAddress"] = (
			userId,
			input,
		) =>
			Effect.gen(function* () {
				const exisiting = yield* dbQuery(
					db
						.select({
							id: addresses.id,
							isDefault: addresses.isDefault,
						})
						.from(addresses)
						.where(eq(addresses.userId, userId)),
				);
				const isFirstAddress = exisiting.length === 0;
				const shouldBeDefault = isFirstAddress || (input.isDefault ?? false);
				if (shouldBeDefault && exisiting.length > 0) {
					yield* dbQuery(
						db
							.update(addresses)
							.set({
								isDefault: false,
								updatedAt: new Date(),
							})
							.where(eq(addresses.userId, userId)),
					);
				}
				const [row] = yield* dbQuery(
					db
						.insert(addresses)
						.values({
							userId,
							label: input.label ?? "Home",
							addressLine1: input.addressLine1,
							addressLine2: input.addressLine2 ?? null,
							city: input.city,
							state: input.state,
							country: input.country ?? "Nigeria",
							postalCode: input.postalCode ?? null,
							latitude: input.latitude,
							longitude: input.longitude,
							isDefault: shouldBeDefault,
						})
						.returning(),
				);
				if (!row) {
					return yield* new DbError({
						message: "Failed to create address",
					});
				}
				return toAddressRow(row);
			});
		const updateAddress: AddressServiceShape["updateAddress"] = (
			addressId,
			userId,
			input,
		) =>
			Effect.gen(function* () {
				yield* assertOwner(addressId, userId);
				if (input.isDefault === true) {
					yield* dbQuery(
						db
							.update(addresses)
							.set({
								isDefault: false,
								updatedAt: new Date(),
							})
							.where(and(eq(addresses.userId, userId))),
					);
				}
				const [updated] = yield* dbQuery(
					db
						.update(addresses)
						.set({
							...input,
							updatedAt: new Date(),
						})
						.where(
							and(eq(addresses.id, addressId), eq(addresses.userId, userId)),
						)
						.returning(),
				);
				if (!updated) {
					return yield* new NotFoundError({
						resource: "Address",
						id: addressId,
					});
				}

				return toAddressRow(updated);
			});
		const deleteAddress: AddressServiceShape["deleteAddress"] = (
			addressId,
			userId,
		) =>
			Effect.gen(function* () {
				const row = yield* assertOwner(addressId, userId);
				if (row.isDefault) {
					const others = yield* dbQuery(
						db
							.select({
								id: addresses.id,
							})
							.from(addresses)
							.where(and(eq(addresses.userId, userId)))
							.limit(2),
					);
					if (others.length > 1) {
						return yield* new BusinessRuleError({
							message:
								"Cannot delete your default address. Set another address as default first.",
						});
					}
				}
				yield* dbQuery(
					db
						.delete(addresses)
						.where(
							and(eq(addresses.id, addressId), eq(addresses.userId, userId)),
						),
				);
			});
		const setDefaultAddress: AddressServiceShape["setDefaultAddress"] = (
			addressId,
			userId,
		) =>
			Effect.gen(function* () {
				yield* assertOwner(addressId, userId);
				yield* dbQuery(
					db
						.update(addresses)
						.set({
							isDefault: false,
							updatedAt: new Date(),
						})
						.where(eq(addresses.userId, userId)),
				);
				const [updated] = yield* dbQuery(
					db
						.update(addresses)
						.set({
							isDefault: true,
							updatedAt: new Date(),
						})
						.where(
							and(eq(addresses.id, addressId), eq(addresses.userId, userId)),
						)
						.returning(),
				);
				if (!updated) {
					return yield* new NotFoundError({
						resource: "Address",
						id: addressId,
					});
				}
				return toAddressRow(updated);
			});

		return {
			listAddresses,
			getAddress,
			createAddress,
			updateAddress,
			deleteAddress,
			setDefaultAddress,
		};
	}),
);
