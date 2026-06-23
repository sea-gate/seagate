import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = ".data/receipts";

export type StoredItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string | null;
  unit_price: number | null;
  total_price: number;
};

export type StoredReceipt = {
  id: string;
  store_name: string | null;
  purchased_at: string;
  total_amount: number | null;
  items: StoredItem[];
  created_at: string;
};

export async function saveReceipt(
  data: Omit<StoredReceipt, "id" | "created_at">
): Promise<StoredReceipt> {
  await mkdir(DATA_DIR, { recursive: true });
  const receipt: StoredReceipt = {
    ...data,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  await writeFile(join(DATA_DIR, `${receipt.id}.json`), JSON.stringify(receipt, null, 2));
  return receipt;
}

export async function loadReceipt(id: string): Promise<StoredReceipt | null> {
  try {
    const raw = await readFile(join(DATA_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as StoredReceipt;
  } catch {
    return null;
  }
}

export async function loadAllReceipts(): Promise<StoredReceipt[]> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const files = await readdir(DATA_DIR);
    const receipts = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map((f) => loadReceipt(f.replace(".json", "")))
    );
    return (receipts.filter(Boolean) as StoredReceipt[]).sort(
      (a, b) => b.purchased_at.localeCompare(a.purchased_at)
    );
  } catch {
    return [];
  }
}
