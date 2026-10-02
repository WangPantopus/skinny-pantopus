import { webcrypto } from 'node:crypto';
import LegalPage from '../src/app/(app)/app/business/[id]/settings/legal/page';
import LegalTab from '../src/components/business/tabs/LegalTab';
import { toast } from '../src/components/ui/toast-store';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import { useBusinessGigAccess } from '../src/hooks/useBusinessGigAccess';

let token = '__session__';
let origin = 'https://app.test';
const listeners = new Set<() => void>();
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'crew' }) }));
jest.mock('../src/components/ui/toast-store', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@pantopus/api', () => ({
  getAuthToken: () => token, getApiBaseUrl: () => origin,
  AUTH_SESSION_CHANGE_KEY: 'session-change',
  onTokenChange: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
  businessIam: { getMyBusinessAccess: jest.fn() },
  businesses: { getVerificationStatus: jest.fn(), getBusinessPrivate: jest.fn(), uploadVerificationEvidence: jest.fn() },
  upload: { uploadVerificationDocument: jest.fn() },
}));
const grant = { hasAccess: true, isOwner: false, permissions: ['gigs.manage'] };
const response = (value: unknown) => value as Awaited<ReturnType<typeof api.businessIam.getMyBusinessAccess>>;
const props = { actor: 'actor-a', owner: 'business-a', business: true, revision: 1 };
function show() {
  return renderHook(({ actor, owner, business, revision }) => useBusinessGigAccess(actor, owner, business, revision), { initialProps: props });
}
beforeEach(() => {
  jest.clearAllMocks(); listeners.clear(); token = '__session__'; origin = 'https://app.test';
  jest.mocked(api.businessIam.getMyBusinessAccess).mockResolvedValue(response(grant));
});
test.each([
  [grant, true], [{ hasAccess: true, isOwner: true, permissions: [] }, true],
  [{ hasAccess: true, permissions: ['gigs.post'] }, true],
  [{ hasAccess: false, isOwner: true, permissions: ['gigs.manage'] }, false],
  [{ hasAccess: true, permissions: ['gigs.view'] }, false], [null, false],
])('only current authorized business permissions expose manager actions: %j', async (access, allowed) => {
  jest.mocked(api.businessIam.getMyBusinessAccess).mockResolvedValue(response(access));
  const view = show(); await act(async () => {});
  expect(view.result.current).toBe(allowed);
});
test('failed permission lookup hides actions', async () => {
  jest.mocked(api.businessIam.getMyBusinessAccess).mockRejectedValue(new Error('Unavailable'));
  const view = show(); await act(async () => {}); expect(view.result.current).toBe(false);
});
test.each(['owner', 'actor'] as const)('a delayed grant cannot cross a changed %s', async (field) => {
  let resolve!: (value: ReturnType<typeof response>) => void;
  jest.mocked(api.businessIam.getMyBusinessAccess).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  jest.mocked(api.businessIam.getMyBusinessAccess).mockResolvedValueOnce(response({ hasAccess: false }));
  const view = show(); view.rerender({ ...props, [field]: `${field}-b` });
  await act(async () => { resolve(response(grant)); });
  expect(view.result.current).toBe(false);
});
test.each(['same-tab', 'cross-tab', 'cleared-storage'])('a %s session change stays retired across data refreshes with an identical cookie marker', async (signal) => {
  const view = show(); await waitFor(() => expect(view.result.current).toBe(true));
  act(() => {
    if (signal === 'same-tab') [...listeners].forEach((fn) => fn());
    else window.dispatchEvent(new StorageEvent('storage', { key: signal === 'cross-tab' ? api.AUTH_SESSION_CHANGE_KEY : null }));
  });
  expect(view.result.current).toBe(false);
  view.rerender({ ...props, revision: 2 }); await act(async () => {});
  expect(api.businessIam.getMyBusinessAccess).toHaveBeenCalledTimes(1);
  expect(view.result.current).toBe(false);
});
test.each(['token', 'origin'])('changed %s retires the old actor even without a notification', async (field) => {
  const view = show(); await waitFor(() => expect(view.result.current).toBe(true));
  if (field === 'token') token = 'replacement'; else origin = 'https://another.test';
  view.rerender({ ...props, revision: 2 }); await act(async () => {});
  expect(view.result.current).toBe(false); expect(api.businessIam.getMyBusinessAccess).toHaveBeenCalledTimes(1);
});
test('a newly loaded actor can obtain its own permissions after retirement', async () => {
  const view = show(); await waitFor(() => expect(view.result.current).toBe(true));
  act(() => [...listeners].forEach((fn) => fn()));
  view.rerender({ ...props, actor: 'actor-b' });
  await waitFor(() => expect(view.result.current).toBe(true));
  expect(api.businessIam.getMyBusinessAccess).toHaveBeenCalledTimes(2);
});
test('same-task refresh keeps recovery mounted until current permissions arrive, then applies revocation', async () => {
  const view = show(); await waitFor(() => expect(view.result.current).toBe(true));
  let resolve!: (value: ReturnType<typeof response>) => void;
  jest.mocked(api.businessIam.getMyBusinessAccess).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  view.rerender({ ...props, revision: 2 }); expect(view.result.current).toBe(true);
  await act(async () => { resolve(response({ hasAccess: false })); });
  expect(view.result.current).toBe(false);
});

// Existing owner/business suite also covers the two evidence forms.
describe('verification registration retries', () => {
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: webcrypto.subtle });
  jest.mocked(api.businesses.getVerificationStatus).mockResolvedValue({
    verification_status: 'unverified', verification_tier: 'unverified', can_self_attest: false, can_upload_evidence: true, evidence: [],
  } as Awaited<ReturnType<typeof api.businesses.getVerificationStatus>>);
  jest.mocked(api.businesses.getBusinessPrivate).mockResolvedValue({ private: {} } as Awaited<ReturnType<typeof api.businesses.getBusinessPrivate>>);
  jest.mocked(api.businessIam.getMyBusinessAccess).mockResolvedValue({ isOwner: true } as Awaited<ReturnType<typeof api.businessIam.getMyBusinessAccess>>);
  let nextFile = 0;
  jest.mocked(api.upload.uploadVerificationDocument).mockImplementation(async () => ({ message: 'uploaded', file: { id: `file-${++nextFile}` } }));
  jest.mocked(api.businesses.uploadVerificationEvidence)
    .mockRejectedValueOnce(new Error('Lost registration reply'))
    .mockResolvedValue({ message: 'Submitted', evidence_id: 'evidence', status: 'pending' });
});
function file(bytes = 'first') {
  const f = new File([bytes], 'document.png', { type: 'image/png' });
  Object.defineProperty(f, 'arrayBuffer', { value: async () => Uint8Array.from(Buffer.from(bytes)).buffer });
  return f;
}
test.each(['settings', 'owner tab'])('%s retains the uploaded file through a lost registration reply', async surface => {
  const view = render(surface === 'settings' ? <LegalPage /> : <LegalTab businessId="crew" businessType="nonprofit_501c3" />);
  const label = surface === 'settings' ? 'Submit for Review' : 'Upload EIN Letter';
  await screen.findByRole('button', { name: label });
  const submit = () => {
    if (surface !== 'settings') fireEvent.click(screen.getByRole('button', { name: label }));
    fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [file()] } });
    if (surface === 'settings') fireEvent.click(screen.getByRole('button', { name: label }));
  };
  submit();
  await waitFor(() => expect(api.businesses.uploadVerificationEvidence).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole('button', { name: label })).toBeEnabled());
  if (surface === 'settings') expect(screen.getByText('Lost registration reply')).toBeVisible();
  else expect(toast.error).toHaveBeenCalledWith('Lost registration reply');
  submit();
  await waitFor(() => expect(api.businesses.uploadVerificationEvidence).toHaveBeenCalledTimes(2));
  expect(api.upload.uploadVerificationDocument).toHaveBeenCalledTimes(1);
  expect(jest.mocked(api.businesses.uploadVerificationEvidence).mock.calls.map(call => call[1].file_id)).toEqual(['file-1', 'file-1']);
});
test('changed document bytes start a new upload after failed registration', async () => {
  const view = render(<LegalPage />);
  const button = await screen.findByRole('button', { name: 'Submit for Review' });
  fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [file()] } });
  fireEvent.click(button); await screen.findByText('Lost registration reply');
  fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [file('changed')] } });
  fireEvent.click(button);
  await waitFor(() => expect(api.businesses.uploadVerificationEvidence).toHaveBeenCalledTimes(2));
  expect(api.upload.uploadVerificationDocument).toHaveBeenCalledTimes(2);
});

});
