// convex/orders.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new order
export const createOrder = mutation({
  args: {
    userId: v.string(),
    productIds: v.array(v.id("products")),
    totalAmount: v.number(),
    shippingAddress: v.object({
      street: v.string(),
      city: v.string(),
      zip: v.string(),
      country: v.string(),
    }),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const orderId = await ctx.db.insert("orders", {
      userId: args.userId,
      productIds: args.productIds,
      totalAmount: args.totalAmount,
      status: args.status,
      createdAt: Date.now(),
      shippingAddress: args.shippingAddress,
    });
    
    return orderId;
  },
});

// Get orders by user ID
export const getOrdersByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get a specific order by ID
export const getOrderById = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.orderId);
  },
});

// Update order status
export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      status: args.status,
    });
  },
});

// Update shipping address
export const updateShippingAddress = mutation({
  args: {
    orderId: v.id("orders"),
    shippingAddress: v.object({
      street: v.string(),
      city: v.string(),
      zip: v.string(),
      country: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      shippingAddress: args.shippingAddress,
    });
  },
});

// Get all orders (admin function)
export const getAllOrders = query({
  handler: async (ctx) => {
    return await ctx.db.query("orders").order("desc").collect();
  },
});