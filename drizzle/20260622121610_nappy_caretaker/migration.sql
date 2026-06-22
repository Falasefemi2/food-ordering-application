CREATE TYPE "cancellation_source" AS ENUM('customer', 'restaurant', 'driver', 'system');--> statement-breakpoint
CREATE TYPE "coupon_type" AS ENUM('percentage', 'fixed_amount');--> statement-breakpoint
CREATE TYPE "delivery_request_status" AS ENUM('pending', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "driver_approval_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "driver_status" AS ENUM('offline', 'online_idle', 'online_busy');--> statement-breakpoint
CREATE TYPE "notification_type" AS ENUM('order_update', 'driver_alert', 'promo', 'system');--> statement-breakpoint
CREATE TYPE "order_status" AS ENUM('pending', 'placed', 'accepted_by_restaurant', 'preparing', 'ready_for_pickup', 'driver_assigned', 'picked_up_by_driver', 'delivered', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "payment_method" AS ENUM('card', 'bank_transfer', 'wallet', 'cash_on_delivery');--> statement-breakpoint
CREATE TYPE "payment_status" AS ENUM('pending', 'authorized', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "restaurant_approval_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "review_type" AS ENUM('restaurant', 'driver');--> statement-breakpoint
CREATE TYPE "role" AS ENUM('customer', 'driver', 'vendor', 'admin', 'support');--> statement-breakpoint
CREATE TYPE "vehicle_type" AS ENUM('bicycle', 'motorbike', 'car');--> statement-breakpoint
CREATE TYPE "wallet_transaction_type" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"label" varchar(50) DEFAULT 'Home' NOT NULL,
	"address_line1" varchar(255) NOT NULL,
	"address_line2" varchar(255),
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"country" varchar(100) DEFAULT 'Nigeria' NOT NULL,
	"postal_code" varchar(20),
	"latitude" numeric(9,6) NOT NULL,
	"longitude" numeric(9,6) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"restaurant_id" uuid,
	"code" varchar(50) NOT NULL,
	"discountType" "coupon_type" NOT NULL,
	"discount_value" numeric(10,2) NOT NULL,
	"max_discount" numeric(10,2),
	"min_order_value" numeric(10,2) DEFAULT '0.00' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customization_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"menu_item_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"min_selectable" integer DEFAULT 0 NOT NULL,
	"max_selectable" integer DEFAULT 1 NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customization_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"group_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"price" numeric(10,2) DEFAULT '0.00' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"status" "delivery_request_status" DEFAULT 'pending'::"delivery_request_status" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"vehicleType" "vehicle_type" NOT NULL,
	"vehicle_plate_number" varchar(50),
	"vehicle_color" varchar(50),
	"vehicle_model" varchar(100),
	"license_number" varchar(100),
	"license_image_url" varchar(512),
	"vehicle_image_url" varchar(512),
	"national_id_image_url" varchar(512),
	"approvalStatus" "driver_approval_status" DEFAULT 'pending'::"driver_approval_status" NOT NULL,
	"rejection_reason" text,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"status" "driver_status" DEFAULT 'offline'::"driver_status" NOT NULL,
	"current_latitude" numeric(9,6),
	"current_longitude" numeric(9,6),
	"last_location_update" timestamp with time zone,
	"rating_avg" numeric(3,2) DEFAULT '0.00' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"total_deliveries" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"restaurant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"category_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price" numeric(10,2) NOT NULL,
	"image_url" varchar(512),
	"is_available" boolean DEFAULT true NOT NULL,
	"is_vegetarian" boolean DEFAULT false NOT NULL,
	"calories" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"reference_id" uuid,
	"reference_type" varchar(50),
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item_customizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_item_id" uuid NOT NULL,
	"customization_option_id" uuid,
	"option_name" varchar(100) NOT NULL,
	"price" numeric(10,2) DEFAULT '0.00' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"menu_item_id" uuid,
	"item_name" varchar(255) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10,2) NOT NULL,
	"total_price" numeric(10,2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"customer_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"driver_id" uuid,
	"coupon_id" uuid,
	"status" "order_status" DEFAULT 'pending'::"order_status" NOT NULL,
	"subtotal" numeric(10,2) NOT NULL,
	"delivery_fee" numeric(10,2) DEFAULT '0.00' NOT NULL,
	"service_fee" numeric(10,2) DEFAULT '0.00' NOT NULL,
	"discount_amount" numeric(10,2) DEFAULT '0.00' NOT NULL,
	"driver_tip" numeric(10,2) DEFAULT '0.00' NOT NULL,
	"total_price" numeric(10,2) NOT NULL,
	"delivery_address_id" uuid,
	"delivery_address_line" varchar(255) NOT NULL,
	"delivery_city" varchar(100) NOT NULL,
	"delivery_latitude" numeric(9,6) NOT NULL,
	"delivery_longitude" numeric(9,6) NOT NULL,
	"delivery_notes" text,
	"paymentStatus" "payment_status" DEFAULT 'pending'::"payment_status" NOT NULL,
	"paymentMethod" "payment_method" NOT NULL,
	"cancellation_reason" text,
	"cancellationSource" "cancellation_source",
	"placed_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"prepared_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(10,2) NOT NULL,
	"status" "payment_status" DEFAULT 'pending'::"payment_status" NOT NULL,
	"paymentMethod" "payment_method" NOT NULL,
	"gateway" varchar(50) NOT NULL,
	"gateway_reference" varchar(255) NOT NULL,
	"gateway_response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"logo_url" varchar(512),
	"banner_url" varchar(512),
	"phone_number" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"address_line" varchar(255) NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"country" varchar(100) DEFAULT 'Nigeria' NOT NULL,
	"approvalStatus" "restaurant_approval_status" DEFAULT 'pending'::"restaurant_approval_status" NOT NULL,
	"rejection_reason" text,
	"latitude" numeric(9,6) NOT NULL,
	"longitude" numeric(9,6) NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"opening_time" varchar(5) NOT NULL,
	"closing_time" varchar(5) NOT NULL,
	"estimated_prep_time" integer DEFAULT 20 NOT NULL,
	"commission_rate" numeric(4,2) DEFAULT '10.00' NOT NULL,
	"rating_avg" numeric(3,2) DEFAULT '0.00' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"restaurant_id" uuid,
	"driver_id" uuid,
	"reviewType" "review_type" NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"refresh_token_hash" varchar(255) NOT NULL,
	"user_agent" varchar(512),
	"ip_address" varchar(45),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone_number" varchar(50),
	"phone_verified" boolean DEFAULT false NOT NULL,
	"password_hash" varchar(255),
	"role" "role" DEFAULT 'customer'::"role" NOT NULL,
	"avatar_url" varchar(512),
	"is_active" boolean DEFAULT true NOT NULL,
	"wallet_balance" numeric(12,2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"type" "wallet_transaction_type" NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"balance_after" numeric(12,2) NOT NULL,
	"description" varchar(255) NOT NULL,
	"reference_id" uuid,
	"reference_type" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "addresses_user_id_idx" ON "addresses" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_uidx" ON "coupons" ("code");--> statement-breakpoint
CREATE INDEX "customization_groups_menu_item_id_idx" ON "customization_groups" ("menu_item_id");--> statement-breakpoint
CREATE INDEX "customization_options_group_id_idx" ON "customization_options" ("group_id");--> statement-breakpoint
CREATE INDEX "delivery_requests_order_id_idx" ON "delivery_requests" ("order_id");--> statement-breakpoint
CREATE INDEX "delivery_requests_driver_id_idx" ON "delivery_requests" ("driver_id");--> statement-breakpoint
CREATE INDEX "delivery_requests_status_idx" ON "delivery_requests" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_user_id_uidx" ON "drivers" ("user_id");--> statement-breakpoint
CREATE INDEX "drivers_status_idx" ON "drivers" ("status");--> statement-breakpoint
CREATE INDEX "drivers_approval_status_idx" ON "drivers" ("approvalStatus");--> statement-breakpoint
CREATE INDEX "menu_categories_restaurant_id_idx" ON "menu_categories" ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menu_items_restaurant_id_idx" ON "menu_items" ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menu_items_category_id_idx" ON "menu_items" ("category_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications" ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "order_item_customizations_order_item_id_idx" ON "order_item_customizations" ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" ("order_id");--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_restaurant_id_idx" ON "orders" ("restaurant_id");--> statement-breakpoint
CREATE INDEX "orders_driver_id_idx" ON "orders" ("driver_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" ("status");--> statement-breakpoint
CREATE INDEX "orders_status_created_at_idx" ON "orders" ("status","created_at");--> statement-breakpoint
CREATE INDEX "payments_order_id_idx" ON "payments" ("order_id");--> statement-breakpoint
CREATE INDEX "payments_user_id_idx" ON "payments" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_gateway_ref_uidx" ON "payments" ("gateway_reference");--> statement-breakpoint
CREATE INDEX "restaurants_owner_id_idx" ON "restaurants" ("owner_id");--> statement-breakpoint
CREATE INDEX "restaurants_approval_status_idx" ON "restaurants" ("approvalStatus");--> statement-breakpoint
CREATE INDEX "restaurants_city_idx" ON "restaurants" ("city");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_order_id_review_type_uidx" ON "reviews" ("order_id","reviewType");--> statement-breakpoint
CREATE INDEX "reviews_customer_id_idx" ON "reviews" ("customer_id");--> statement-breakpoint
CREATE INDEX "reviews_restaurant_id_idx" ON "reviews" ("restaurant_id");--> statement-breakpoint
CREATE INDEX "reviews_driver_id_idx" ON "reviews" ("driver_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_refresh_token_hash_idx" ON "sessions" ("refresh_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "users" ("email");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" ("phone_number");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" ("role");--> statement-breakpoint
CREATE INDEX "wallet_transactions_user_id_idx" ON "wallet_transactions" ("user_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_user_id_created_at_idx" ON "wallet_transactions" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_restaurant_id_restaurants_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "customization_groups" ADD CONSTRAINT "customization_groups_menu_item_id_menu_items_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "customization_options" ADD CONSTRAINT "customization_options_group_id_customization_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "customization_groups"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_requests" ADD CONSTRAINT "delivery_requests_driver_id_drivers_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id");--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_approved_by_users_id_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_restaurant_id_restaurants_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_menu_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_order_item_id_order_items_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_ZiJD9h1eVIvc_fkey" FOREIGN KEY ("customization_option_id") REFERENCES "customization_options"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_restaurant_id_restaurants_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_driver_id_drivers_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_address_id_addresses_id_fkey" FOREIGN KEY ("delivery_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_users_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_restaurant_id_restaurants_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_driver_id_drivers_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;