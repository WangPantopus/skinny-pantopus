import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FileUpload, { CompletionProofImage } from '../src/components/FileUpload';
import { AUTH_SESSION_CHANGE_KEY, getAuthToken, getApiBaseUrl, onTokenChange, upload } from '@pantopus/api';

const photo = (name: string) => new File(['image'], name, { type: 'image/png' });
const first = photo('first.png');
const second = photo('second.png');
const createURL = jest.fn();
const revokeURL = jest.fn();
const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

beforeEach(() => {
  createURL.mockReset().mockImplementation(() => `blob:preview-${createURL.mock.calls.length}`);
  revokeURL.mockReset();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeURL });
});
afterEach(() => {
  cleanup();
  if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
  else Reflect.deleteProperty(URL, 'createObjectURL');
  if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
  else Reflect.deleteProperty(URL, 'revokeObjectURL');
});

function choose(container: HTMLElement, files: File[]) {
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files } });
}

test('Click to change replaces the selected single file', () => {
  const selected = jest.fn();
  const view = render(<FileUpload maxFiles={1} files={[first]} onFilesSelected={selected} />);
  expect(screen.getByText('Click to change')).toBeInTheDocument();
  choose(view.container, [second]);
  expect(selected).toHaveBeenCalledWith([second]);
  expect(screen.queryByText('Maximum 1 file allowed')).not.toBeInTheDocument();
});

test('single-file replacement accepts a new file alongside the existing remote preview', () => {
  const selected = jest.fn();
  const existing = [{ id: 'uploaded', url: '/picture.png', name: 'picture.png', type: 'image' }];
  const view = render(<FileUpload maxFiles={1} existingMedia={existing} onFilesSelected={selected} />);
  choose(view.container, [second]);
  expect(selected).toHaveBeenCalledWith([second]);
  expect(createURL).not.toHaveBeenCalled();
});

test('single-file mode still rejects a drop containing two files', () => {
  const selected = jest.fn();
  const view = render(<FileUpload maxFiles={1} onFilesSelected={selected} />);
  fireEvent.drop(screen.getByText('Drop files here or click to browse'), { dataTransfer: { files: [first, second] } });
  expect(screen.getByText('Maximum 1 file allowed')).toBeInTheDocument();
  expect(selected).not.toHaveBeenCalled();
  expect(view.container.querySelector('input')).not.toHaveAttribute('multiple');
});

test('multi-file mode appends and includes uploaded files in its limit', () => {
  const selected = jest.fn();
  const props = { maxFiles: 3, files: [first], existingMedia: [{ id: 'uploaded', url: '/picture.png', name: 'picture.png', type: 'image' }], onFilesSelected: selected };
  const view = render(<FileUpload {...props} />);
  choose(view.container, [second]);
  expect(selected).toHaveBeenCalledWith([first, second]);
  selected.mockClear();
  choose(view.container, [second, photo('third.png')]);
  expect(selected).not.toHaveBeenCalled();
  expect(screen.getByText('Maximum 3 files allowed')).toBeInTheDocument();
});

test.each([1, 5])('preview URLs survive unrelated renders and retire on replacement/removal (maxFiles=%i)', maxFiles => {
  const selected = jest.fn();
  const view = render(<FileUpload maxFiles={maxFiles} files={[first]} onFilesSelected={selected} />);
  expect(createURL).toHaveBeenCalledTimes(1);
  const oldURL = createURL.mock.results[0].value;
  view.rerender(<FileUpload maxFiles={maxFiles} files={[first]} helperText="Updated helper" onFilesSelected={selected} />);
  expect(createURL).toHaveBeenCalledTimes(1);
  expect(revokeURL).not.toHaveBeenCalled();
  view.rerender(<FileUpload maxFiles={maxFiles} files={[second]} onFilesSelected={selected} />);
  expect(createURL).toHaveBeenCalledTimes(2);
  expect(revokeURL).toHaveBeenCalledWith(oldURL);
  expect(screen.getByRole('img')).toHaveAttribute('src', createURL.mock.results[1].value);
  view.rerender(<FileUpload maxFiles={maxFiles} files={[]} onFilesSelected={selected} />);
  expect(revokeURL).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

test('StrictMode and unmount release every locally allocated image preview', () => {
  const view = render(<StrictMode><FileUpload files={[first, second]} onFilesSelected={jest.fn()} /></StrictMode>);
  view.unmount();
  expect(createURL).toHaveBeenCalled();
  expect(revokeURL.mock.calls.map(([url]) => url).sort()).toEqual(createURL.mock.results.map(({ value }) => value).sort());
});

test('documents in the existing multi-file list allocate no image preview', () => {
  render(<FileUpload files={[new File(['PDF'], 'lease.pdf', { type: 'application/pdf' })]} onFilesSelected={jest.fn()} />);
  expect(screen.getByText('lease.pdf')).toBeInTheDocument();
  expect(createURL).not.toHaveBeenCalled();
});


describe('existing completion preview loads authenticated private bytes', () => {
  const reference = '/api/gigs/aaef0000-0000-4000-8000-000000000100/completion-files/aaef0000-0000-4000-8000-000000000200';
  let retire: () => void;
  beforeEach(() => {
    localStorage.clear();
    (getAuthToken as jest.Mock).mockReturnValue('synthetic-proof-session');
    (getApiBaseUrl as jest.Mock).mockReturnValue('https://synthetic.invalid');
    (onTokenChange as jest.Mock).mockImplementation(listener => { retire = listener; return () => {}; });
    (upload.downloadGigCompletionFile as jest.Mock).mockReset().mockResolvedValue(new Blob(['private image'], { type: 'image/jpeg' }));
  });
  const picture = (url = reference) => <CompletionProofImage reference={url} alt="Saved proof" width={56} height={56} className="existing-photo" openFull />;
  test('renders the existing image and full-size link from a temporary authenticated blob only', async () => {
    const view = render(picture());
    await waitFor(() => expect(createURL).toHaveBeenCalledTimes(1));
    expect(upload.downloadGigCompletionFile).toHaveBeenCalledWith(reference, expect.any(AbortSignal));
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:preview-1');
    expect(screen.getByRole('img')).toHaveClass('existing-photo');
    expect(screen.getByRole('link')).toHaveAttribute('href', 'blob:preview-1');
    view.unmount(); expect(revokeURL).toHaveBeenCalledWith('blob:preview-1');
  });
  test.each(['session', 'storage', 'unmount'])('late download after %s retirement cannot create or show a preview', async event => {
    let finish!: (bytes: Blob) => void;
    (upload.downloadGigCompletionFile as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = render(picture());
    if (event === 'unmount') view.unmount();
    else if (event === 'session') act(() => { (getAuthToken as jest.Mock).mockReturnValue('replacement'); retire(); });
    else act(() => { localStorage.setItem(AUTH_SESSION_CHANGE_KEY, 'replacement'); window.dispatchEvent(new StorageEvent('storage', { key: AUTH_SESSION_CHANGE_KEY })); });
    await act(async () => finish(new Blob(['late private image'])));
    expect(createURL).not.toHaveBeenCalled(); expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  test('a loaded preview is revoked immediately on account change', async () => {
    render(picture()); await waitFor(() => expect(createURL).toHaveBeenCalledTimes(1));
    act(() => { (getAuthToken as jest.Mock).mockReturnValue('replacement'); retire(); });
    expect(revokeURL).toHaveBeenCalledWith('blob:preview-1'); expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  test('a replaced proof cannot render a previous download and revokes its URL', async () => {
    const view = render(picture()); await waitFor(() => expect(createURL).toHaveBeenCalledTimes(1));
    const secondReference = reference.replace(/200$/, '201');
    (upload.downloadGigCompletionFile as jest.Mock).mockImplementation(() => new Promise(() => {}));
    view.rerender(picture(secondReference));
    expect(revokeURL).toHaveBeenCalledWith('blob:preview-1'); expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  test('failed authorized retrieval can be retried without a public fallback', async () => {
    (upload.downloadGigCompletionFile as jest.Mock).mockRejectedValueOnce(new Error('unavailable'));
    render(picture()); fireEvent.click(await screen.findByRole('button', { name: 'Retry photo' }));
    await waitFor(() => expect(createURL).toHaveBeenCalledTimes(1));
    expect(upload.downloadGigCompletionFile).toHaveBeenCalledTimes(2); expect(screen.getByRole('link')).toHaveAttribute('href', 'blob:preview-1');
  });
  test('existing legacy media remains unchanged without private-byte API calls', () => {
    render(picture('/legacy-proof.jpg'));
    expect(upload.downloadGigCompletionFile).not.toHaveBeenCalled(); expect(createURL).not.toHaveBeenCalled();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/legacy-proof.jpg');
  });
});
