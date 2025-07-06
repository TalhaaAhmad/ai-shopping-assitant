import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex";
import { DynamicStructuredTool } from "langchain/tools";
import { z } from "zod";
import { Id } from "@/convex/_generated/dataModel";

// Define the order interface (matches Convex document structure)
interface Order {
  _id: Id<"orders">;
  _creationTime: number;
  userId: string;
  productIds: Id<"products">[];
  totalAmount: number;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  createdAt: number;
  shippingAddress: {
    street: string;
    city: string;
    zip: string;
    country: string;
  };
}

interface Product {
  _id: Id<"products">;
  name: string;
  price: number;
  inStock: boolean;
}

// 1. ORDER STATUS TOOL
export const orderStatusTool = new DynamicStructuredTool({
  name: "checkOrderStatus",
  description: 
    "Check the status of orders. Can lookup by order ID or show all orders for a user. Provides detailed order information including items, status, and shipping details.",
  schema: z.object({
    userId: z.string().describe("The user ID to check orders for"),
    orderId: z.string().optional().describe("Specific order ID to check (optional)"),
    query: z.string().describe("Natural language query about order status"),
  }),
  func: async ({ userId, orderId, query }) => {
    try {
      const convexClient = getConvexClient();
      const lowerQuery = query.toLowerCase();

      // If specific order ID is provided
      if (orderId) {
        try {
          const order = await convexClient.query(api.orders.getOrderById, { 
            orderId: orderId as Id<"orders"> 
          }) as Order | null;
          
          if (!order) {
            return "Order not found. Please check the order ID and try again.";
          }

          if (order.userId !== userId) {
            return "You don't have permission to view this order.";
          }

          return await formatOrderDetails(order, convexClient);
        } catch (error) {
          return "Invalid order ID format or order not found.";
        }
      }

      // Get all orders for the user
      const orders = await convexClient.query(api.orders.getOrdersByUser, { userId });

      if (!orders || orders.length === 0) {
        return "You don't have any orders yet.";
      }

      // Check if user is asking for recent orders
      if (lowerQuery.includes("recent") || lowerQuery.includes("latest")) {
        const recentOrder = orders[0]; // Orders are sorted by date desc
        return await formatOrderDetails(recentOrder, convexClient);
      }

      // Check if user is asking for orders by status
      const statusKeywords = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
      const requestedStatus = statusKeywords.find(status => lowerQuery.includes(status));
      
      if (requestedStatus) {
        const filteredOrders = orders.filter(order => order.status === requestedStatus);
        if (filteredOrders.length === 0) {
          return `You don't have any ${requestedStatus} orders.`;
        }
        
        const ordersList = filteredOrders.map(order => 
          `Order ${order._id}: ${order.status.toUpperCase()} - $${order.totalAmount.toFixed(2)} (${new Date(order.createdAt).toLocaleDateString()})`
        ).join("\n");
        
        return `Your ${requestedStatus} orders:\n${ordersList}`;
      }

      // Default: show all orders summary
      const ordersList = orders.slice(0, 10).map(order => 
        `Order ${order._id}: ${order.status.toUpperCase()} - $${order.totalAmount.toFixed(2)} (${new Date(order.createdAt).toLocaleDateString()})`
      ).join("\n");
      
      const moreOrders = orders.length > 10 ? `\n... and ${orders.length - 10} more orders` : "";
      
      return `Your orders:\n${ordersList}${moreOrders}`;

    } catch (error) {
      console.error("Error checking order status:", error);
      return "Sorry, there was an error retrieving your order information. Please try again later.";
    }
  },
});

// 2. CANCEL ORDER TOOL
export const cancelOrderTool = new DynamicStructuredTool({
  name: "cancelOrder",
  description: 
    "Cancel an order. Only pending and confirmed orders can be cancelled. Provides confirmation of cancellation.",
  schema: z.object({
    userId: z.string().describe("The user ID requesting cancellation"),
    orderId: z.string().describe("The order ID to cancel"),
    reason: z.string().optional().describe("Optional reason for cancellation"),
  }),
  func: async ({ userId, orderId, reason }) => {
    try {
      const convexClient = getConvexClient();

      // Get the order first
      let order: Order | null;
      try {
        order = await convexClient.query(api.orders.getOrderById, { 
          orderId: orderId as Id<"orders"> 
        }) as Order | null;
      } catch (error) {
        return "Invalid order ID format or order not found.";
      }

      if (!order) {
        return "Order not found. Please check the order ID and try again.";
      }

      // Verify user owns the order
      if (order.userId !== userId) {
        return "You don't have permission to cancel this order.";
      }

      // Check if order can be cancelled
      if (order.status === "cancelled") {
        return "This order is already cancelled.";
      }

      if (order.status === "delivered") {
        return "Cannot cancel a delivered order. Please contact customer support for returns.";
      }

      if (order.status === "shipped") {
        return "Cannot cancel a shipped order. Please contact customer support to arrange a return.";
      }

      // Cancel the order
      await convexClient.mutation(api.orders.updateOrderStatus, {
        orderId: orderId as Id<"orders">,
        status: "cancelled",
      });

      const reasonText = reason ? `\nReason: ${reason}` : "";

      return `Order ${orderId} has been successfully cancelled.
Status: CANCELLED
Original Amount: $${order.totalAmount.toFixed(2)}${reasonText}

If you were charged, a refund will be processed within 3-5 business days.`;

    } catch (error) {
      console.error("Error cancelling order:", error);
      return "Sorry, there was an error cancelling your order. Please try again later or contact customer support.";
    }
  },
});

// 3. UPDATE ORDER TOOL (for admin/system use)
export const updateOrderTool = new DynamicStructuredTool({
  name: "updateOrder",
  description: 
    "Update order status or shipping address. Typically used by admin/system to update order progress (confirm, ship, deliver).",
  schema: z.object({
    orderId: z.string().describe("The order ID to update"),
    updates: z.object({
      status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]).optional(),
      shippingAddress: z.object({
        street: z.string(),
        city: z.string(),
        zip: z.string(),
        country: z.string(),
      }).optional(),
    }).describe("Updates to apply to the order"),
    updateReason: z.string().optional().describe("Reason for the update"),
  }),
  func: async ({ orderId, updates, updateReason }) => {
    try {
      const convexClient = getConvexClient();

      // Get the order first
      let order: Order | null;
      try {
        order = await convexClient.query(api.orders.getOrderById, { 
          orderId: orderId as Id<"orders"> 
        }) as Order | null;
      } catch (error) {
        return "Invalid order ID format or order not found.";
      }

      if (!order) {
        return "Order not found. Please check the order ID and try again.";
      }

      // Validate status transitions
      if (updates.status) {
        const validTransitions: Record<string, string[]> = {
          pending: ["confirmed", "cancelled"],
          confirmed: ["shipped", "cancelled"],
          shipped: ["delivered"],
          delivered: [], // Cannot change from delivered
          cancelled: [], // Cannot change from cancelled
        };

        if (!validTransitions[order.status].includes(updates.status)) {
          return `Cannot update order status from ${order.status} to ${updates.status}. Invalid status transition.`;
        }
      }

      const updateData: any = {};
      const changes: string[] = [];

      // Update status if provided
      if (updates.status && updates.status !== order.status) {
        updateData.status = updates.status;
        changes.push(`Status: ${order.status} → ${updates.status}`);
      }

      // Update shipping address if provided
      if (updates.shippingAddress) {
        updateData.shippingAddress = updates.shippingAddress;
        changes.push("Shipping address updated");
      }

      if (Object.keys(updateData).length === 0) {
        return "No changes were made to the order.";
      }

      // Apply updates
      if (updateData.status) {
        await convexClient.mutation(api.orders.updateOrderStatus, {
          orderId: orderId as Id<"orders">,
          status: updateData.status,
        });
      }

      if (updateData.shippingAddress) {
        await convexClient.mutation(api.orders.updateShippingAddress, {
          orderId: orderId as Id<"orders">,
          shippingAddress: updateData.shippingAddress,
        });
      }

      const reasonText = updateReason ? `\nReason: ${updateReason}` : "";
      const changesText = changes.join("\n");

      return `Order ${orderId} has been successfully updated.

Changes made:
${changesText}${reasonText}

Updated on: ${new Date().toLocaleString()}`;

    } catch (error) {
      console.error("Error updating order:", error);
      return "Sorry, there was an error updating the order. Please try again later.";
    }
  },
});

// Helper function to format order details
async function formatOrderDetails(order: Order, convexClient: any): Promise<string> {
  try {
    // Get product details for the order
    const products = await convexClient.query(api.products.getAllProducts, {}) as Product[];
    const orderProducts = products.filter((p: Product) => 
      order.productIds.includes(p._id)
    );

    // Count quantities
    const productCounts: Record<string, {product: Product, quantity: number}> = {};
    order.productIds.forEach(productId => {
      const product = orderProducts.find(p => p._id === productId);
      if (product) {
        const key = product._id;
        if (productCounts[key]) {
          productCounts[key].quantity++;
        } else {
          productCounts[key] = { product, quantity: 1 };
        }
      }
    });

    const itemsList = Object.values(productCounts).map(item => 
      `${item.quantity}x ${item.product.name} ($${item.product.price} each)`
    ).join("\n");

    return `Order Details:
Order ID: ${order._id}
Status: ${order.status.toUpperCase()}
Order Date: ${new Date(order.createdAt).toLocaleString()}

Items:
${itemsList}

Total Amount: $${order.totalAmount.toFixed(2)}

Shipping Address:
${order.shippingAddress.street}
${order.shippingAddress.city}, ${order.shippingAddress.zip}
${order.shippingAddress.country}`;

  } catch (error) {
    return `Order ${order._id}: ${order.status.toUpperCase()} - $${order.totalAmount.toFixed(2)} (${new Date(order.createdAt).toLocaleDateString()})`;
  }
}