import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";
import { HttpMiddleware, HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi";
import { AdminHandlers } from "./src/admin/admin-handlers";
import { AdminLive } from "./src/admin/admin-layer";
import { AddressHandlers } from "./src/adress/address-handlers";
import { AddressLive } from "./src/adress/address-layer";
import { Api } from "./src/api";
import { AuthHandlers } from "./src/auth/auth-handlers";
import { AuthLive } from "./src/auth/auth-layer";
import { AuthMiddlewareLayer } from "./src/auth/auth-middleware";
import { DatabaseLive } from "./src/db";
import { DispatchLive } from "./src/dispatch/dispatch-layer";
import { DriverHandlers } from "./src/driver/driver-handlers";
import { DriverLive } from "./src/driver/driver-layer";
import { CacheLive } from "./src/libs/cacheservice";
import { ImageUploadLive } from "./src/libs/imageservice";
import { LoggerLayer } from "./src/libs/loggingservice";
import { RateLimiterLive } from "./src/libs/ratelimit";
import { OrderHandlers } from "./src/order/order-handlers";
import { OrderLive } from "./src/order/order-layer";
import { RestaurantHandlers } from "./src/restaurant/restaurant-handlers";
import { RestaurantLive } from "./src/restaurant/restaurant-layer";
import { RestaurantUploadHandlers } from "./src/restaurant/restaurant-upload-handlers";

const InfraLive = DatabaseLive;

const AuthMiddlewareWithDeps = AuthMiddlewareLayer.pipe(
	Layer.provide(AuthLive),
	Layer.provide(InfraLive),
);

const AllHandlers = Layer.mergeAll(
	AuthHandlers,
	AddressHandlers,
	RestaurantHandlers,
	RestaurantUploadHandlers,
	AdminHandlers,
	OrderHandlers,
	DriverHandlers,
).pipe(Layer.provide(AuthMiddlewareWithDeps));

const ApiRoutes = HttpApiBuilder.layer(Api, {
	openapiPath: "/openapi.json",
}).pipe(Layer.provide(AuthMiddlewareWithDeps));

const AllRoutes = Layer.mergeAll(
	ApiRoutes,
	HttpApiScalar.layer(Api, { path: "/docs" }),
);

const HttpServerLayer = HttpRouter.serve(AllRoutes, {
	middleware: (app) =>
		app.pipe(
			HttpMiddleware.cors({
				allowedOrigins: ["http://localhost:3001"],
				allowedMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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

const AppLayer = HttpServerLayer.pipe(
	Layer.provide(AllHandlers),
	Layer.provide(AuthLive),
	Layer.provide(RestaurantLive),
	Layer.provide(AdminLive),
	Layer.provide(AddressLive),
	Layer.provide(OrderLive),
	Layer.provide(DriverLive),
	Layer.provide(DispatchLive),
	Layer.provide(CacheLive),
	Layer.provide(RateLimiterLive),
	Layer.provide(ImageUploadLive),
	Layer.provide(InfraLive),
	Layer.provide(LoggerLayer),
);

BunRuntime.runMain(Layer.launch(AppLayer));
