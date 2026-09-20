export async function messageFromFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context: unknown }).context : null;
  if (!(context instanceof Response)) return fallback;
  try {
    const body: unknown = await context.clone().json();
    if (body && typeof body === 'object' && 'error' in body
      && typeof body.error === 'string' && body.error.length <= 200) {
      return body.error;
    }
  } catch {
    // A non-JSON upstream response is not safe to show to the user.
  }
  return fallback;
}
