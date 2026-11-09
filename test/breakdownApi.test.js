import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BREAKDOWN_API_URL, fetchBreakdowns, OresApiError } from '../src/ores/breakdownApi.js';
import { fakeFetch, outageAtAddress } from './fixtures.js';

test('fetchBreakdowns returns the incident list', async () => {
  let url;
  const fetchImpl = async (u, options) => {
    url = u;
    assert.ok(options.signal, 'every call has a timeout');
    return fakeFetch([outageAtAddress()])();
  };
  const list = await fetchBreakdowns({ fetchImpl });
  assert.equal(url, BREAKDOWN_API_URL);
  assert.equal(list.length, 1);
});

test('an HTTP error, a network error or an unexpected body are errors', async () => {
  await assert.rejects(
    fetchBreakdowns({ fetchImpl: fakeFetch([], { status: 503 }) }),
    OresApiError,
  );
  await assert.rejects(
    fetchBreakdowns({ fetchImpl: fakeFetch({ items: [] }) }),
    /unexpected format/,
  );
  await assert.rejects(
    fetchBreakdowns({
      fetchImpl: async () => {
        throw new Error('ECONNRESET');
      },
    }),
    /unreachable/,
  );
});
