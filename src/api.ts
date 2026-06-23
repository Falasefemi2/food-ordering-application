import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import { AuthApiGroup } from "./auth/auth-api";

export class Api extends HttpApi.make("chowdeck-api")
	.add(AuthApiGroup)
	.annotateMerge(
		OpenApi.annotations({
			title: "Chowdeck API",
			version: "1.0.0",
		}),
	) {}
