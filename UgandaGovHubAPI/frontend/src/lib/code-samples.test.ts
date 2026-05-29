import assert from 'assert/strict';
import { buildCodeSamples } from './code-samples.ts';

function sample(language: ReturnType<typeof buildCodeSamples>[number]['language']) {
  return buildCodeSamples({
    method: 'post',
    url: "https://api.example.test/verify?source=o'hara",
    body: {
      active: true,
      note: null,
    },
  }).find(item => item.language === language)?.value || '';
}

const pythonSample = sample('Python');
assert.equal(pythonSample.includes('active: true'), false);
assert.equal(pythonSample.includes('note: null'), false);
assert.equal(pythonSample.includes("'active': True"), true);
assert.equal(pythonSample.includes("'note': None"), true);

const stringBodyJavaScriptSample = buildCodeSamples({
  method: 'post',
  url: 'https://api.example.test/messages',
  body: 'plain text',
}).find(item => item.language === 'JavaScript')?.value || '';

assert.equal(stringBodyJavaScriptSample.includes('body: JSON.stringify("plain text")'), true);

console.log('code sample tests passed');
