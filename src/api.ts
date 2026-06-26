import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import { AuthApiGroup } from "./auth/auth-api";
import { RestaurantApiGroup } from "./restaurant/restaurant-api";
import { AdminApiGroup } from "./admin/admin-api";
import { RestaurantUploadApiGroup } from "./restaurant/restaurant-upload-api";
import { AddressApiGroup } from "./adress/address-api";

export class Api extends HttpApi.make("chowdeck-api")
	.add(AuthApiGroup)
	.add(AddressApiGroup)
	.add(RestaurantApiGroup)
	.add(RestaurantUploadApiGroup)
	.add(AdminApiGroup)
	.annotateMerge(
		OpenApi.annotations({
			title: "Chowdeck API",
			version: "1.0.0",
		}),
	) {}
