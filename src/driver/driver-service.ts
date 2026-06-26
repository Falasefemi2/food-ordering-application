import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
	BusinessRuleError,
	ConflictError,
	DbError,
	NotFoundError,
} from "../libs/errors";

export interface DriverProfileRow {
	id: string;
	userId: string;
	vehicleType: "bicycle" | "motorbike" | "car";
	vehiclePlateNumber: string | null;
	vehicleColor: string | null;
	vehicleModel: string | null;
	licenseNumber: string | null;
	licenseImageUrl: string | null;
	vehicleImageUrl: string | null;
	nationalIdImageUrl: string | null;
	approvalStatus: string;
	rejectionReason: string | null;
	status: string;
	currentLatitude: string | null;
	currentLongitude: string | null;
	lastLocationUpdate: string | null;
	ratingAvg: string;
	ratingCount: number;
	totalDeliveries: number;
	createdAt: string;
	updatedAt: string;
}

export interface CreateDriverProfileInput {
	vehicleType: "bicycle" | "motorbike" | "car";
	vehiclePlateNumber?: string;
	vehicleColor?: string;
	vehicleModel?: string;
	licenseNumber?: string;
}

export interface UpdateDriverProfileInput {
	vehiclePlateNumber?: string;
	vehicleColor?: string;
	vehicleModel?: string;
	licenseNumber?: string;
}

export interface DriverServiceShape {
	createProfile: (
		userId: string,
		input: CreateDriverProfileInput,
	) => Effect.Effect<DriverProfileRow, DbError | ConflictError>;

	getMyProfile: (
		userId: string,
	) => Effect.Effect<DriverProfileRow, DbError | NotFoundError>;

	updateMyProfile: (
		userId: string,
		input: UpdateDriverProfileInput,
	) => Effect.Effect<DriverProfileRow, DbError | NotFoundError>;

	updateStatus: (
		userId: string,
		status: "offline" | "online_idle" | "online_busy",
	) => Effect.Effect<
		DriverProfileRow,
		DbError | NotFoundError | BusinessRuleError
	>;

	updateLocation: (
		userId: string,
		latitude: string,
		longitude: string,
	) => Effect.Effect<void, DbError | NotFoundError>;

	updateDocumentUrl: (
		userId: string,
		field: "licenseImageUrl" | "vehicleImageUrl" | "nationalIdImageUrl",
		url: string,
	) => Effect.Effect<DriverProfileRow, DbError | NotFoundError>;
}

export class DriverService extends Context.Service<
	DriverService,
	DriverServiceShape
>()("chowdeck/DriverService") {}
