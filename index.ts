import { Layer } from "effect";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi";
import { HttpMiddleware, HttpRouter } from "effect/unstable/http";
import { Api } from "./src/api";
import { AuthHandlers } from "./src/auth/auth-handlers";
import { AuthMiddlewareLayer } from "./src/auth/auth-middleware";
import { DatabaseLive } from "./src/db";
import { AuthLive } from "./src/auth/auth-layer";
import { RestaurantHandlers } from "./src/restaurant/restaurant-handlers";
import { RestaurantLive } from "./src/restaurant/restaurant-layer";
import { AdminHandlers } from "./src/admin/admin-handlers";
import { AdminLive } from "./src/admin/admin-layer";
import { LoggerLayer } from "./src/libs/loggingservice";
import { CacheLive } from "./src/libs/cacheservice";
import { RateLimiterLive } from "./src/libs/ratelimit";
import { ImageUploadLive } from "./src/libs/imageservice";
import { RestaurantUploadHandlers } from "./src/restaurant/restaurant-upload-handlers";
import { AddressHandlers } from "./src/adress/address-handlers";
import { AddressLive } from "./src/adress/address-layer";

const InfraLive = DatabaseLive;

const ApiRoutes = HttpApiBuilder.layer(Api, {
	openapiPath: "/openapi.json",
});

const DocsRoute = HttpApiScalar.layer(Api, { path: "/docs" });

const AllRoutes = Layer.mergeAll(ApiRoutes, DocsRoute);

const HttpServerLayer = HttpRouter.serve(AllRoutes, {
	middleware: (app) =>
		app.pipe(
			HttpMiddleware.cors({
				allowedOrigins: ["http://localhost:3001"],
				allowedMethods: [
					"GET",
					"POST",
					"PATCH",
					"DELETE",
					"OPTIONS",
				],
				allowedHeaders: [
					"Content-Type",
					"Authorization",
					"traceparent",
					"tracestate",
					"b3",
					"x-b3-traceid",
					"x-b3-spanid",
					"x-b3-sampled",
					"baggage",
				],
				credentials: true,
			}),
		),
}).pipe(Layer.provide(BunHttpServer.layer({ port: 3000 })));

const AuthMiddlewareWithDeps = AuthMiddlewareLayer.pipe(
	Layer.provide(AuthLive),
	Layer.provide(InfraLive),
);

const AppLayer = HttpServerLayer.pipe(
	Layer.provide(AuthHandlers),
	Layer.provide(AddressHandlers),
	Layer.provide(RestaurantHandlers),
	Layer.provide(RestaurantUploadHandlers),
	Layer.provide(AdminHandlers),
	Layer.provide(AuthMiddlewareWithDeps),
	Layer.provide(AuthLive),
	Layer.provide(RestaurantLive),
	Layer.provide(AdminLive),
	Layer.provide(CacheLive),
	Layer.provide(RateLimiterLive),
	Layer.provide(ImageUploadLive),
	Layer.provide(AddressLive),
	Layer.provide(InfraLive),
	Layer.provide(LoggerLayer),
);

BunRuntime.runMain(Layer.launch(AppLayer));
