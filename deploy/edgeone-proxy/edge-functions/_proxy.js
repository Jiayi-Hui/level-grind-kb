const ORIGIN = "https://origin.level-grind.com";

function rewriteLocation(value, publicOrigin) {
  if (!value) return value;
  return value
    .replaceAll("https://origin.level-grind.com", publicOrigin)
    .replaceAll("http://origin.level-grind.com", publicOrigin);
}

function rewriteCookie(value) {
  if (!value) return value;
  return value
    .replace(/;\s*Domain=\.?origin\.level-grind\.com/gi, "")
    .replace(/;\s*Domain=\.?chatgpt\.site/gi, "");
}

export async function proxyRequest(context) {
  const incoming = context.request;
  const incomingUrl = new URL(incoming.url);
  const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, ORIGIN);
  const headers = new Headers(incoming.headers);

  headers.delete("host");
  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

  const init = {
    method: incoming.method,
    headers,
    redirect: "manual",
  };

  if (!["GET", "HEAD"].includes(incoming.method)) {
    init.body = incoming.body;
  }

  const upstream = await fetch(upstreamUrl, init);
  const responseHeaders = new Headers(upstream.headers);
  const publicOrigin = `${incomingUrl.protocol}//${incomingUrl.host}`;

  if (responseHeaders.has("location")) {
    responseHeaders.set(
      "location",
      rewriteLocation(responseHeaders.get("location"), publicOrigin),
    );
  }

  if (responseHeaders.has("set-cookie")) {
    responseHeaders.set(
      "set-cookie",
      rewriteCookie(responseHeaders.get("set-cookie")),
    );
  }

  responseHeaders.set("x-level-grind-proxy", "edgeone-makers");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
