export async function resolveCatalogSpecInput(
  body: Record<string, unknown> | null | undefined,
  fetchSpecFromUrl: (specUrl: string) => Promise<string>,
) {
  const inlineSpec = typeof body?.openapi_spec === 'string' ? body.openapi_spec : '';
  if (inlineSpec.trim()) return inlineSpec;

  const specUrl = typeof body?.specUrl === 'string' ? body.specUrl.trim() : '';
  if (specUrl) {
    try {
      return await fetchSpecFromUrl(specUrl);
    } catch (err: any) {
      throw Object.assign(new Error(err?.message || 'Failed to fetch spec from URL.'), {
        code: 'SPEC_URL_FETCH_FAILED',
      });
    }
  }

  throw Object.assign(new Error('openapi_spec or specUrl is required.'), {
    code: 'SPEC_INPUT_REQUIRED',
  });
}
