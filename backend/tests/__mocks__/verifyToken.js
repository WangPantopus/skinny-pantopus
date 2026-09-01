// Stub verifyToken — sets req.user from x-test-user-id header or default
const verifyToken = (req, _res, next) => {
  const role = req.headers['x-test-role'] || 'user';
  if (req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'], role };
  } else {
    req.user = { id: 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa', role };
  }
  next();
};

verifyToken.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Platform admin access required' });
  }
  next();
};

verifyToken.invalidateRoleCache = () => {}; // no-op stub for AUTH-3.4

module.exports = verifyToken;
module.exports.requireAdmin = verifyToken.requireAdmin;
module.exports.invalidateRoleCache = verifyToken.invalidateRoleCache;
