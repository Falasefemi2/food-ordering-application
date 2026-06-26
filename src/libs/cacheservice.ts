import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type {
	PublicRestaurantDetailRow,
	PublicRestaurantRow,
} from "../restaurant/restaurant-service";

export interface PaginatedRestaurantResult {
	data: PublicRestaurantRow[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
}

export const CacheKeys = {
	restaurantList: (
		page: number,
		limit: number,
		city?: string,
		isOpen?: boolean,
	) => `restaurants:list:${page}:${limit}:${city ?? "all"}:${isOpen ?? "all"}`,

	restaurantDetail: (id: string) => `restaurants:detail:${id}`,
} as const;

interface CacheServiceShape {
	getRestaurantList: (
		key: string,
		lookup: () => Effect.Effect<PaginatedRestaurantResult, never>,
	) => Effect.Effect<PaginatedRestaurantResult>;

	getRestaurantDetail: (
		key: string,
		lookup: () => Effect.Effect<PublicRestaurantDetailRow, never>,
	) => Effect.Effect<PublicRestaurantDetailRow>;

	invalidateRestaurant: (restaurantId: string) => Effect.Effect<void>;

	invalidateRestaurantList: () => Effect.Effect<void>;
}

export class CacheService extends Context.Service<
	CacheService,
	CacheServiceShape
>()("chowdeck/CacheService") {}

export const CacheLive = Layer.effect(
	CacheService,
	Effect.gen(function* () {
		const listCache = yield* Cache.make<
			string,
			PaginatedRestaurantResult,
			never
		>({
			capacity: 200,
			timeToLive: Duration.minutes(2),
			lookup: () =>
				Effect.succeed({
					data: [],
					total: 0,
					page: 1,
					limit: 20,
					totalPages: 0,
					hasNext: false,
					hasPrev: false,
				}),
		});

		const detailCache = yield* Cache.make<
			string,
			PublicRestaurantDetailRow,
			never
		>({
			capacity: 500,
			timeToLive: Duration.minutes(5),
			lookup: () => Effect.die("detail cache miss"),
		});

		const getRestaurantList: CacheServiceShape["getRestaurantList"] = (
			key,
			lookup,
		) =>
			Effect.gen(function* () {
				const cached = yield* Cache.get(listCache, key).pipe(Effect.option);

				if (cached._tag === "Some" && cached.value.data.length > 0) {
					yield* Effect.logDebug("Cache HIT: restaurant list", { key });

					return cached.value;
				}

				yield* Effect.logDebug("Cache MISS: restaurant list", { key });

				const data = yield* lookup();

				yield* Cache.set(listCache, key, data);

				return data;
			});

		const getRestaurantDetail: CacheServiceShape["getRestaurantDetail"] = (
			key,
			lookup,
		) =>
			Effect.gen(function* () {
				const cached = yield* Cache.get(detailCache, key).pipe(
					Effect.catchDefect(() => Effect.succeed(null)),
					Effect.option,
				);

				if (cached._tag === "Some" && cached.value !== null) {
					yield* Effect.logDebug("Cache HIT: restaurant detail", { key });

					return cached.value;
				}

				yield* Effect.logDebug("Cache MISS: restaurant detail", { key });

				const data = yield* lookup();

				yield* Cache.set(detailCache, key, data);

				return data;
			});

		const invalidateRestaurant: CacheServiceShape["invalidateRestaurant"] = (
			restaurantId,
		) =>
			Effect.gen(function* () {
				yield* Cache.invalidate(
					detailCache,
					CacheKeys.restaurantDetail(restaurantId),
				);

				yield* Effect.logDebug("Cache invalidated: restaurant detail", {
					restaurantId,
				});
			});

		const invalidateRestaurantList: CacheServiceShape["invalidateRestaurantList"] =
			() =>
				Effect.gen(function* () {
					yield* Cache.invalidateAll(listCache);

					yield* Effect.logDebug(
						"Cache invalidated: all restaurant list pages",
					);
				});

		return {
			getRestaurantList,
			getRestaurantDetail,
			invalidateRestaurant,
			invalidateRestaurantList,
		};
	}),
);
