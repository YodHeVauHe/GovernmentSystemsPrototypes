import assert from 'assert/strict';
import {
  CATALOG_VIEW_MODE_STORAGE_KEY,
  readCatalogViewModePreference,
  writeCatalogViewModePreference,
} from './catalog-view-helpers.ts';

function createStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key) || null : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

const catalogViewStorage = createStorage();

assert.equal(readCatalogViewModePreference(catalogViewStorage), 'list');
writeCatalogViewModePreference(catalogViewStorage, 'grid');
assert.equal(readCatalogViewModePreference(catalogViewStorage), 'grid');
writeCatalogViewModePreference(catalogViewStorage, 'list');
assert.equal(readCatalogViewModePreference(catalogViewStorage), 'list');

const malformedViewStorage = createStorage({
  [CATALOG_VIEW_MODE_STORAGE_KEY]: 'cards',
});

assert.equal(readCatalogViewModePreference(malformedViewStorage), 'list');

console.log('catalog view helper tests passed');
