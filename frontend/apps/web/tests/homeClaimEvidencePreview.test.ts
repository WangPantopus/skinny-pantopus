import { prepareEvidencePreview } from '../src/components/home/PrivateClaimEvidencePreview';

test.each([
  ['application/pdf; charset=binary', '%PDF-1.4', 'pdf'],
  ['image/jpeg', new Uint8Array([255, 216, 255, 224]), 'image'],
  ['image/png', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), 'image'],
  ['image/webp', 'RIFF0000WEBP', 'image'],
  ['image/heif', '0000ftypmif1', 'image'],
])('supported bytes have a constrained %s renderer', async (mime, body, kind) => {
  const preview = await prepareEvidencePreview(new Blob([body], { type: mime as string }));
  expect(preview.kind).toBe(kind);
  if (preview.kind !== 'text') expect(preview.bytes.type).toBe((mime as string).split(';')[0]);
});

test.each(['image/jpeg', 'image/png', 'image/webp', 'image/heif'])('mismatched bytes cannot become a %s preview', async mime => {
  await expect(prepareEvidencePreview(new Blob(['<html>wrong</html>'], { type: mime }))).rejects.toThrow('does not match');
});

test('empty, oversized and binary plain-text files cannot be reviewed', async () => {
  await expect(prepareEvidencePreview(new Blob([], { type: 'text/plain' }))).rejects.toThrow('25 MB');
  await expect(prepareEvidencePreview({ size: 26 * 1024 * 1024 } as Blob)).rejects.toThrow('25 MB');
  await expect(prepareEvidencePreview(new Blob(['text\0binary'], { type: 'text/plain' }))).rejects.toThrow('does not match');
});
