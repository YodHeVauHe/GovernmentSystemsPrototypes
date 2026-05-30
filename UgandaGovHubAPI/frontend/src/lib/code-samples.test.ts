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

const hostileSamples = buildCodeSamples({
  method: "post'; throw new Error('owned');//",
  url: 'https://api.example.test/messages',
  headers: {
    "X-Test'; touch /tmp/owned; #": "value'withquote",
  },
});

const hostileCurlSample = hostileSamples.find(item => item.language === 'cURL')?.value || '';
assert.equal(hostileCurlSample.includes("post'; throw"), false);
assert.equal(hostileCurlSample.includes("touch /tmp/owned; #"), true);
assert.equal(hostileCurlSample.includes("-H 'X-Test'; touch /tmp/owned; #"), false);

const hostileJavaScriptSample = hostileSamples.find(item => item.language === 'JavaScript')?.value || '';
assert.equal(hostileJavaScriptSample.includes("method: 'POST'; THROW"), false);
assert.equal(hostileJavaScriptSample.includes('"POST\'; THROW NEW ERROR(\'OWNED\');//"'), true);

const hostilePythonSample = hostileSamples.find(item => item.language === 'Python')?.value || '';
assert.equal(hostilePythonSample.includes("'POST'; THROW"), false);
assert.equal(hostilePythonSample.includes("'POST\\'; THROW NEW ERROR(\\'OWNED\\');//',"), true);

const hostileJavaSample = hostileSamples.find(item => item.language === 'Java')?.value || '';
assert.equal(hostileJavaSample.includes('.method("POST"; THROW'), false);
assert.equal(hostileJavaSample.includes('.method("POST\'; THROW NEW ERROR(\'OWNED\');//",'), true);

console.log('code sample tests passed');
