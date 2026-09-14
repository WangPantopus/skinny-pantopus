import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import EvidencePage from '../src/app/(app)/app/homes/[id]/claim-owner/evidence/page';
import ResidencyPage from '../src/app/(app)/app/homes/[id]/verify-residency/page';
import { toast } from '../src/components/ui/toast-store';
const push = jest.fn();
const assertCurrent = jest.fn();
const scope = { actor_id: 'actor-a', session_scope: 'a'.repeat(64) };
let homeId = 'home-a';
let opened = true;
let query = new URLSearchParams();
jest.mock('next/navigation', () => ({ useParams: () => ({ id: homeId }), useRouter: () => ({ push }), useSearchParams: () => query }));
jest.mock('../src/components/home/useClaimUploadSession', () => ({ useClaimUploadSession: () => ({ scope: opened ? scope : null, error: '', assertCurrent, retry: jest.fn() }) }));
jest.mock('../src/components/ui/toast-store', () => ({ toast: { error: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock('@pantopus/api', () => ({ homeOwnership: { submitOwnershipClaim: jest.fn(), getMyOwnershipClaims: jest.fn() }, upload: { uploadOwnershipEvidence: jest.fn() } }));
const upload = jest.mocked(api.upload.uploadOwnershipEvidence);
const submit = jest.mocked(api.homeOwnership.submitOwnershipClaim);
const read = jest.mocked(api.homeOwnership.getMyOwnershipClaims);
const file = new File(['%PDF-test'], 'proof.pdf', { type: 'application/pdf' });
beforeEach(() => {
  jest.clearAllMocks(); homeId = 'home-a'; query = new URLSearchParams(); opened = true;
  assertCurrent.mockResolvedValue(undefined);
  submit.mockResolvedValue({ message: 'Claim started', claim: { id: 'claim-a', status: 'under_review' } });
  read.mockResolvedValue({ claims: [], upload_session: scope });
  upload.mockResolvedValue({ message: 'Saved', evidence: {} } as never);
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: jest.fn(() => 'upload-operation-a') });
});
function choose(container: HTMLElement, label = /Lease Agreement/) {
  fireEvent.click(screen.getByRole('button', { name: label }));
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
}
test('an unknown upload result retries the same claim, file and upload operation without another claim', async () => {
  upload.mockRejectedValueOnce(new Error('Connection interrupted'));
  const view = render(<EvidencePage />); choose(view.container);
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Connection interrupted'));
  expect(push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  expect(submit).toHaveBeenCalledTimes(1);
  expect(upload).toHaveBeenCalledTimes(2);
  expect(upload.mock.calls[0]).toEqual(['home-a', 'claim-a', file, 'lease', 'upload-operation-a', scope.session_scope]);
  expect(upload.mock.calls[1]).toEqual(upload.mock.calls[0]);
});
test('a failed current-session check prevents claim submission and byte upload', async () => {
  assertCurrent.mockRejectedValue(new Error('Session changed'));
  const view = render(<EvidencePage />); choose(view.container);
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Session changed'));
  expect(submit).not.toHaveBeenCalled(); expect(upload).not.toHaveBeenCalled();
});
test('a late upload success after session replacement cannot report submission or navigate', async () => {
  let resolve!: (value: never) => void;
  upload.mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(<EvidencePage />); choose(view.container);
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() => expect(upload).toHaveBeenCalled());
  assertCurrent.mockRejectedValue(new Error('Session changed'));
  await act(async () => { resolve({ evidence: {} } as never); });
  expect(push).not.toHaveBeenCalled(); expect(toast.error).toHaveBeenCalledWith('Session changed');
});
test('unsupported household challenges do not upload bytes or promise automatic challenge activation', async () => {
  submit.mockResolvedValue({ message: 'Review needed', claim: { id: 'claim-a', status: 'under_review', routing_classification: 'challenge_claim' } });
  const view = render(<EvidencePage />); choose(view.container);
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('dedicated household challenge review')));
  expect(upload).not.toHaveBeenCalled(); expect(push).not.toHaveBeenCalled();
});
test('residency manual upload offers only supported residency documents, with one exact private upload', async () => {
  const view = render(<ResidencyPage />); choose(view.container, /Lease agreement/);
  expect(screen.queryByRole('button', { name: /Government ID/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() => expect(push).toHaveBeenCalled());
  expect(submit).toHaveBeenCalledWith('home-a', { claim_type: 'resident', method: 'doc_upload' }, scope.session_scope);
  expect(upload).toHaveBeenCalledTimes(1);
});
test('no file picker is available before opening identity is loaded', () => {
  opened = false; const view = render(<EvidencePage />);
  expect(view.container.querySelector('input[type="file"]')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Submit for review' })).not.toBeInTheDocument();
});
