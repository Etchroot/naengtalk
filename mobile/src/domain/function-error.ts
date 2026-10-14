const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function messageFromFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context: unknown }).context : null;
  if (!(context instanceof Response)) return fallback;
  const requestId = context.headers.get('x-request-id');
  const withTrackingNumber = (message: string) => requestId && UUID_PATTERN.test(requestId)
    ? `${message}\n오류 추적 번호: ${requestId}`
    : message;
  try {
    const body: unknown = await context.clone().json();
    if (body && typeof body === 'object' && 'error' in body
      && typeof body.error === 'string' && body.error.length <= 200) {
      return withTrackingNumber(body.error);
    }
  } catch {
    // A non-JSON upstream response is not safe to show to the user.
  }
  return withTrackingNumber(fallback);
}
