import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex";
import { DynamicStructuredTool } from "langchain/tools";
import { z } from "zod";
import { Id } from "@/convex/_generated/dataModel";

// Product interface
interface Product {
  _id: Id<"products">;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  inStock: boolean;
  category: string;
  tags: string[];
  createdAt: number;
}

const orderTakingTool = new DynamicStructuredTool({
  name: "takeOrder",
  description: "Handles order creation. Accepts natural language orders and shipping address.",
  schema: z.object({
    customer: z.string().describe("Customer full name"),
    email: z.string().email().describe("Customer email address"),
    orderRequest: z.string().describe("Natural language order request with product names and quantities"),
    shippingAddress: z.object({
      street: z.string(),
      city: z.string(),
      zip: z.string(),
      country: z.string()
    }),
  }),
  func: async ({ customer, email, orderRequest, shippingAddress }) => {
    try {
      const convexClient = getConvexClient();

      const products = (await convexClient.query(api.products.getAllProducts, {})) as Product[];
      if (!products.length) {
        return "No products are available at the moment.";
      }

      const orderItems = parseOrderRequest(orderRequest, products);
      if (orderItems.length === 0) {
        return "No valid products found in the order request.";
      }

      const unavailableItems = orderItems.filter(item => !item.product.inStock);
      if (unavailableItems.length > 0) {
        const names = unavailableItems.map(item => item.product.name).join(", ");
        return `The following items are out of stock: ${names}`;
      }

      const total = orderItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      const itemsCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const shippingAddressString = `${shippingAddress.street}, ${shippingAddress.city}, ${shippingAddress.zip}, ${shippingAddress.country}`;

      const orderProducts = orderItems.map(item => ({
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
      }));

      // Create the order using new schemas
      const { orderIdFormatted } = await convexClient.mutation(api.orders.createOrder, {
        customer,
        email,
        status: "pending",
        payment: "pending",
        fulfillment: "Unfulfilled",
        shippingAddress: shippingAddressString,
        products: orderProducts,
      });

      const itemsSummary = orderItems.map(
        item => `${item.quantity}x ${item.product.name} ($${item.product.price} each)`
      ).join("\n");

      return `✅ Order Created Successfully!
Order ID: ${orderIdFormatted}
Customer: ${customer}
Items:\n${itemsSummary}
Total: $${total.toFixed(2)}
Status: Pending
Shipping to: ${shippingAddressString}`;
    } catch (err) {
      console.error("Order creation failed:", err);
      return "Failed to process the order. Please try again later.";
    }
  }
});

// Helper function to parse natural language
function parseOrderRequest(orderRequest: string, products: Product[]): Array<{ product: Product; quantity: number }> {
  const orderItems: Array<{ product: Product; quantity: number }> = [];
  const lowerRequest = orderRequest.toLowerCase();

  const patterns = [
    /(\d+)\s*x?\s*(.+)/g,
    /(\d+)\s*(.+)/g,
    /(one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)/g,
  ];

  const numberWords: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(lowerRequest)) !== null) {
      let quantity = parseInt(match[1]);
      if (isNaN(quantity)) quantity = numberWords[match[1]] || 0;
      if (quantity > 0) {
        const productName = match[2].trim().replace(/s$/, '');
        const product = products.find(p =>
          p.name.toLowerCase().includes(productName) ||
          productName.includes(p.name.toLowerCase()) ||
          p.tags.some(tag => tag.toLowerCase().includes(productName)) ||
          p.category.toLowerCase().includes(productName)
        );
        if (product) {
          const existing = orderItems.find(i => i.product._id === product._id);
          if (existing) existing.quantity += quantity;
          else orderItems.push({ product, quantity });
        }
      }
    }
  }

  if (orderItems.length === 0) {
    for (const product of products) {
      if (
        lowerRequest.includes(product.name.toLowerCase()) ||
        product.tags.some(tag => lowerRequest.includes(tag.toLowerCase()))
      ) {
        orderItems.push({ product, quantity: 1 });
      }
    }
  }

  return orderItems;
}

export default orderTakingTool;
