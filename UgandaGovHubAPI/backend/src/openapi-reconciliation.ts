export const BUNDLED_OPENAPI_FILES = new Set([
  'driving-permit.yaml',
  'nira-identity.yaml',
  'service-uganda.yaml',
  'ura-tax.yaml',
  'ursb-business.yaml',
  'api-reg-dc0ab166-b497-4da5-b78d-7bfad6cf9b32.yaml',
]);

export function shouldRemoveOpenApiFile(
  file: string,
  knownPaths: Set<string>,
  bundledFiles = BUNDLED_OPENAPI_FILES,
) {
  if (!file.endsWith('.yaml') && !file.endsWith('.json')) return false;
  return !knownPaths.has(file) && !bundledFiles.has(file);
}
