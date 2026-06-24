import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import { AuthApiGroup } from "./auth/auth-api";
import { RestaurantApiGroup } from "./restaurant/restaurant-api";
import { AdminApiGroup } from "./admin/admin-api";

export class Api extends HttpApi.make("chowdeck-api")
	.add(AuthApiGroup)
	.add(RestaurantApiGroup)
	.add(AdminApiGroup)
	.annotateMerge(
		OpenApi.annotations({
			title: "Chowdeck API",
			version: "1.0.0",
		}),
	) {}
