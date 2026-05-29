import assert from 'assert/strict';
import { exec, many, one, run } from './db';

assert.equal(typeof one, 'function');
assert.equal(typeof many, 'function');
assert.equal(typeof run, 'function');
assert.equal(typeof exec, 'function');

console.log('db helper tests passed');
