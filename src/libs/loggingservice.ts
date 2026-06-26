import { BunFileSystem } from "@effect/platform-bun";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as References from "effect/References";

const fileLogger = Logger.formatSimple.pipe(
	Logger.toFile("logs/app.log", {
		flag: "a",
		batchWindow: "500 millis",
	}),
);

const DevLoggerLayer = Layer.mergeAll(
	Logger.layer([Logger.consolePretty({ colors: true }), fileLogger]).pipe(
		Layer.provide(BunFileSystem.layer),
	),
	Layer.succeed(References.MinimumLogLevel, "Debug"),
);

const ProdLoggerLayer = Layer.mergeAll(
	Logger.layer([Logger.consoleJson, fileLogger]).pipe(
		Layer.provide(BunFileSystem.layer),
	),
	Layer.succeed(References.MinimumLogLevel, "Info"),
);

export const LoggerLayer = Layer.unwrap(
	Effect.gen(function* () {
		const env = yield* Config.string("NODE_ENV").pipe(
			Config.withDefault("development"),
		);
		return env === "production" ? ProdLoggerLayer : DevLoggerLayer;
	}),
);
