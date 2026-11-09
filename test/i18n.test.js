// Every user-facing text exists in the four languages of the integration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatDate, LANGUAGES, MESSAGES, ml, resolveLanguage, tr } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

test('every message exists in English, French, German and Spanish', () => {
  for (const [key, message] of Object.entries(MESSAGES)) {
    assert.deepEqual(Object.keys(message).sort(), [...LANGUAGES].sort(), key);
    const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const lang of LANGUAGES) {
      assert.deepEqual(placeholders(message[lang]), placeholders(message.en), `${key}.${lang}`);
    }
  }
});

test('every multi-language text of the manifest has the four languages', () => {
  const texts = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${path}[${i}]`));
    } else if (node && typeof node === 'object') {
      if (typeof node.en === 'string') {
        texts.push([path, node]);
        return;
      }
      for (const [key, child] of Object.entries(node)) walk(child, `${path}.${key}`);
    }
  };
  walk(manifest, 'manifest');
  assert.ok(texts.length > 50);
  for (const [path, text] of texts) {
    assert.deepEqual(Object.keys(text).sort(), [...LANGUAGES].sort(), path);
  }
});

test('docs exist in the four languages', async () => {
  for (const lang of LANGUAGES) {
    const doc = await readFile(new URL(`../docs/${lang}.md`, import.meta.url), 'utf8');
    assert.ok(doc.length > 500, `docs/${lang}.md`);
  }
});

test('language helpers', () => {
  assert.equal(resolveLanguage('de-BE'), 'de');
  assert.equal(resolveLanguage('nl'), 'en');
  assert.equal(tr('es', 'refresh'), 'Actualizar');
  assert.equal(ml('inProgressCount', { count: 3 }).fr, '3 en cours');
  assert.equal(formatDate(new Date('2026-11-09T12:00:00Z'), 'fr'), '09/11 13:00');
  assert.equal(formatDate(null, 'de'), 'unbekannt');
});
