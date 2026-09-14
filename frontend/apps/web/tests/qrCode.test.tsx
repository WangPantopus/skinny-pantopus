import { render, screen } from '@testing-library/react';
import jsQR from 'jsqr';
import QRCode from '../src/components/ui/QRCode';
import { TextEncoder } from 'util';

beforeAll(() => { Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder }); });

test.each(['guest', 'shared', 'invite'])('rendered %s QR decodes to the complete exact token URL', kind => {
  const value = `https://pantopus.example/${kind}/${'a8'.repeat(32)}`;
  render(<QRCode value={value} label="Generated share code" />);
  const svg = screen.getByRole('img', { name: 'Generated share code' });
  const modules = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
  const scale = 5;
  const width = modules * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  // Rasterize the actual SVG's unit-square path, then use an independent QR
  // decoder. A decorative hash pattern or truncated token cannot pass this.
  for (const match of svg.querySelector('path')!.getAttribute('d')!.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    const left = Number(match[1]) * scale;
    const top = Number(match[2]) * scale;
    for (let y = top; y < top + scale; y += 1) {
      for (let x = left; x < left + scale; x += 1) {
        const offset = (y * width + x) * 4;
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
      }
    }
  }
  expect(jsQR(pixels, width, width)?.data).toBe(value);
});
