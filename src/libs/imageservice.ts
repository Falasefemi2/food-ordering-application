import { BunFileSystem, BunPath } from "@effect/platform-bun";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import { Multipart } from "effect/unstable/http";
import type { HttpServerRequest } from "effect/unstable/http/HttpServerRequest";
import { loadConfig } from "./config";

export class ImageUploadError extends Schema.TaggedErrorClass<ImageUploadError>()(
	"ImageUploadError",
	{ message: Schema.String },
) {}

export const UploadFolder = {
	restaurantLogo: "chowdeck/restaurants/logos",
	restaurantBanner: "chowdeck/restaurants/banners",
	menuItem: "chowdeck/menu-items",
	driverLicense: "chowdeck/drivers/licenses",
	driverVehicle: "chowdeck/drivers/vehicles",
	driverNationalId: "chowdeck/drivers/national-ids",
	userAvatar: "chowdeck/users/avatars",
} as const;

export type UploadFolder = (typeof UploadFolder)[keyof typeof UploadFolder];

const MaxImageBytes = 5 * 1024 * 1024;
const AllowedImageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const AllowedImageMimeTypes = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
]);

interface ImageUploadServiceShape {
	uploadFile: (
		fileName: string,
		filePath: string,
		folder: UploadFolder,
	) => Effect.Effect<string, ImageUploadError>;

	uploadFromRequest: (
		request: HttpServerRequest,
		folder: UploadFolder,
		publicIdPrefix?: string,
	) => Effect.Effect<
		string,
		ImageUploadError | Multipart.MultipartError,
		Scope.Scope
	>;
}

export class ImageUploadService extends Context.Service<
	ImageUploadService,
	ImageUploadServiceShape
>()("chowdeck-assignment/libs/imageservice/ImageUploadService") {}

export const ImageUploadLive = Layer.effect(
	ImageUploadService,
	Effect.gen(function* () {
		const config = yield* Effect.orDie(loadConfig);
		const {
			CLOUDINARY_CLOUD_NAME: cloudName,
			CLOUDINARY_API_KEY: apiKey,
			CLOUDINARY_API_SECRET: apiSecret,
		} = config;

		const sign = async (paramsToSign: string): Promise<string> => {
			const buf = await crypto.subtle.digest(
				"SHA-1",
				new TextEncoder().encode(paramsToSign + apiSecret),
			);
			return Array.from(new Uint8Array(buf))
				.map((b) => b.toString(16).padStart(2, "0"))
				.join("");
		};

		const uploadFile: ImageUploadServiceShape["uploadFile"] = (
			fileName,
			filePath,
			folder,
		) =>
			Effect.tryPromise({
				try: async () => {
					const fileData = await Bun.file(filePath).arrayBuffer();
					const blob = new Blob([fileData]);
					const formData = new FormData();
					const timestamp = Math.round(Date.now() / 1000).toString();
					// const publicId = `${folder}/${fileName}`;
					const publicId = fileName;
					const paramsToSign = [
						`folder=${folder}`,
						`public_id=${publicId}`,
						`timestamp=${timestamp}`,
					]
						.sort()
						.join("&");

					const signature = await sign(paramsToSign);

					formData.append("file", blob, fileName);
					formData.append("folder", folder);
					formData.append("public_id", publicId);
					formData.append("api_key", apiKey);
					formData.append("timestamp", timestamp);
					formData.append("signature", signature);

					const res = await fetch(
						`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
						{
							method: "POST",
							body: formData,
						},
					);
					const data = (await res.json()) as {
						secure_url?: string;
						error?: { message: string };
					};

					if (data.error) throw new Error(data.error.message);
					if (!data.secure_url)
						throw new Error("No secure_url in Cloudinary response");

					return data.secure_url;
				},
				catch: (e) =>
					new ImageUploadError({
						message: `Upload failed: ${e instanceof Error ? e.message : String(e)}`,
					}),
			});

		const uploadFromRequest: ImageUploadServiceShape["uploadFromRequest"] = (
			request,
			folder,
			publicIdPrefix,
		) =>
			Effect.gen(function* () {
				const persisted = yield* request.multipart;

				const fileEntry = Object.entries(persisted).find(
					([, parts]) =>
						Array.isArray(parts) &&
						parts.length > 0 &&
						Multipart.isPersistedFile(parts[0]),
				);

				if (!fileEntry)
					return yield* new ImageUploadError({
						message: "No file found in request",
					});

				const [, parts] = fileEntry;
				const file = (parts as Multipart.PersistedFile[])[0]!;
				const ext = file.name?.split(".").pop()?.toLowerCase() ?? "jpg";
				if (!AllowedImageExtensions.has(ext)) {
					return yield* new ImageUploadError({
						message: "Only JPG, PNG, and WEBP images are allowed",
					});
				}

				const contentType = "contentType" in file ? file.contentType : undefined;
				if (
					typeof contentType === "string" &&
					!AllowedImageMimeTypes.has(contentType.toLowerCase())
				) {
					return yield* new ImageUploadError({
						message: "Only JPG, PNG, and WEBP images are allowed",
					});
				}

				const localFile = Bun.file(file.path);
				if (localFile.size > MaxImageBytes) {
					return yield* new ImageUploadError({
						message: "Image must be 5MB or smaller",
					});
				}

				const baseName = publicIdPrefix
					? `${publicIdPrefix}-${Date.now()}`
					: `${Date.now()}`;
				const fileName = `${baseName}.${ext}`;

				const url = yield* uploadFile(fileName, file.path, folder);

				yield* Effect.logInfo("Image uploaded to Cloudinary", {
					folder,
					fileName,
					url,
				});

				return url;
			}).pipe(
				Effect.provide(Layer.mergeAll(BunFileSystem.layer, BunPath.layer)),
			);

		return { uploadFile, uploadFromRequest };
	}),
);
