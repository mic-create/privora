import { test } from 'node:test';
import assert from 'node:assert';
import { validateSignalingMessage } from '../src/utils/validator.js';

test('validateSignalingMessage rejects non-string input', () => {
    const result = validateSignalingMessage(12345);
    assert.strictEqual(result.valid, false);
});

test('validateSignalingMessage rejects malformed JSON', () => {
    const result = validateSignalingMessage('{invalid json');
    assert.strictEqual(result.valid, false);
});

test('validateSignalingMessage rejects unknown message types', () => {
    const result = validateSignalingMessage(JSON.stringify({ type: 'UNKNOWN_ACTION' }));
    assert.strictEqual(result.valid, false);
});

test('validateSignalingMessage accepts valid CREATE_ROOM message', () => {
    const result = validateSignalingMessage(JSON.stringify({ type: 'CREATE_ROOM' }));
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.data.type, 'CREATE_ROOM');
});