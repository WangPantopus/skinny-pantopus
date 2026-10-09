const net = require('node:net');

/**
 * The client's rate-limit key from its IP. An IPv6 client usually holds a whole /64, so
 * single addresses would let one client rotate past any limit: IPv6 is keyed by its /64.
 * IPv4 (including IPv4-mapped IPv6) stays per address.
 */
function clientIpKey(req) {
  const ip = String(req.ip || '').split('%')[0].toLowerCase();
  if (!net.isIPv6(ip)) return ip;
  if (ip.startsWith('::ffff:') && net.isIPv4(ip.slice(7))) return ip.slice(7);
  const [head, tail] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return `${groups.slice(0, 4).map((g) => g.padStart(4, '0')).join(':')}::/64`;
}

module.exports = { clientIpKey };
