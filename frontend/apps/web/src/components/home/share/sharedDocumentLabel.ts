// A shared document's view carries the stored `mime_type` and `doc_type`
// (home_external_share_resource); it never carries a `file_type`, which is why
// both public pages badged every document "PDF". The repo has no shared
// MIME-to-label helper (PrivateClaimEvidencePreview keeps a private image/pdf
// extension map), so this one is scoped to the share pages.
const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOC',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLS',
  'text/plain': 'TXT',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'IMG',
  'image/heic': 'IMG',
  'image/heif': 'IMG',
};

export function sharedDocumentLabel(document: { mime_type?: unknown; doc_type?: unknown }): string {
  const mime = typeof document.mime_type === 'string' ? document.mime_type.toLowerCase() : '';
  if (MIME_LABELS[mime]) return MIME_LABELS[mime];
  if (mime.startsWith('image/')) return 'IMG';
  const kind = typeof document.doc_type === 'string' ? document.doc_type : '';
  return kind ? kind.replace(/_/g, ' ').slice(0, 3).toUpperCase() : 'DOC';
}
