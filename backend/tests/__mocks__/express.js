/**
 * Express mock that delegates to the real express module.
 *
 * Provides a real express() factory and real Router() so that tests
 * using supertest (chat, reactions) get a fully functional app,
 * while route-extraction tests (landlordTenant) also work since
 * real routers have a `.stack` property.
 *
 * The only thing we override is that Router() returns a real router
 * wrapped so `typeof router === 'function'` works correctly.
 */

// Bypass moduleNameMapper by resolving the real express package path
const actualExpress = require(require.resolve('express', { paths: [process.cwd()] }));

// Re-export real express as-is — all functionality preserved
module.exports = actualExpress;
