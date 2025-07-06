   // convex/products.ts
   import { query } from "./_generated/server";
   export const getAllProducts = query({
     args: {},
     handler: async (ctx) => {
       return await ctx.db.query("products").collect();
     },
   });