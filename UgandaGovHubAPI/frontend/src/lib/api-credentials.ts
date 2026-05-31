type LocationLike = Pick<Location, 'origin'>;

type FetchUrlInput = string | URL | { url: string };

function parseUrl(value: string | URL, locationOrigin: string) {
  try {
    return new URL(value instanceof URL ? value.toString() : value, locationOrigin);
  } catch {
    return null;
  }
}

function isApiPath(pathname: string) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function pathMatchesBase(pathname: string, basePathname: string) {
  const basePath = basePathname.replace(/\/+$/, '') || '/';
  return basePath === '/' || pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function fetchInputUrl(input: FetchUrlInput) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function isCredentialedApiRequest(
  inputUrl: string | URL,
  apiBase: string,
  locationLike: LocationLike = window.location,
) {
  const requestUrl = parseUrl(inputUrl, locationLike.origin);
  if (!requestUrl) return false;

  if (requestUrl.origin === locationLike.origin && isApiPath(requestUrl.pathname)) {
    return true;
  }

  const apiBaseUrl = parseUrl(apiBase || locationLike.origin, locationLike.origin);
  if (!apiBaseUrl) return false;

  return requestUrl.origin === apiBaseUrl.origin && pathMatchesBase(requestUrl.pathname, apiBaseUrl.pathname);
}
