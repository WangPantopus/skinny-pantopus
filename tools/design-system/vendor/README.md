# Vendored runtime

React 18.3.1 production UMD builds (MIT license, copyright Facebook, Inc. and its affiliates; license headers intact).

The design-system page runs component previews on React 18. The web app ships React 19, which has no UMD build. So these two files are packed into `components/lib/`, which also lets `--check` run offline.

| File | sha256 |
| --- | --- |
| `react.production.min.js` | `d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd` |
| `react-dom.production.min.js` | `35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d` |

They come from the Design System artifact type's packed runtime, and the published system serves the same bytes. To check them against npm, download `react@18.3.1` and `react-dom@18.3.1` with `npm pack`, then compare the files under `package/umd/`.
