import { useEffect } from 'react';

/** While the table is up, the browser's own bars and the page behind them go dark with it, as a photo viewer's do. */
export function useDarkPage(active: boolean, color: string) {
  useEffect(() => {
    if (!active) return undefined;
    const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
    const themes = metas.map((meta) => meta.getAttribute('content'));
    metas.forEach((meta) => meta.setAttribute('content', color));
    // Most pages name no colour of their own: this one does while it's up.
    const added = metas.length ? null : Object.assign(document.createElement('meta'), { name: 'theme-color', content: color });
    if (added) document.head.append(added);
    const root = document.documentElement.style.background;
    const body = document.body.style.background;
    document.documentElement.style.background = color;
    document.body.style.background = color;
    return () => {
      metas.forEach((meta, i) => { const theme = themes[i]; if (theme !== null) meta.setAttribute('content', theme); });
      added?.remove();
      document.documentElement.style.background = root;
      document.body.style.background = body;
    };
  }, [active, color]);
}
