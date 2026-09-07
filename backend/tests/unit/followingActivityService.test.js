const { loadFollowingActivity, QUERY_CONCURRENCY } = require('../../services/followingActivityService');

it('bounds outstanding database requests for large follow lists', async () => {
  let active = 0; let peak = 0; let completed = 0;
  const db = { from: jest.fn(() => {
    const query = {};
    for (const method of ['select', 'eq', 'is', 'or', 'order', 'limit']) query[method] = () => query;
    query.then = (resolve, reject) => new Promise((done) => {
      active++; peak = Math.max(peak, active);
      setImmediate(() => { active--; completed++; done({ data: [], error: null }); });
    }).then(resolve, reject);
    return query;
  }) };
  const memberships = Array.from({ length: 17 }, (_, id) => ({ id, persona_id: `beacon-${id}` }));
  const result = await loadFollowingActivity(memberships, { db });
  expect(peak).toBe(QUERY_CONCURRENCY);
  expect(completed).toBe(memberships.length);
  expect(result.map((row) => row.membership.id)).toEqual(memberships.map((row) => row.id));
});

it('rejects the whole result when one Beacon lookup fails', async () => {
  const db = { from: () => {
    const query = {};
    for (const method of ['select', 'eq', 'is', 'or', 'order']) query[method] = () => query;
    query.limit = async () => ({ data: null, error: new Error('database unavailable') });
    return query;
  } };
  await expect(loadFollowingActivity([{ persona_id: 'beacon' }], { db })).rejects.toThrow('database unavailable');
});
