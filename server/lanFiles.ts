import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import type { IncomingMessage } from "node:http";

export type FileDirection = "phone-to-pc" | "pc-to-phone";

export type LanFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  direction: FileDirection;
};

const dataDir = path.join(process.cwd(), ".lanbeam-data");
const filesDir = path.join(dataDir, "files");
const indexPath = path.join(dataDir, "index.json");

async function ensureStore() {
  await fsp.mkdir(filesDir, { recursive: true });
}

async function readIndex(): Promise<LanFile[]> {
  await ensureStore();
  try {
    const raw = await fsp.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LanFile[]) : [];
  } catch {
    return [];
  }
}

async function writeIndex(files: LanFile[]) {
  await ensureStore();
  await fsp.writeFile(indexPath, JSON.stringify(files.slice(0, 100), null, 2), "utf8");
}

function safeName(input: string) {
  let decoded = input;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    decoded = input;
  }

  const basename = decoded.replaceAll("\\", "/").split("/").pop() || "file";
  const cleaned = basename.replace(/[\u0000-\u001f<>:"|?*]/g, "_").trim();
  return cleaned.slice(0, 180) || "file";
}

export async function listLanFiles() {
  const files = await readIndex();
  return files.sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));
}

export async function storeIncomingFile(
  request: IncomingMessage,
  inputName: string,
  mimeType: string,
  direction: FileDirection,
) {
  await ensureStore();
  const id = crypto.randomUUID();
  const tempPath = path.join(filesDir, `${id}.part`);
  const finalPath = path.join(filesDir, id);
  let size = 0;

  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      callback(null, chunk);
    },
  });

  try {
    await pipeline(request, counter, fs.createWriteStream(tempPath, { flags: "wx" }));
    await fsp.rename(tempPath, finalPath);

    const record: LanFile = {
      id,
      name: safeName(inputName),
      size,
      mimeType: mimeType || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
      direction,
    };

    const files = await readIndex();
    await writeIndex([record, ...files.filter((file) => file.id !== id)]);
    return record;
  } catch (error) {
    await fsp.rm(tempPath, { force: true });
    await fsp.rm(finalPath, { force: true });
    throw error;
  }
}

export async function getLanFile(id: string) {
  const files = await readIndex();
  const record = files.find((file) => file.id === id);
  if (!record) return null;

  const filePath = path.join(filesDir, record.id);
  try {
    await fsp.access(filePath, fs.constants.R_OK);
  } catch {
    return null;
  }

  return { record, filePath };
}
