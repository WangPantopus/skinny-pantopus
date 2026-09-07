const { safeRedirectPath } = require('../../utils/authRedirect');
test.each(['/app/place?preview=0123456789abcdef', '/app/feed/post/p?comment=c', '/persona/garden', '/@garden', '/invite/seat?token=x'])('keeps the internal destination %s', (target) => expect(safeRedirectPath(target)).toBe(target));
test.each(['https://evil.test', '//evil.test', '/app/../login', '/app/%252e%252e/login', '/app/%5cevil', '/app/%0a/evil', '/login', ['//evil.test']])('rejects unsafe email continuation %s', (target) => expect(safeRedirectPath(target)).toBe('/app/place'));
