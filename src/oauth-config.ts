export type OAuthConfig = {
  issuer: string;
  resource: string;
  exchangeUrl: string;
  exchangeSecret: string;
  challenge: string;
};

/** Validate once at startup. The MCP process never needs a delegation signing key. */
export function readOAuthConfig(
  get: (key: string) => string | undefined,
): OAuthConfig | undefined {
  const names = [
    'OAUTH_ISSUER',
    'OAUTH_RESOURCE',
    'MCP_AUTH_EXCHANGE_URL',
    'OAUTH_EXCHANGE_SECRET',
  ] as const;
  const values = names.map((name) => get(name));
  if (values.every((value) => !value)) return undefined;
  if (values.some((value) => !value))
    throw new Error(
      'OAuth configuration requires all four OAuth environment variables',
    );
  const [issuer, resource, exchangeUrl, exchangeSecret] = values as [
    string,
    string,
    string,
    string,
  ];
  for (const [index, value] of [issuer, resource, exchangeUrl].entries()) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`Invalid OAuth URL: ${names[index]}`);
    }
    const local =
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.hostname.endsWith('.localhost');
    if (
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && (index === 2 || local)))
    ) {
      throw new Error(`Invalid OAuth URL: ${names[index]}`);
    }
  }
  if (exchangeSecret.length < 32)
    throw new Error('OAUTH_EXCHANGE_SECRET must be at least 32 characters');
  const metadata = new URL(
    '/.well-known/oauth-protected-resource/mcp',
    resource,
  ).href;
  return {
    issuer,
    resource,
    exchangeUrl,
    exchangeSecret,
    challenge: `Bearer resource_metadata="${metadata}"`,
  };
}
