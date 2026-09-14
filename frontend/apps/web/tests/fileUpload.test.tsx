import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FileUpload from '../src/components/FileUpload';

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
