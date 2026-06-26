import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpServerRequest } from "effect/unstable/http/HttpServerRequest";
import { RateLimiter } from "effect/unstable/persistence";

const Limits = {
	register: { limit: 5, window: "1 hour" },
	login: { limit: 10, window: "15 minutes" },
	refresh: { limit: 30, window: "1 hour" },
	vendorWrite: { limit: 60, window: "1 minute" },
	publicRead: { limit: 120, window: "1 minute" },
	admin: { limit: 200, window: "1 minute" },
} as const;

interface RateLimiterServiceShape {
	check: (
		preset: keyof typeof Limits,
		key: string,
	) => Effect.Effect<void, RateLimiter.RateLimiterError>;
}

export class RateLimterService extends Context.Service<
	RateLimterService,
	RateLimiterServiceShape
>()("chowdeck-assignment/libs/ratelimit/RateLimterService") {}

export const RateLimiterLive = Layer.effect(
	RateLimterService,
	Effect.gen(function* () {
		const withLimiter = yield* RateLimiter.makeWithRateLimiter;
		const check: RateLimiterServiceShape["check"] = (preset, key) => {
			const { limit, window } = Limits[preset];
			return Effect.void.pipe(
				withLimiter({
					key,
					limit,
					window,
					algorithm: "fixed-window",
					onExceeded: "fail", // fail immediately with RateLimiterError
				}),
			);
		};

		return { check };
	}),
).pipe(
	Layer.provide(RateLimiter.layer),
	Layer.provide(RateLimiter.layerStoreMemory),
);

export const clientKey = Effect.gen(function* () {
	const request = yield* HttpServerRequest;
	const ip =
		request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
		request.headers["x-real-ip"] ??
		"unknown";
	return ip;
});
