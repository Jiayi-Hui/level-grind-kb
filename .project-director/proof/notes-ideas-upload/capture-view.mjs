import fs from "node:fs/promises";

const [, , label, output, widthArg] = process.argv;
const viewportWidth = Number(widthArg || 1440);
const pages = await (await fetch("http://127.0.0.1:9223/json/list")).json();
const page = pages.find((entry) => entry.type === "page");
if (!page) throw new Error("No Chrome page found");
const socket = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
};
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
await call("Emulation.setDeviceMetricsOverride", { width: viewportWidth, height: 1000, deviceScaleFactor: 1, mobile: viewportWidth < 700 });
await call("Runtime.evaluate", { expression: `location.reload()` });
await new Promise((resolve) => setTimeout(resolve, 500));
if (viewportWidth < 700) await call("Runtime.evaluate", { expression: `document.querySelector('.mobile-menu')?.click()` });
await call("Runtime.evaluate", { expression: `([...document.querySelectorAll('button')].find((node) => node.textContent?.includes(${JSON.stringify(label)})))?.click()` });
await new Promise((resolve) => setTimeout(resolve, 700));
const metrics = await call("Page.getLayoutMetrics");
const width = Math.min(1600, Math.ceil(metrics.cssContentSize.width));
const height = Math.min(2200, Math.ceil(metrics.cssContentSize.height));
const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
await fs.writeFile(output, Buffer.from(shot.data, "base64"));
socket.close();
