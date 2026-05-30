import assert from 'assert/strict';
import { validateVerificationDocumentInput } from './account-verification';

function validPublicDeveloperDocument(overrides: Record<string, unknown> = {}) {
  return {
    type: 'national_id_front',
    label: 'Client supplied label should not be trusted',
    file_name: 'front.png',
    mime_type: 'image/png',
    storage_ref: 's3://govhub-vault/docs/national_id_front_1780000000000_front.png',
    ...overrides,
  };
}

function assertInvalid(overrides: Record<string, unknown>, expectedCode: string) {
  const result = validateVerificationDocumentInput('public_developer', validPublicDeveloperDocument(overrides));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, expectedCode);
  }
}

function main() {
  const validImage = validateVerificationDocumentInput('public_developer', validPublicDeveloperDocument());
  assert.equal(validImage.ok, true);
  if (validImage.ok) {
    assert.equal(validImage.value.type, 'national_id_front');
    assert.equal(validImage.value.label, 'National ID front image');
    assert.equal(validImage.value.file_name, 'front.png');
    assert.equal(validImage.value.mime_type, 'image/png');
  }

  const validPdf = validateVerificationDocumentInput(
    'public_developer',
    validPublicDeveloperDocument({
      type: 'nin_confirmation',
      file_name: 'nin-confirmation.pdf',
      mime_type: 'application/pdf',
      storage_ref: 'metadata://usr-public/nin-confirmation.pdf',
    }),
  );
  assert.equal(validPdf.ok, true);

  assertInvalid({ type: 'mda_authorization_letter' }, 'INVALID_DOCUMENT_TYPE');
  assertInvalid({ mime_type: 'application/pdf' }, 'INVALID_DOCUMENT_MIME');
  assertInvalid({ file_name: '../front.png' }, 'INVALID_DOCUMENT_FILE_NAME');
  assertInvalid({ storage_ref: 'https://evil.example/front.png' }, 'INVALID_DOCUMENT_STORAGE_REF');
  assertInvalid({ storage_ref: 'local/../../secrets/front.png' }, 'INVALID_DOCUMENT_STORAGE_REF');
  assertInvalid({ storage_ref: 's3://govhub-vault/docs/../other/front.png' }, 'INVALID_DOCUMENT_STORAGE_REF');
  assertInvalid({ storage_ref: 'metadata://usr-public/../front.png' }, 'INVALID_DOCUMENT_STORAGE_REF');
}

main();
console.log('account verification document validation tests passed');
