export const CATALOG_PATH = '/catalog';
export const SEARCHABLE_APP_ROUTES = [CATALOG_PATH, '/docs', '/dashboard'] as const;

const knownExactRoutes = [
  '/',
  CATALOG_PATH,
  '/catalog/add',
  '/dashboard',
  '/account/settings',
  '/docs',
  '/help',
] as const;

export function isKnownAppRoute(pathname: string) {
  return knownExactRoutes.includes(pathname as (typeof knownExactRoutes)[number]) ||
    pathname.startsWith('/docs/') ||
    pathname.startsWith('/api/');
}

export function isPublicAppRoute(pathname: string) {
  return pathname === '/' || pathname === '/docs' || pathname.startsWith('/docs/');
}

export function getShellTitle(pathname: string) {
  if (pathname === '/') return 'Uganda GovHub API';
  if (pathname === '/dashboard') return 'Dashboard';
  if (pathname === '/catalog/add') return 'Add API';
  if (pathname.startsWith('/api/')) return 'API Details';
  if (pathname === '/docs' || pathname.startsWith('/docs/')) return 'API Docs';
  if (pathname === CATALOG_PATH) return 'API Catalog';
  return 'API Catalog';
}

export function isSearchableAppRoute(pathname: string) {
  return SEARCHABLE_APP_ROUTES.includes(pathname as (typeof SEARCHABLE_APP_ROUTES)[number]);
}

export function getSearchFallbackPathname() {
  return CATALOG_PATH;
}
