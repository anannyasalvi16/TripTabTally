/**
 * Validates and sanitizes destination URL to prevent open redirect vulnerabilities.
 * Only internal, relative paths starting with a single '/' are accepted.
 */
export function sanitizeNextUrl(rawNext: string | null | undefined): string {
  if (!rawNext || typeof rawNext !== 'string') {
    return '/trips';
  }

  const trimmed = rawNext.trim();

  // Must begin with a single slash, cannot be protocol-relative (//),
  // cannot contain backslashes, and cannot have URL scheme prefixes.
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.includes('\\') &&
    !/^\/[/\\]/.test(trimmed) &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
  ) {
    return trimmed;
  }

  return '/trips';
}
