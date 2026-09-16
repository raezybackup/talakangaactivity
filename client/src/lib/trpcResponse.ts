export async function fetchTrpcResponse(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response;

  const text = await response.text();
  if (response.ok) {
    return new Response(text, { status: response.status, headers: { "Content-Type": "application/json" } });
  }

  let message = text || `Request failed with status ${response.status}`;
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    message = parsed.error || parsed.message || message;
  } catch {
    // Keep the plain-text failure message.
  }
  const payload = [{ error: { json: { message, data: { code: "INTERNAL_SERVER_ERROR" } } } }];
  return new Response(JSON.stringify(payload), { status: response.status, headers: { "Content-Type": "application/json" } });
}
