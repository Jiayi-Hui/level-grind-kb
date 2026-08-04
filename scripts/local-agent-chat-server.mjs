#!/usr/bin/env node

/**
 * Local-only bridge for testing the exact EdgeOne AskAI function behind the
 * Vite UI. It listens only on loopback, loads ignored `.dev.vars` server-side,
 * and never exposes or prints a credential to the browser or terminal.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { onRequestGet, onRequestPost } from "../public/cloud-functions/api/agent-chat.js";

const host = "127.0.0.1";
const port = Number(process.env.ASKAI_LOCAL_PORT || 8788);
const varsPath = resolve(process.cwd(), ".dev.vars");

function cleanEnvValue(raw) {
  const value = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

async function localEnv() {
  try {
    const source = await readFile(varsPath, "utf8");
    return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return [];
      const separator = trimmed.indexOf("=");
      if (separator <= 0) return [];
      return [[trimmed.slice(0, separator).trim(), cleanEnvValue(trimmed.slice(separator + 1))]];
    }));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw new Error("无法读取本地 .dev.vars；请检查文件权限或格式。");
  }
}

function readiness(env) {
  return {
    clerk: Boolean(env.CLERK_SECRET_KEY),
    deepseek: Boolean(env.AI_API_KEY || env.DEEPSEEK_API_KEY),
    tavily: Boolean(env.TAVILY_API_KEY),
    openrouter: Boolean(env.OPENROUTER_API_KEY),
  };
}

function headersFromNode(headers) {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === "undefined") continue;
    result.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  return result;
}

function requestFromNode(request) {
  const method = request.method || "GET";
  return new Request(`http://${host}:${port}${request.url || "/"}`, {
    method,
    headers: headersFromNode(request.headers),
    ...(["GET", "HEAD"].includes(method) ? {} : { body: Readable.toWeb(request), duplex: "half" }),
  });
}

async function writeFetchResponse(response, nodeResponse) {
  const headers = Object.fromEntries(response.headers.entries());
  nodeResponse.writeHead(response.status, headers);
  if (!response.body) {
    nodeResponse.end();
    return;
  }
  for await (const chunk of Readable.fromWeb(response.body)) nodeResponse.write(chunk);
  nodeResponse.end();
}

const fileEnv = await localEnv();
const env = { ...fileEnv, ...process.env };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url || "/", `http://${host}:${port}`).pathname;
    if (pathname !== "/api/agent-chat") {
      response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: "Not found" }));
      return;
    }
    const workerRequest = requestFromNode(request);
    const workerResponse = request.method === "GET"
      ? await onRequestGet({ request: workerRequest, env })
      : request.method === "POST"
        ? await onRequestPost({ request: workerRequest, env })
        : new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
    await writeFetchResponse(workerResponse, response);
  } catch {
    // Do not return upstream/configuration internals from the local bridge.
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ ok: false, error: "本地 AskAI 函数暂时不可用。请检查本地运行说明。" }));
  }
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    service: "level-grind-local-agent-chat",
    host,
    port,
    envSource: ".dev.vars + process env (values hidden)",
    configuration: readiness(env),
  }));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
