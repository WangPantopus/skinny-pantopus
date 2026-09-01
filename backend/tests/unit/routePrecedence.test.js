// ============================================================
// TEST: Route Precedence — Business Seat Routes (AUTH-2.2)
//
// Verifies that businessSeatRoutes (static paths like /my-seats,
// /seats/accept-invite) are mounted BEFORE businessRoutes
// (which has a /:businessId catch-all) in the Express app.
// ============================================================

const fs = require('fs');
const path = require('path');

describe('Route precedence: businessSeatRoutes before businessRoutes', () => {
  const appSource = fs.readFileSync(
    path.join(__dirname, '../../app.js'),
    'utf8',
  );

  // Extract all app.use('/api/businesses', ...) lines in order
  const mountLines = appSource
    .split('\n')
    .filter((line) => /app\.use\('\/api\/businesses'/.test(line));

  test('businessSeatRoutes is mounted before businessRoutes', () => {
    const seatIndex = mountLines.findIndex((l) => l.includes('businessSeatRoutes'));
    const bizIndex = mountLines.findIndex((l) =>
      l.includes('businessRoutes') && !l.includes('Seat') && !l.includes('Iam') &&
      !l.includes('Discovery') && !l.includes('Founding') && !l.includes('Verification') &&
      !l.includes('PublicPage'),
    );

    expect(seatIndex).toBeGreaterThan(-1);
    expect(bizIndex).toBeGreaterThan(-1);
    expect(seatIndex).toBeLessThan(bizIndex);
  });

  test('businessSeatRoutes router exposes /my-seats as a GET route', () => {
    const seatRouter = require('../../routes/businessSeats');
    const route = seatRouter.stack.find(
      (layer) => layer.route && layer.route.path === '/my-seats' && layer.route.methods.get,
    );
    expect(route).toBeDefined();
  });

  test('businessSeatRoutes router exposes /seats/invite-details as a GET route', () => {
    const seatRouter = require('../../routes/businessSeats');
    const route = seatRouter.stack.find(
      (layer) => layer.route && layer.route.path === '/seats/invite-details' && layer.route.methods.get,
    );
    expect(route).toBeDefined();
  });

  test('businessSeatRoutes router exposes /seats/accept-invite as a POST route', () => {
    const seatRouter = require('../../routes/businessSeats');
    const route = seatRouter.stack.find(
      (layer) => layer.route && layer.route.path === '/seats/accept-invite' && layer.route.methods.post,
    );
    expect(route).toBeDefined();
  });
});
