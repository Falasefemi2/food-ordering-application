import { describe, it, expect } from "vitest";
import {
	users,
	addresses,
	restaurants,
	drivers,
	menuCategories,
	menuItems,
	customizationGroups,
	customizationOptions,
	coupons,
	orders,
	orderItems,
	orderItemCustomizations,
	reviews,
	payments,
} from "../src/db/schema";
import { getTableName } from "drizzle-orm";

describe("Production Database Schema Compilation & Structure", () => {
	it("should define users table correctly", () => {
		expect(users).toBeDefined();
		expect(getTableName(users)).toBe("users");
		expect(users.id).toBeDefined();
		expect(users.firstName).toBeDefined();
		expect(users.lastName).toBeDefined();
		expect(users.email).toBeDefined();
		expect(users.phoneNumber).toBeDefined();
		expect(users.passwordHash).toBeDefined();
		expect(users.role).toBeDefined();
		expect(users.avatarUrl).toBeDefined();
		expect(users.isActive).toBeDefined();
		expect(users.createdAt).toBeDefined();
		expect(users.updatedAt).toBeDefined();
		expect(users.deletedAt).toBeDefined();
	});

	it("should define addresses table correctly", () => {
		expect(addresses).toBeDefined();
		expect(getTableName(addresses)).toBe("addresses");
		expect(addresses.id).toBeDefined();
		expect(addresses.userId).toBeDefined();
		expect(addresses.label).toBeDefined();
		expect(addresses.addressLine1).toBeDefined();
		expect(addresses.city).toBeDefined();
		expect(addresses.latitude).toBeDefined();
		expect(addresses.longitude).toBeDefined();
	});

	it("should define restaurants table correctly with correct spelling", () => {
		expect(restaurants).toBeDefined();
		expect(getTableName(restaurants)).toBe("restaurants");
		expect(restaurants.id).toBeDefined();
		expect(restaurants.ownerId).toBeDefined();
		expect(restaurants.name).toBeDefined();
		expect(restaurants.isOpen).toBeDefined();
		expect(restaurants.estimatedPrepTime).toBeDefined();
		expect(restaurants.ratingAvg).toBeDefined();
		expect(restaurants.ratingCount).toBeDefined();
	});

	it("should define drivers table correctly", () => {
		expect(drivers).toBeDefined();
		expect(getTableName(drivers)).toBe("drivers");
		expect(drivers.id).toBeDefined();
		expect(drivers.userId).toBeDefined();
		expect(drivers.status).toBeDefined();
		expect(drivers.vehicleType).toBeDefined();
	});

	it("should define menu categories and items tables correctly", () => {
		expect(menuCategories).toBeDefined();
		expect(getTableName(menuCategories)).toBe("menu_categories");
		expect(menuCategories.restaurantId).toBeDefined();
		expect(getTableName(menuItems)).toBe("menu_items");

		expect(menuItems).toBeDefined();
		expect(menuItems.categoryId).toBeDefined();
		expect(menuItems.price).toBeDefined();
	});

	it("should define customization groups and options tables correctly", () => {
		expect(customizationGroups).toBeDefined();
		expect(getTableName(customizationGroups)).toBe(
			"customization_groups",
		);
		expect(customizationGroups.menuItemId).toBeDefined();
		expect(getTableName(customizationOptions)).toBe(
			"customization_options",
		);
		expect(customizationOptions).toBeDefined();
		expect(customizationOptions.groupId).toBeDefined();
		expect(customizationOptions.price).toBeDefined();
	});

	it("should define coupons table correctly", () => {
		expect(coupons).toBeDefined();
		expect(getTableName(coupons)).toBe("coupons");

		expect(getTableName(restaurants)).toBe("restaurants");
		expect(coupons.code).toBeDefined();
		expect(coupons.discountType).toBeDefined();
	});

	it("should define orders, orderItems, and orderItemCustomizations tables correctly", () => {
		expect(orders).toBeDefined();
		expect(getTableName(orders)).toBe("orders");
		expect(orders.customerId).toBeDefined();
		expect(orders.restaurantId).toBeDefined();
		expect(orders.totalPrice).toBeDefined();

		expect(orderItems).toBeDefined();
		expect(getTableName(orderItems)).toBe("order_items");
		expect(orderItems.orderId).toBeDefined();
		expect(orderItems.itemName).toBeDefined();
		expect(getTableName(orderItemCustomizations)).toBe(
			"order_item_customizations",
		);
		expect(orderItemCustomizations).toBeDefined();
		expect(orderItemCustomizations.orderItemId).toBeDefined();
	});

	it("should define reviews and payments tables correctly", () => {
		expect(reviews).toBeDefined();
		expect(getTableName(reviews)).toBe("reviews");
		expect(reviews.orderId).toBeDefined();
		expect(reviews.rating).toBeDefined();
		expect(getTableName(payments)).toBe("payments");
		expect(payments).toBeDefined();
		expect(payments.orderId).toBeDefined();
		expect(payments.gatewayReference).toBeDefined();
	});
});
