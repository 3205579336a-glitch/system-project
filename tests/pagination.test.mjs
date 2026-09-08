import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAllPages } from '../lib/pagination.ts';

const createPageFetcher = (records, calls) => async (from, to) => {
  calls.push([from, to]);
  return {
    data: records.slice(from, to + 1),
    error: null,
  };
};

test('fetches more than the Supabase 1000-row response limit', async () => {
  const records = Array.from({ length: 2350 }, (_, id) => ({ id }));
  const calls = [];

  const result = await fetchAllPages(createPageFetcher(records, calls));

  assert.equal(result.length, 2350);
  assert.deepEqual(result, records);
  assert.deepEqual(calls, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});

test('requests one final empty page when the total is an exact page multiple', async () => {
  const records = Array.from({ length: 2000 }, (_, id) => ({ id }));
  const calls = [];

  const result = await fetchAllPages(createPageFetcher(records, calls));

  assert.equal(result.length, 2000);
  assert.deepEqual(calls, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});

test('stops and propagates a database page error', async () => {
  const databaseError = new Error('database unavailable');

  await assert.rejects(
    fetchAllPages(async () => ({ data: null, error: databaseError })),
    databaseError,
  );
});
