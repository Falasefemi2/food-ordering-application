import { Layer } from "effect";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi";
import { HttpMiddleware, HttpRouter } from "effect/unstable/http";
import { Api } from "./src/api";
import { AuthHandlers } from "./src/auth/auth-handlers";
import { AuthMiddlewareLayer } from "./src/auth/auth-middleware";
import { DatabaseLive } from "./src/db";
import { AuthLive } from "./src/auth/auth-layer";

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

const AppLayer = HttpServerLayer.pipe(
	Layer.provide(AuthHandlers),
	Layer.provide(AuthMiddlewareLayer),
	Layer.provide(AuthLive),
	Layer.provide(InfraLive),
);

BunRuntime.runMain(Layer.launch(AppLayer));
