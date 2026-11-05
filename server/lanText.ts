import fs from "node:fs/promises";
import path from "node:path";

export type LanText = {
  text: string;
  updatedAt: string | null;
};

const dataDir = path.join(process.cwd(), ".lanbeam-data");
const textPath = path.join(dataDir, "text.json");

export async function readLanText(): Promise<LanText> {
  try {
    const raw = await fs.readFile(textPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LanText>;
    return {
      text: typeof parsed.text === "string" ? parsed.text : "",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return { text: "", updatedAt: null };
  }
}

export async function writeLanText(text: string): Promise<LanText> {
  await fs.mkdir(dataDir, { recursive: true });
  const value: LanText = { text: text.slice(0, 10000), updatedAt: new Date().toISOString() };
  await fs.writeFile(textPath, JSON.stringify(value, null, 2), "utf8");
  return value;
}
