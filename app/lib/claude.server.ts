import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ParsedItem = {
  name: string;
  category: string;
  quantity: number;
  unit: string | null;
  unit_price: number | null;
  total_price: number;
};

export type ParsedReceipt = {
  store_name: string | null;
  purchased_at: string;
  total_amount: number | null;
  items: ParsedItem[];
};

export async function parseReceiptImage(
  base64Image: string,
  mediaType: string
): Promise<ParsedReceipt> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64Image,
            },
          },
          {
            type: "text",
            text: `Parse this grocery/store receipt. Return ONLY a JSON object with this exact structure, no other text:
{
  "store_name": "store name or null",
  "purchased_at": "YYYY-MM-DD",
  "total_amount": 0.00,
  "items": [
    {
      "name": "item name",
      "category": "one of: Protein, Grains, Vegetables, Fruits, Dairy, Beverages, Snacks, Household, Other",
      "quantity": 1,
      "unit": "lb/oz/kg/each/pack/etc or null",
      "unit_price": 0.00,
      "total_price": 0.00
    }
  ]
}

Category guide:
- Protein: meat, poultry, fish, seafood, eggs, tofu, beans, legumes
- Grains: rice, quinoa, pasta, bread, oats, flour, cereal, tortillas
- Vegetables: all fresh, frozen, or canned vegetables
- Fruits: all fresh, frozen, or canned fruits
- Dairy: milk, cheese, yogurt, butter, cream
- Beverages: drinks, juice, water, soda, coffee, tea, wine, beer
- Snacks: chips, cookies, crackers, candy, nuts
- Household: cleaning supplies, paper products, toiletries, detergent
- Other: everything else

Skip tax lines, subtotals, and payment method lines — only include actual purchased items.`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude returned no JSON");
  return JSON.parse(jsonMatch[0]) as ParsedReceipt;
}
