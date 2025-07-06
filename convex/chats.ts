import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createOrder = mutation({
  args: {
    userId: v.string(), // Accept userId as parameter
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
    // No need to get user identity from ctx.auth anymore
    console.log("🔍 Creating order for user:", args.userId);
    
    const orderId = await ctx.db.insert("orders", {
      userId: args.userId,
      productIds: args.productIds,
      totalAmount: args.totalAmount,
      status: args.status,
      createdAt: Date.now(),
      shippingAddress: args.shippingAddress,
    });
    
    console.log("✅ Order created with ID:", orderId);
    return orderId;
  },
});




export const createChat = mutation ({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) =>  {
    console.log("🔍 [CHATS] Attempting to get user identity...");
    const identity = await ctx.auth.getUserIdentity(); 
    console.log("🔍 [CHATS] Identity result:", identity);
    
    if (!identity) {
      console.log("❌ [CHATS] No identity found - user not authenticated");
      throw new Error("Not authenticated");
    }
    
    console.log("✅ [CHATS] User ID extracted:", identity.subject);
    const chat = await ctx.db.insert("chats", {
      title: args.title,
      userId: identity.subject,
      createdAt: Date.now(),
    });

    console.log("✅ [CHATS] Chat created with ID:", chat);
    return chat;
  }
});

export const deleteChat = mutation({
  args: { id: v.id("chats") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const chat = await ctx.db.get(args.id);
    if (!chat || chat.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    // Delete all messages in the chat
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.id))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the chat
    await ctx.db.delete(args.id);
  }
});

export const listChats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const chats = await ctx.db
      .query("chats")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    return chats;
  }
});

export const getChat = query({
  args: { id: v.id("chats"), userId: v.string() },
  handler: async (ctx, args) => {
    try {
      const chat = await ctx.db.get(args.id);

      // Return null if chat doesn't exist or user is not authorized
      if (!chat || chat.userId !== args.userId) {
        console.log("❌ Chat not found or unauthorized", {
          chatExists: !!chat,
          chatUserId: chat?.userId,
          requestUserId: args.userId,
        });
        return null;
      }

      console.log("✅ Chat found and authorized");
      return chat;
    } catch (error) {
      console.error("🔥 Error in getChat:", error);
      return null;
    }
  },
});
