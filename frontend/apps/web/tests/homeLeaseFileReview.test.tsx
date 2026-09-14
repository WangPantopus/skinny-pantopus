import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import type { landlord } from '@pantopus/api';
import RequestsTab from '@/components/landlord/RequestsTab';

jest.mock('@pantopus/api', () => ({
  tenant: { getLeaseFileSession: jest.fn(), downloadLeaseFile: jest.fn() },
  landlord: { approveLease: jest.fn(), denyLease: jest.fn() },
  onTokenChange: jest.fn(() => () => {}), AUTH_SESSION_CHANGE_KEY: 'pantopus_auth_session_change',
}));
const home = 'b0000000-0000-4000-8000-000000000001';
const actor = 'b0000000-0000-4000-8000-000000000002';
const lease = 'b0000000-0000-4000-8000-000000000003';
const id = 'b0000000-0000-4000-8000-000000000004';
const other = 'b0000000-0000-4000-8000-000000000005';
const session = { home_id: home, actor_id: actor, session_scope: 'a'.repeat(64) };
const record = { id, home_id: home, lease_id: lease, file_name: 'lease.txt', file_size: 5, mime_type: 'text/plain', available: true };
const request = { id: lease, home_id: home, state: 'pending', source: 'tenant_request', start_at: '2026-09-14', end_at: null,
  created_at: '2026-09-14T00:00:00Z', metadata: { lease_file_id: id },
  primary_resident: { id: actor, name: 'Applicant', username: 'applicant' } } as landlord.TenantRequest;
let current = true;
let tokenChange: () => void;
const props = () => ({ homeId: home, authorityId: other, requests: [request], isCurrent: () => current, onRefresh: jest.fn() });
const result = () => ({ file: record, bytes: new Blob(['lease'], { type: 'text/plain' }) });
beforeEach(() => {
  current = true; jest.clearAllMocks();
  (api.onTokenChange as jest.Mock).mockImplementation(listener => { tokenChange = listener; return () => {}; });
  (api.tenant.getLeaseFileSession as jest.Mock).mockResolvedValue(session);
  (api.tenant.downloadLeaseFile as jest.Mock).mockResolvedValue(result());
  URL.createObjectURL = jest.fn(() => 'blob:private-lease'); URL.revokeObjectURL = jest.fn();
});
function open() { fireEvent.click(screen.getByRole('button', { name: 'Open private lease file' })); }
test('the existing request card opens authorized bytes only after an explicit click and makes no lease decision', async () => {
  render(<RequestsTab {...props()} />);
  expect(api.tenant.downloadLeaseFile).not.toHaveBeenCalled();
  open();
  expect(await screen.findByTitle('Private lease file')).toHaveTextContent('lease');
  expect(api.tenant.downloadLeaseFile).toHaveBeenCalledWith(session, id);
  expect(api.landlord.approveLease).not.toHaveBeenCalled();
  expect(api.landlord.denyLease).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Close file' }));
  expect(screen.queryByTitle('Private lease file')).not.toBeInTheDocument();
});
test.each(['denied', 'other-lease', 'invalid-bytes'])('%s cannot display a private document', async kind => {
  if (kind === 'denied') (api.tenant.downloadLeaseFile as jest.Mock).mockRejectedValue(new Error('Access denied'));
  if (kind === 'other-lease') (api.tenant.downloadLeaseFile as jest.Mock).mockResolvedValue({ ...result(), file: { ...record, lease_id: other } });
  if (kind === 'invalid-bytes') (api.tenant.downloadLeaseFile as jest.Mock).mockResolvedValue({ ...result(), bytes: new Blob(['<script>untrusted</script>'], { type: 'text/html' }) });
  render(<RequestsTab {...props()} />); open();
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.queryByTitle('Private lease file')).not.toBeInTheDocument();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
test.each(['account', 'token', 'blur', 'closed-card', 'changed-request', 'retired-property'])(
  'late bytes after %s cannot be exposed', async kind => {
    let resolve!: (value: ReturnType<typeof result>) => void;
    (api.tenant.downloadLeaseFile as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
    const view = render(<RequestsTab {...props()} />); open();
    await waitFor(() => expect(api.tenant.downloadLeaseFile).toHaveBeenCalledTimes(1));
    if (kind === 'account') act(() => window.dispatchEvent(new StorageEvent('storage', { key: api.AUTH_SESSION_CHANGE_KEY })));
    if (kind === 'token') act(() => tokenChange());
    if (kind === 'blur') act(() => window.dispatchEvent(new Event('blur')));
    if (kind === 'closed-card') view.unmount();
    if (kind === 'changed-request') view.rerender(<RequestsTab {...props()} requests={[{ ...request, metadata: { lease_file_id: other } }]} />);
    if (kind === 'retired-property') current = false;
    await act(async () => resolve(result()));
    expect(screen.queryByTitle('Private lease file')).not.toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  }
);
test('a session change during the opening handshake cannot start a binary read', async () => {
  let resolve!: (value: typeof session) => void;
  (api.tenant.getLeaseFileSession as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  render(<RequestsTab {...props()} />); open();
  act(() => tokenChange());
  await act(async () => resolve(session));
  expect(api.tenant.downloadLeaseFile).not.toHaveBeenCalled();
});
test('closing or hiding the existing viewer releases its private PDF object URL', async () => {
  (api.tenant.downloadLeaseFile as jest.Mock).mockResolvedValue({ ...result(), bytes: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) });
  render(<RequestsTab {...props()} />); open();
  expect(await screen.findByTitle('Private lease file')).toHaveAttribute('data', 'blob:private-lease');
  expect(screen.getByText('download this document')).toHaveAttribute('download', 'lease.txt');
  expect(screen.queryByText(/Only confirm verification/)).not.toBeInTheDocument();
  act(() => window.dispatchEvent(new Event('blur')));
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-lease'));
  expect(screen.queryByTitle('Private lease file')).not.toBeInTheDocument();
});
test('legacy requests without an attached File preserve the existing card controls', () => {
  render(<RequestsTab {...props()} requests={[{ ...request, metadata: { message: 'Original request' } }]} />);
  expect(screen.queryByRole('button', { name: 'Open private lease file' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Approve' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Deny' })).toBeVisible();
  expect(api.tenant.getLeaseFileSession).not.toHaveBeenCalled();
});
