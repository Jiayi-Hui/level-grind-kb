// A provider response has exactly one body consumer. Do not clone successful
// SSE responses: an unconsumed clone branch can buffer the whole generation and
// does not recover a body that a runtime has already locked.
export function providerStreamReader(response) {
  if (!response?.body || response.bodyUsed) {
    const error = new Error("模型流无法读取；服务将自动切换兼容模式。");
    error.code = "PROVIDER_STREAM_UNREADABLE";
    throw error;
  }
  try {
    return response.body.getReader();
  } catch {
    // `bodyUsed` can still be false when another runtime component has locked
    // the stream. Convert platform-specific errors such as "Body is unusable"
    // into the same actionable message.
    const error = new Error("模型流无法读取；服务将自动切换兼容模式。");
    error.code = "PROVIDER_STREAM_UNREADABLE";
    throw error;
  }
}
