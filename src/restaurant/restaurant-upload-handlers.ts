import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { eq, and, isNull } from "drizzle-orm";
import { Api } from "../api";
import { AuthContext } from "../auth/auth-middleware";
import { PgDatabase } from "../db";
import { restaurants, menuItems } from "../db/schema";
import { ForbiddenError, NotFoundError, DbError } from "../libs/errors";
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import {
	ImageUploadError,
	ImageUploadService,
	UploadFolder,
} from "../libs/imageservice";
import { HttpServerRequest } from "effect/unstable/http/HttpServerRequest";

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

export const RestaurantUploadHandlers = HttpApiBuilder.group(
	Api,
	"restaurantUpload",
	Effect.fn(function* (handlers) {
		const uploader = yield* ImageUploadService;
		const db = yield* PgDatabase;
		return handlers
			.handle("uploadRestaurantLogo", ({ params }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					if (role !== "vendor")
						return yield* new ForbiddenError(
							{
								message: "Vendors only",
							},
						);

					const [restaurant] = yield* dbQuery(
						db
							.select({
								id: restaurants.id,
								ownerId: restaurants.ownerId,
							})
							.from(restaurants)
							.where(
								and(
									eq(
										restaurants.id,
										params.id,
									),
									isNull(
										restaurants.deletedAt,
									),
								),
							)
							.limit(1),
					);

					if (!restaurant)
						return yield* new NotFoundError(
							{
								resource: "Restaurant",
								id: params.id,
							},
						);
					if (restaurant.ownerId !== ownerId)
						return yield* new ForbiddenError(
							{
								message: "You do not own this restaurant",
							},
						);

					const request =
						yield* HttpServerRequest;
					const url = yield* Effect.scoped(
						uploader.uploadFromRequest(
							request,
							UploadFolder.restaurantLogo,
							`logo-${params.id}`,
						),
					);

					yield* dbQuery(
						db
							.update(restaurants)
							.set({
								logoUrl: url,
								updatedAt: new Date(),
							})
							.where(
								eq(
									restaurants.id,
									params.id,
								),
							),
					);

					return { url };
				}),
			)

			.handle("uploadRestaurantBanner", ({ params }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					if (role !== "vendor")
						return yield* new ForbiddenError(
							{
								message: "Vendors only",
							},
						);

					const [restaurant] = yield* dbQuery(
						db
							.select({
								id: restaurants.id,
								ownerId: restaurants.ownerId,
							})
							.from(restaurants)
							.where(
								and(
									eq(
										restaurants.id,
										params.id,
									),
									isNull(
										restaurants.deletedAt,
									),
								),
							)
							.limit(1),
					);

					if (!restaurant)
						return yield* new NotFoundError(
							{
								resource: "Restaurant",
								id: params.id,
							},
						);
					if (restaurant.ownerId !== ownerId)
						return yield* new ForbiddenError(
							{
								message: "You do not own this restaurant",
							},
						);

					const request =
						yield* HttpServerRequest;
					const url = yield* Effect.scoped(
						uploader.uploadFromRequest(
							request,
							UploadFolder.restaurantLogo,
							`banner-${params.id}`,
						),
					);

					yield* dbQuery(
						db
							.update(restaurants)
							.set({
								bannerUrl: url,
								updatedAt: new Date(),
							})
							.where(
								eq(
									restaurants.id,
									params.id,
								),
							),
					);

					return { url };
				}),
			)

			.handle("uploadMenuItemImage", ({ params }) =>
				Effect.gen(function* () {
					const { sub: ownerId, role } =
						yield* AuthContext;
					if (role !== "vendor")
						return yield* new ForbiddenError(
							{
								message: "Vendors only",
							},
						);

					const [restaurant] = yield* dbQuery(
						db
							.select({
								id: restaurants.id,
								ownerId: restaurants.ownerId,
							})
							.from(restaurants)
							.where(
								and(
									eq(
										restaurants.id,
										params.id,
									),
									isNull(
										restaurants.deletedAt,
									),
								),
							)
							.limit(1),
					);

					if (!restaurant)
						return yield* new NotFoundError(
							{
								resource: "Restaurant",
								id: params.id,
							},
						);
					if (restaurant.ownerId !== ownerId)
						return yield* new ForbiddenError(
							{
								message: "You do not own this restaurant",
							},
						);

					const [item] = yield* dbQuery(
						db
							.select({
								id: menuItems.id,
							})
							.from(menuItems)
							.where(
								and(
									eq(
										menuItems.id,
										params.itemId,
									),
									eq(
										menuItems.restaurantId,
										params.id,
									),
									isNull(
										menuItems.deletedAt,
									),
								),
							)
							.limit(1),
					);

					if (!item)
						return yield* new NotFoundError(
							{
								resource: "MenuItem",
								id: params.itemId,
							},
						);

					const request =
						yield* HttpServerRequest;
					const url = yield* Effect.scoped(
						uploader.uploadFromRequest(
							request,
							UploadFolder.restaurantLogo,
							`item-${params.id}`,
						),
					);

					yield* dbQuery(
						db
							.update(menuItems)
							.set({
								imageUrl: url,
								updatedAt: new Date(),
							})
							.where(
								eq(
									menuItems.id,
									params.itemId,
								),
							),
					);

					return { url };
				}),
			);
	}),
);
