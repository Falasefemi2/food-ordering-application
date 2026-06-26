import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { AuthMiddleware } from "../auth/auth-middleware";
import {
	NotFoundError,
	ForbiddenError,
	BusinessRuleError,
} from "../libs/errors";

const AddressResponse = Schema.Struct({
	id: Schema.String,
	userId: Schema.String,
	label: Schema.String,
	addressLine1: Schema.String,
	addressLine2: Schema.NullOr(Schema.String),
	city: Schema.String,
	state: Schema.String,
	country: Schema.String,
	postalCode: Schema.NullOr(Schema.String),
	latitude: Schema.String,
	longitude: Schema.String,
	isDefault: Schema.Boolean,
	createdAt: Schema.String,
	updatedAt: Schema.String,
});

const CreateAddressPayload = Schema.Struct({
	label: Schema.optional(Schema.String),
	addressLine1: Schema.String.pipe(Schema.check(Schema.isMinLength(5))),
	addressLine2: Schema.optional(Schema.String),
	city: Schema.String.pipe(Schema.check(Schema.isMinLength(2))),
	state: Schema.String.pipe(Schema.check(Schema.isMinLength(2))),
	country: Schema.optional(Schema.String),
	postalCode: Schema.optional(Schema.String),
	latitude: Schema.String,
	longitude: Schema.String,
	isDefault: Schema.optional(Schema.Boolean),
});

const UpdateAddressPayload = Schema.Struct({
	label: Schema.optional(Schema.String),
	addressLine1: Schema.optional(
		Schema.String.pipe(Schema.check(Schema.isMinLength(5))),
	),
	addressLine2: Schema.optional(Schema.String),
	city: Schema.optional(Schema.String),
	state: Schema.optional(Schema.String),
	postalCode: Schema.optional(Schema.String),
	latitude: Schema.optional(Schema.String),
	longitude: Schema.optional(Schema.String),
	isDefault: Schema.optional(Schema.Boolean),
});

export class AddressApiGroup extends HttpApiGroup.make("address")
	.add(
		HttpApiEndpoint.get("listAddresses", "/addresses", {
			success: Schema.Array(AddressResponse),
			error: [],
		}),
	)
	.add(
		HttpApiEndpoint.get("getAddress", "/addresses/:id", {
			params: Schema.Struct({ id: Schema.String }),
			success: AddressResponse,
			error: [NotFoundError, ForbiddenError],
		}),
	)
	.add(
		HttpApiEndpoint.post("createAddress", "/addresses", {
			payload: CreateAddressPayload,
			success: AddressResponse,
			error: [],
		}),
	)
	.add(
		HttpApiEndpoint.patch("updateAddress", "/addresses/:id", {
			params: Schema.Struct({ id: Schema.String }),
			payload: UpdateAddressPayload,
			success: AddressResponse,
			error: [NotFoundError, ForbiddenError],
		}),
	)
	.add(
		HttpApiEndpoint.delete("deleteAddress", "/addresses/:id", {
			params: Schema.Struct({ id: Schema.String }),
			success: Schema.Struct({ message: Schema.String }),
			error: [
				NotFoundError,
				ForbiddenError,
				BusinessRuleError,
			],
		}),
	)
	.add(
		HttpApiEndpoint.post(
			"setDefaultAddress",
			"/addresses/:id/default",
			{
				params: Schema.Struct({ id: Schema.String }),
				success: AddressResponse,
				error: [NotFoundError, ForbiddenError],
			},
		),
	)
	.middleware(AuthMiddleware) {}
