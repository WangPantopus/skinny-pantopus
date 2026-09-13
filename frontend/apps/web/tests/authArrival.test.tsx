import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.node';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { authPageHref, oauthRedirectParamForWeb, safeRedirectPath } from '../src/lib/auth-utils';

const push = jest.fn();
const replace = jest.fn();
let search = new URLSearchParams();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }), useSearchParams: () => search }));
const login = jest.fn();
const register = jest.fn();
const resend = jest.fn();
const verify = jest.fn();
const oauth = jest.fn();
const requestReset = jest.fn();
jest.mock('@pantopus/api', () => ({
  auth: {
    requestPasswordReset: (...args: unknown[]) => requestReset(...args),
    login: (...args: unknown[]) => login(...args), register: (...args: unknown[]) => register(...args),
    resendVerification: (...args: unknown[]) => resend(...args), verifyEmail: (...args: unknown[]) => verify(...args),
    oauthCallback: (...args: unknown[]) => oauth(...args), oauthTokenCallback: (...args: unknown[]) => oauth(...args),
  }, recordFunnelEvent: jest.fn(), getFunnelAnonId: () => null,
}));
jest.mock('@/components/PantopusBadge', () => () => <span>Pantopus</span>);
import Login from '../src/app/(auth)/login/page';
import Register from '../src/app/(auth)/register/page';
import VerifySent from '../src/app/(auth)/verify-email-sent/page';
import VerifyEmail from '../src/app/(auth)/verify-email/page';
import Callback from '../src/app/auth/callback/page';
import ForgotPassword from '../src/app/(auth)/forgot-password/page';
import ResetPassword from '../src/app/(auth)/reset-password/page';

beforeEach(() => { jest.clearAllMocks(); search = new URLSearchParams(); window.history.replaceState({}, '', '/'); localStorage.clear(); });
const TARGETS = ['/app/place?preview=0123456789abcdef', '/app/feed/post/post-1?comment=reply-2', '/persona/garden', '/app/persona/garden/follow?tier_rank=1', '/app/feed?surface=personas'];

test.each([
  ['login', Login], ['registration', Register], ['password recovery', ForgotPassword], ['password reset', ResetPassword],
])('%s credentials are inert before hydration and cannot fall back to a GET', (_name, Page) => {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<Page />);
  const form = container.querySelector('form');
  expect(form).toHaveAttribute('method', 'post');
  const controls = form!.querySelectorAll('input, button, select, textarea');
  expect(controls.length).toBeGreaterThan(0);
  controls.forEach(control => expect(control).toBeDisabled());
});

describe('safe return destinations', () => {
  test.each([...TARGETS, '/@garden', '/posts/post-1', '/invite/seat?token=x'])('preserves %s', (target) => expect(safeRedirectPath(target)).toBe(target));
  test.each(['https://evil.test', '//evil.test', '/\\evil.test', '/app/../login', '/app/%2e%2e/login', '/app/%252e%252e/login', '/app/\n/evil', '/app/%0a/evil', 'javascript:alert(1)', '/login?redirectTo=/app/place', '/app/%5cevil'])('rejects %s', (target) => expect(safeRedirectPath(target, '/app/place')).toBe('/app/place'));
  test('does not decode nested queries twice', () => {
    const target = '/app/feed/post/p?text=a%26b%3Dc#comment-1';
    expect(safeRedirectPath(target)).toBe(target);
    expect(new URL(authPageHref('/login', target), 'https://web.test').searchParams.get('redirectTo')).toBe(target);
  });
  test('OAuth always lands on the exchange page with a validated return path', () => {
    const callback = new URL(oauthRedirectParamForWeb('/persona/garden', 'https://web.test')!);
    expect(callback.pathname).toBe('/auth/callback');
    expect(callback.searchParams.get('redirectTo')).toBe('/persona/garden');
    expect(new URL(oauthRedirectParamForWeb('//evil.test', 'https://web.test')!).searchParams.get('redirectTo')).toBe('/app/place');
  });
});

test.each(TARGETS)('login/signup links preserve %s', (target) => {
  search.set('redirectTo', target);
  const { unmount } = render(<Login />);
  expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', authPageHref('/register', target));
  unmount();
  render(<Register />);
  expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', authPageHref('/login', target));
});

test('login returns to a shared post without posting', async () => {
  search.set('redirectTo', TARGETS[1]);
  login.mockResolvedValue({ user: { id: 'u1' } });
  render(<Login />);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(push).toHaveBeenCalledWith(TARGETS[1]));
});

test('registration passes the destination to the email API and verification screen', async () => {
  search.set('redirectTo', TARGETS[2]);
  register.mockResolvedValue({ user: { id: 'u1' }, requiresEmailVerification: true });
  render(<Register />);
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'a@example.com' } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'long-password-123' } });
  fireEvent.change(screen.getByLabelText(/^Confirm password/), { target: { value: 'long-password-123' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(screen.getByRole('button', { name: /create.*account/i }).closest('form')!);
  await waitFor(() => expect(register).toHaveBeenCalledWith(expect.objectContaining({ redirectTo: TARGETS[2] })));
  expect(push).toHaveBeenCalledWith(authPageHref('/verify-email-sent', TARGETS[2], { email: 'a@example.com' }));
});

test('verification resend and sign-in links retain Beacon intent', async () => {
  search = new URLSearchParams({ redirectTo: TARGETS[2], email: 'a@example.com' });
  resend.mockResolvedValue({ message: 'Sent' });
  render(<VerifySent />);
  fireEvent.click(screen.getByRole('button', { name: 'Resend verification email' }));
  await waitFor(() => expect(resend).toHaveBeenCalledWith('a@example.com', TARGETS[2]));
  expect(screen.getByRole('link', { name: 'Back to Sign in' })).toHaveAttribute('href', authPageHref('/login', TARGETS[2]));
});

test('email verification succeeds in Strict Mode and keeps the original destination', async () => {
  search = new URLSearchParams({ redirectTo: TARGETS[2], token_hash: 'test-token' });
  verify.mockResolvedValue({ message: 'Verified' });
  render(<React.StrictMode><VerifyEmail /></React.StrictMode>);
  expect(await screen.findByText('Verified')).toBeInTheDocument();
  expect(verify).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: 'Go to Sign in' })).toHaveAttribute('href', authPageHref('/login', TARGETS[2]));
});

test('OAuth exchanges once in Strict Mode before returning to the Beacon', async () => {
  search = new URLSearchParams({ redirectTo: TARGETS[2], code: 'test-code' });
  oauth.mockResolvedValue({ user: { id: 'u1' } });
  render(<React.StrictMode><Callback /></React.StrictMode>);
  await waitFor(() => expect(replace).toHaveBeenCalledWith(TARGETS[2]));
  expect(oauth).toHaveBeenCalledTimes(1);
});


test('password recovery retains the original post', async () => {
  search.set('redirectTo', TARGETS[1]);
  const loginPage = render(<Login />);
  expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', authPageHref('/forgot-password', TARGETS[1]));
  loginPage.unmount();
  requestReset.mockResolvedValue({ message: 'Reset link sent' });
  const forgot = render(<ForgotPassword />);
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'a@example.com' } });
  fireEvent.submit(screen.getByRole('button', { name: /send reset/i }).closest('form')!);
  await waitFor(() => expect(requestReset).toHaveBeenCalledWith('a@example.com', TARGETS[1]));
  forgot.unmount();
  search.set('token_hash', 'test-token');
  render(<ResetPassword />);
  expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', authPageHref('/login', TARGETS[1]));
});
