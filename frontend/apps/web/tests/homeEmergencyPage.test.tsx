/**
 * Members' Emergency Info page and the dashboard Emergency card against the
 * real HomeEmergency row shape: `type` (a HomeEmergencyType), `label`,
 * `location` and a jsonb `details` object. Before this suite the page grouped
 * by a `category` field no row has, rendered `details` as a React child (an
 * object crashes the page), and its Add/Delete controls only changed local
 * state. No existing Jest suite renders either screen.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import { toast } from '../src/components/ui/toast-store';
import EmergencyPage from '../src/app/(app)/app/homes/[id]/emergency/page';
import EmergencyCard, { EmergencyCardPreview } from '../src/components/home/cards/EmergencyCard';

jest.mock('@pantopus/api', () => ({
  homeProfile: { getHomeEmergencies: jest.fn(), createHomeEmergency: jest.fn(), deleteHomeEmergency: jest.fn() },
  getAuthToken: () => '__session__',
}));
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() };
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'home' }), useRouter: () => mockRouter }));
jest.mock('../src/components/ui/toast-store', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock('../src/components/ui/confirm-store', () => ({ confirmStore: { open: jest.fn(async () => true) } }));
jest.mock('next/image', () => ({ __esModule: true, default: (props: Record<string, unknown>) => <img alt="" {...props} /> }));

const rows = [
  { id: 'water', home_id: 'home', type: 'shutoff_water', info_type: 'shutoff_water', label: 'Water shutoff',
    location: 'Garage wall', location_in_home: 'Garage wall', details: {}, created_by: 'u', created_at: '', updated_at: '' },
  { id: 'contacts', home_id: 'home', type: 'emergency_contacts', info_type: 'emergency_contacts', label: 'Poison control',
    location: null, location_in_home: null, details: { phone: '+1 800 222 1222', notes: 'Open 24h' }, created_by: 'u', created_at: '', updated_at: '' },
  { id: 'evac', home_id: 'home', type: 'evac_plan', info_type: 'evac_plan', label: 'Meet at the mailbox',
    location: 'Front yard', location_in_home: 'Front yard', details: { detail: 'Take the side gate' }, created_by: 'u', created_at: '', updated_at: '' },
  { id: 'kit', home_id: 'home', type: 'first_aid', info_type: 'first_aid', label: 'First aid kit',
    location: 'Hall closet', location_in_home: 'Hall closet', details: {}, created_by: 'u', created_at: '', updated_at: '' },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(api.homeProfile.getHomeEmergencies).mockResolvedValue({ emergencies: JSON.parse(JSON.stringify(rows)) });
});

test('real HomeEmergency rows render under their type\'s category with label, location, phone and notes', async () => {
  render(<EmergencyPage />);
  expect(await screen.findByText('Water shutoff')).toBeInTheDocument();
  for (const heading of ['Shutoffs', 'Emergency Contacts', 'Evacuation', 'Medical']) {
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  }
  expect(screen.queryByRole('heading', { name: 'Other' })).not.toBeInTheDocument();
  expect(screen.getByText('Garage wall')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /\+1 800 222 1222/ })).toHaveAttribute('href', 'tel:+1 800 222 1222');
  expect(screen.getByText('Open 24h')).toBeInTheDocument();
  expect(screen.getByText('Take the side gate')).toBeInTheDocument();
  expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
});

test('adding a shutoff saves the exact utility type and details through the API and shows the saved row', async () => {
  jest.mocked(api.homeProfile.createHomeEmergency).mockResolvedValue({ emergency: {
    id: 'gas', home_id: 'home', type: 'shutoff_gas', label: 'Gas valve', location: null,
    details: { phone: '+1 555 0100', notes: 'Behind the dryer' }, created_by: 'u', created_at: '', updated_at: '',
  } });
  render(<EmergencyPage />);
  fireEvent.click(await screen.findByRole('button', { name: /^Add$/ }));
  fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Gas valve' } });
  fireEvent.click(screen.getByRole('button', { name: 'Shutoffs' }));
  fireEvent.click(screen.getByRole('button', { name: 'Gas' }));
  fireEvent.change(screen.getByPlaceholderText('Phone number (optional)'), { target: { value: '+1 555 0100' } });
  fireEvent.change(screen.getByPlaceholderText('Details (optional)'), { target: { value: 'Behind the dryer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Emergency Info' }));
  await waitFor(() => expect(api.homeProfile.createHomeEmergency).toHaveBeenCalledWith('home',
    { type: 'shutoff_gas', label: 'Gas valve', details: { phone: '+1 555 0100', notes: 'Behind the dryer' } }));
  expect(await screen.findByText('Gas valve')).toBeInTheDocument();
  expect(screen.getByText('Behind the dryer')).toBeInTheDocument();
  expect(toast.success).toHaveBeenCalledWith('Emergency info added');
});

test('a contact entry maps to emergency_contacts and a refused type reports the API reason with nothing added', async () => {
  jest.mocked(api.homeProfile.createHomeEmergency).mockRejectedValue({
    message: 'This emergency type is not supported.', code: 'INVALID_EMERGENCY_TYPE', statusCode: 400,
    data: { error: 'This emergency type is not supported.', code: 'INVALID_EMERGENCY_TYPE' },
  });
  render(<EmergencyPage />);
  fireEvent.click(await screen.findByRole('button', { name: /^Add$/ }));
  fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Neighbour' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Emergency Info' }));
  await waitFor(() => expect(api.homeProfile.createHomeEmergency).toHaveBeenCalledWith('home',
    { type: 'emergency_contacts', label: 'Neighbour', details: {} }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('This emergency type is not supported.'));
  expect(screen.queryByText('Neighbour')).not.toBeInTheDocument();
  expect(toast.success).not.toHaveBeenCalled();
});

test('deleting removes the row through the API; a failed delete keeps the row', async () => {
  jest.mocked(api.homeProfile.deleteHomeEmergency).mockResolvedValueOnce({ message: 'Emergency info deleted' });
  render(<EmergencyPage />);
  await screen.findByText('Water shutoff');
  fireEvent.click(screen.getByRole('button', { name: 'Delete Water shutoff' }));
  await waitFor(() => expect(api.homeProfile.deleteHomeEmergency).toHaveBeenCalledWith('home', 'water'));
  await waitFor(() => expect(screen.queryByText('Water shutoff')).not.toBeInTheDocument());
  jest.mocked(api.homeProfile.deleteHomeEmergency).mockRejectedValueOnce({
    message: 'Could not complete the request.', code: 'ERR_BAD_RESPONSE', statusCode: 503, data: { error: 'Could not complete the request.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Delete First aid kit' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not complete the request.'));
  expect(screen.getByText('First aid kit')).toBeInTheDocument();
});

test('the dashboard card buckets rows by their real type and its Add Info opens the Emergency page', () => {
  render(<EmergencyCard emergencies={rows} home={{}} homeId="home" onBack={() => {}} />);
  expect(screen.getByText('Water shutoff')).toBeInTheDocument();
  expect(screen.queryByText('No shutoff locations documented')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '+1 800 222 1222' })).toBeInTheDocument();
  expect(screen.queryByText('No emergency contacts added')).not.toBeInTheDocument();
  expect(screen.getByText('Meet at the mailbox')).toBeInTheDocument();
  expect(screen.getByText('Take the side gate')).toBeInTheDocument();
  expect(screen.getByText('First aid kit')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+ Add Info' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/app/homes/home/emergency');
  render(<EmergencyCardPreview emergencies={rows} onExpand={() => {}} />);
  expect(screen.getAllByText('Water shutoff')).toHaveLength(2);
});
