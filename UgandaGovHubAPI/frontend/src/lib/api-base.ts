export function resolveApiBase(
  explicitBase: string | undefined,
  locationLike: Pick<Location, 'protocol' | 'hostname' | 'origin'> = window.location,
) {
  if (explicitBase) return explicitBase;
  const hostname = locationLike.hostname || 'localhost';
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const protocol = locationLike.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${hostname}:4000`;
  }
  return locationLike.origin || '';
}

export const API_BASE = resolveApiBase(import.meta.env.VITE_API_BASE_URL);
