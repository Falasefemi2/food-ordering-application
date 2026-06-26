import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import { AdminApiGroup } from "./admin/admin-api";
import { AddressApiGroup } from "./adress/address-api";
import { AuthApiGroup } from "./auth/auth-api";
import { DriverApiGroup } from "./driver/driver-api";
import { OrderApiGroup } from "./order/order-api";
import { RestaurantApiGroup } from "./restaurant/restaurant-api";
import { RestaurantUploadApiGroup } from "./restaurant/restaurant-upload-api";

export class Api extends HttpApi.make("chowdeck-api")
	.add(AuthApiGroup)
	.add(AddressApiGroup)
	.add(RestaurantApiGroup)
	.add(RestaurantUploadApiGroup)
	.add(DriverApiGroup)
	.add(AdminApiGroup)
	.add(OrderApiGroup)
	.annotateMerge(
		OpenApi.annotations({
			title: "Chowdeck API",
			version: "1.0.0",
		}),
	) {}
