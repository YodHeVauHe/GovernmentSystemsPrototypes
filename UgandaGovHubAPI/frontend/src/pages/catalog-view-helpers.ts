export type CatalogViewMode = 'list' | 'grid';

export type CatalogViewPreferenceStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const CATALOG_VIEW_MODE_STORAGE_KEY = 'govhub.catalog.viewMode';

function isCatalogViewMode(value: unknown): value is CatalogViewMode {
  return value === 'list' || value === 'grid';
}

export function readCatalogViewModePreference(
  storage: CatalogViewPreferenceStorage,
  fallback: CatalogViewMode = 'list'
) {
  try {
    const storedViewMode = storage.getItem(CATALOG_VIEW_MODE_STORAGE_KEY);
    return isCatalogViewMode(storedViewMode) ? storedViewMode : fallback;
  } catch {
    return fallback;
  }
}

export function writeCatalogViewModePreference(
  storage: CatalogViewPreferenceStorage,
  viewMode: CatalogViewMode
) {
  try {
    storage.setItem(CATALOG_VIEW_MODE_STORAGE_KEY, viewMode);
  } catch {
    // Storage is a preference cache only; private mode or quota failures should not break the catalog.
  }
}
