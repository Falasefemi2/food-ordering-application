import * as Schema from "effect/Schema";

export class DbError extends Schema.TaggedErrorClass<DbError>()("DbError", {
	message: Schema.String,
	cause: Schema.optional(Schema.Unknown),
}) {}

export class UnauthorizedError extends Schema.TaggedErrorClass<UnauthorizedError>()(
	"UnauthorizedError",
	{
		message: Schema.String,
	},
	{ httpApiStatus: 401 },
) {}

export class ForbiddenError extends Schema.TaggedErrorClass<ForbiddenError>()(
	"ForbiddenError",
	{
		message: Schema.String,
	},
	{ httpApiStatus: 403 },
) {}

export class TokenExpiredError extends Schema.TaggedErrorClass<TokenExpiredError>()(
	"TokenExpiredError",
	{
		message: Schema.String,
	},
) {}

export class InvalidTokenError extends Schema.TaggedErrorClass<InvalidTokenError>()(
	"InvalidTokenError",
	{
		message: Schema.String,
	},
) {}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
	"NotFoundError",
	{
		resource: Schema.String,
		id: Schema.optional(Schema.String),
	},
	{ httpApiStatus: 404 },
) {}

export class ConflictError extends Schema.TaggedErrorClass<ConflictError>()(
	"ConflictError",
	{
		message: Schema.String,
	},
	{ httpApiStatus: 409 },
) {}

export class ValidationError extends Schema.TaggedErrorClass<ValidationError>()(
	"ValidationError",
	{
		message: Schema.String,
		fields: Schema.optional(
			Schema.Struct({
				key: Schema.String,
				value: Schema.Unknown,
			}),
		),
	},
) {}

export class BusinessRuleError extends Schema.TaggedErrorClass<BusinessRuleError>()(
	"BusinessRuleError",
	{
		message: Schema.String,
	},
	{ httpApiStatus: 422 },
) {}
