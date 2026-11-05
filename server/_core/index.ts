import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getLanFile, listLanFiles, storeIncomingFile, type FileDirection } from "../lanFiles";
import { readLanText, writeLanText } from "../lanText";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // JSON/form parsers stay separate from the raw upload stream.
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });

  app.get("/api/lan/status", async (_req, res) => {
    const files = await listLanFiles();
    res.json({ status: "ready", filesCount: files.length, serverTime: new Date().toISOString() });
  });

  app.get("/api/lan/files", async (_req, res) => {
    res.json(await listLanFiles());
  });

  app.get("/api/lan/text", async (_req, res) => {
    res.json(await readLanText());
  });

  app.put("/api/lan/text", async (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    res.json(await writeLanText(text));
  });

  app.post("/api/lan/upload", async (req, res) => {
    const headerValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
    const directionHeader = headerValue(req.headers["x-lan-direction"]);
    const direction: FileDirection = directionHeader === "pc-to-phone" ? "pc-to-phone" : "phone-to-pc";
    const fileName = headerValue(req.headers["x-file-name"]) || "file";
    const mimeType = headerValue(req.headers["content-type"]);

    try {
      const record = await storeIncomingFile(req, fileName, mimeType, direction);
      res.status(201).json(record);
    } catch (error) {
      console.error("[LanBeam] Upload failed:", error);
      if (!res.headersSent) res.status(500).json({ error: "Не удалось сохранить файл" });
    }
  });

  app.get("/api/lan/files/:id/download", async (req, res) => {
    const file = await getLanFile(req.params.id);
    if (!file) {
      res.status(404).json({ error: "Файл не найден" });
      return;
    }

    res.download(file.filePath, file.record.name, {
      headers: { "Content-Type": file.record.mimeType },
    });
  });

  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const launchedFromBuild = process.argv[1]?.replaceAll("\\", "/").endsWith("dist/index.js") === true;
  const isProduction = process.env.NODE_ENV === "production" || process.env.LANBEAM_PRODUCTION === "1" || launchedFromBuild;
  if (!isProduction) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });
