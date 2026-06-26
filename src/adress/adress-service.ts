import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
	BusinessRuleError,
	DbError,
	ForbiddenError,
	NotFoundError,
} from "../libs/errors";

export interface AddressRow {
	id: string;
	userId: string;
	label: string;
	addressLine1: string;
	addressLine2: string | null;
	city: string;
	state: string;
	country: string;
	postalCode: string | null;
	latitude: string;
	longitude: string;
	isDefault: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CreateAddressInput {
	label?: string;
	addressLine1: string;
	addressLine2?: string;
	city: string;
	state: string;
	country?: string;
	postalCode?: string;
	latitude: string;
	longitude: string;
	isDefault?: boolean;
}

export interface UpdateAddressInput {
	label?: string;
	addressLine1?: string;
	addressLine2?: string;
	city?: string;
	state?: string;
	postalCode?: string;
	latitude?: string;
	longitude?: string;
	isDefault?: boolean;
}

export interface AddressServiceShape {
	listAddresses: (userId: string) => Effect.Effect<AddressRow[], DbError>;
	getAddress: (
		addressId: string,
		userId: string,
	) => Effect.Effect<AddressRow, DbError | NotFoundError | ForbiddenError>;
	createAddress: (
		userId: string,
		input: CreateAddressInput,
	) => Effect.Effect<AddressRow, DbError>;
	updateAddress: (
		addressId: string,
		userId: string,
		input: UpdateAddressInput,
	) => Effect.Effect<AddressRow, DbError | NotFoundError | ForbiddenError>;
	deleteAddress: (
		addressId: string,
		userId: string,
	) => Effect.Effect<
		void,
		DbError | NotFoundError | ForbiddenError | BusinessRuleError
	>;
	setDefaultAddress: (
		addressId: string,
		userId: string,
	) => Effect.Effect<AddressRow, DbError | NotFoundError | ForbiddenError>;
}

export class AddressService extends Context.Service<
	AddressService,
	AddressServiceShape
>()("chowdeck-assignment/adress/adress-service/AddressService") {}
