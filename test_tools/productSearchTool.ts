import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex";
import { DynamicStructuredTool } from "langchain/tools";
import { z } from "zod"; // Make sure to install 'zod' with: pnpm add zod

// Define the product type according to your Convex schema
interface Product {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  inStock: boolean;
  category: string;
  tags: string[];
  createdAt: number;
}

const productSearchTool = new DynamicStructuredTool({
  name: "searchProducts",
  description:
    "Handles natural language product queries: search, recommend, price lookup, etc. Returns product name, price, description, category, tags, and stock status.",
  schema: z.object({
    query: z.string().describe("The user's natural language product query"),
  }),
  func: async ({ query }: { query: string }) => {
    const convexClient = getConvexClient();
    // Fetch all products from Convex
    const products = (await convexClient.query(api.products.getAllProducts, {})) as Product[];
    const lowerQuery = query.toLowerCase();

    // Price lookup: "price of X"
    const priceMatch = lowerQuery.match(/price of ([\w\s]+)/);
    if (priceMatch) {
      const name = priceMatch[1].trim();
      const found = products.find((p: Product) => p.name.toLowerCase().includes(name));
      if (found) {
        return `${found.name}: $${found.price} (${found.inStock ? "In stock" : "Out of stock"})`;
      }
      return "Sorry, I couldn't find that product.";
    }

    // Recommend for traveling or by category/tag
    if (lowerQuery.includes("recommend")) {
      // Try to extract a category or tag
      const travelKeywords = ["travel", "trip", "vacation", "journey"];
      const foundKeyword = travelKeywords.find(k => lowerQuery.includes(k));
      let recommended: Product[] = [];
      if (foundKeyword) {
        recommended = products.filter(
          (p: Product) =>
            p.category.toLowerCase().includes(foundKeyword) ||
            p.tags.some((tag: string) => tag.toLowerCase().includes(foundKeyword)) ||
            p.description.toLowerCase().includes(foundKeyword)
        );
      } else {
        // Fallback: recommend in-stock products
        recommended = products.filter((p: Product) => p.inStock);
      }
      if (recommended.length) {
        return recommended
          .map(
            (p: Product) =>
              `${p.name} ($${p.price}) - ${p.category} - ${p.inStock ? "In stock" : "Out of stock"}`
          )
          .join("\n");
      }
      return "Sorry, I couldn't find any suitable recommendations.";
    }

    // General search by product/category/tag/description
    const searchWords = lowerQuery.match(/\w+/g) || [];
    const found = products.filter((p: Product) =>
      searchWords.some(
        (w: string) =>
          p.name.toLowerCase().includes(w) ||
          p.category.toLowerCase().includes(w) ||
          p.tags.some((tag: string) => tag.toLowerCase().includes(w)) ||
          p.description.toLowerCase().includes(w)
      )
    );
    if (found.length) {
      return found
        .map(
          (p: Product) =>
            `${p.name} ($${p.price}) - ${p.category} - ${p.description} - ${p.inStock ? "In stock" : "Out of stock"}`
        )
        .join("\n");
    }

    // Fallback: show all in-stock products
    const inStock = products.filter((p: Product) => p.inStock);
    if (inStock.length) {
      return inStock
        .map(
          (p: Product) =>
            `${p.name} ($${p.price}) - ${p.category} - ${p.inStock ? "In stock" : "Out of stock"}`
        )
        .join("\n");
    }
    return "No products found.";
  },
});

export default productSearchTool; 