import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { AuthMiddleware } from "../auth/auth-middleware";
import { DbError, ForbiddenError, NotFoundError } from "../libs/errors";
import { ImageUploadError } from "../libs/imageservice";

const UploadResponse = Schema.Struct({
	url: Schema.String,
});

export class RestaurantUploadApiGroup extends HttpApiGroup.make(
	"restaurantUpload",
)
	.add(
		HttpApiEndpoint.post("uploadRestaurantLogo", "/restaurants/:id/logo", {
			disableCodecs: true,
			params: Schema.Struct({ id: Schema.String }),
			success: UploadResponse,
			error: [NotFoundError, ForbiddenError, ImageUploadError, DbError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("uploadRestaurantBanner", "/restaurants/:id/banner", {
			disableCodecs: true,
			params: Schema.Struct({ id: Schema.String }),
			success: UploadResponse,
			error: [NotFoundError, ForbiddenError, ImageUploadError, DbError],
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post(
			"uploadMenuItemImage",
			"/restaurants/:id/items/:itemId/image",
			{
				disableCodecs: true,
				params: Schema.Struct({
					id: Schema.String,
					itemId: Schema.String,
				}),
				success: UploadResponse,
				error: [NotFoundError, ForbiddenError, ImageUploadError, DbError],
			},
		).middleware(AuthMiddleware),
	) {}
