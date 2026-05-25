export function resolveApiBase(
  explicitBase: string | undefined,
  locationLike: Pick<Location, 'protocol' | 'hostname'> = window.location,
) {
  if (explicitBase) return explicitBase;
  const protocol = locationLike.protocol === 'https:' ? 'https:' : 'http:';
  const hostname = locationLike.hostname || 'localhost';
  return `${protocol}//${hostname}:4000`;
}

export const API_BASE = resolveApiBase(import.meta.env.VITE_API_BASE_URL);
