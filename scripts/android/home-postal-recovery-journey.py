#!/usr/bin/env python3
"""Owned installed Android postal UI against production loopback HTTP/SDK/SQL.

Uses the native postal fixture on 18084 and the specifically owned recurrence
AVD. No app-data clearing, authentication injection, real mail or hosted calls.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import time

spec = importlib.util.spec_from_file_location('residency', Path(__file__).with_name('home-residency-recovery-journey.py'))
residency = importlib.util.module_from_spec(spec)
spec.loader.exec_module(residency)
base = residency.base
HOME = 'ddc23600-0000-4000-8000-000000000100'


class Journey(residency.Journey):
    def login(self):
        self.launch()
        end = time.monotonic() + 35
        while time.monotonic() < end:
            nodes = self.nodes()
            if self.match(nodes, 'Email address') is not None: break
            if self.match(nodes, 'Sign in') is not None:
                self.tap('Sign in')
                break
        self.fill('Email address', 'postal-ui@example.invalid')
        self.fill('Password', 'synthetic-loopback-only')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Log in')
        self.wait('Place', seconds=45)

    def open_postal(self):
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.launch()
        self.wait('Place', seconds=45)
        self.adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                 '-d', f'pantopus://homes/{HOME}/verify-postcard', base.PACKAGE)
        self.wait('homePostalVerification')

    def press(self, tag):
        self.tap(tag, scroll=True)

    def no_controls(self, *tags):
        nodes = self.nodes()
        for tag in tags: assert self.match(nodes, tag) is None, 'Unexpected current control: ' + tag

    def await_database(self, predicate, action='state'):
        end = time.monotonic() + 30
        while time.monotonic() < end:
            state = self.fixture(action)
            if predicate(state): return state
            time.sleep(0.2)
        raise AssertionError('Expected original database decision before interrupting its response')

    def await_cancelled_worker(self, name):
        return self.await_database(lambda state: any(e.get('name') == name and e.get('state') == 'cancelled'
                                                   for e in state['events']))

    def fill_address(self):
        for field, value in [('Line1', 'Private residency fixture'), ('Line2', '602'), ('City', 'Test'),
                             ('State', 'WA'), ('Zip', '98607'), ('Country', 'US')]:
            self.field('homePostal' + field, value)
        self.evidence('complete-labeled-address-including-apartment')

    def confirm_mail(self):
        self.press('homePostalRequestMail')
        self.press('homePostalConfirmMail')

    def failed_status_changed_address(self):
        self.wait('homePostalRequestMail', scroll=True)
        for kind in ['before', 'malformed']:
            self.fixture('fault', 'POST', {'name': 'get_home_postcard_current_status', 'kind': kind, 'persistent': True})
            self.press('homePostalRefresh')
            self.wait('homePostalError')
            self.no_controls('homePostalRequestMail', 'homePostalLine1')
            self.evidence('status-' + kind + '-requires-retry')
            self.fixture('fault', 'POST', {'name': 'get_home_postcard_current_status', 'kind': 'clear'})
            self.press('homePostalRetry')
            self.wait('homePostalRequestMail', scroll=True)
        self.fill_address()
        self.press('homePostalRequestMail')
        self.fixture('unit', 'POST', {'unit': '603'})
        self.press('homePostalConfirmMail')
        self.wait('Review the recorded result', scroll=True)
        self.contains('The Home address changed', scroll=True)
        state = self.fixture('state')
        assert not state['cards'] and state['provider_calls'] == 0
        self.evidence('changed-apartment-refuses-original-mailing')
        self.press('homePostalAcknowledge')
        self.fixture('unit', 'POST', {'unit': '602'})

    def cancel_mailing(self):
        self.fill_address()
        self.fixture('native-hold', 'POST', {'suffix': '/postcard-requests'})
        self.confirm_mail()
        self.await_database(lambda s: s['held_admission'], 'native-state')
        self.open_postal()
        self.press('homePostalCancel')
        self.press('homePostalConfirmCancel')
        self.wait('Original request cancelled', scroll=True)
        self.fixture('native-release', 'POST')
        state = self.await_cancelled_worker('begin_home_postcard_request')
        assert not state['cards'] and state['provider_calls'] == 0
        self.evidence('cancellation-fences-delayed-mailing')
        self.press('homePostalAcknowledge')

    def mailing_recovery(self):
        self.fixture('keys', 'POST', {'enabled': False})
        self.fill_address()
        self.confirm_mail()
        self.wait('Recover your original request', scroll=True)
        self.continue_original_mailing()

    def continue_original_mailing(self):
        self.wait('Recover your original request', scroll=True)
        state = self.fixture('state')
        assert not state['cards'] and state['provider_calls'] == 0
        posts = [e for e in state['events'] if e.get('event') == 'native_request' and
                 e.get('method') == 'POST' and e.get('path') == f'/api/homes/{HOME}/postcard-requests']
        original = posts[-1]['request_id']
        encrypted = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/private_home_postal_v1.xml')
        assert b'Private residency fixture' not in encrypted and original.encode() not in encrypted
        self.evidence('initial-missing-keys-keeps-encrypted-original-without-postcard')
        self.fixture('keys', 'POST', {'enabled': True})
        self.fixture('fault', 'POST', {'name': 'begin_home_postcard_request', 'kind': 'lost'})
        self.press('homePostalRetryOriginal')
        state = self.await_database(lambda s: any(r['request_id'] == original and r['state'] == 'completed' for r in s['requests']))
        assert len(state['cards']) == 1 and state['provider_calls'] == 0
        assert len([r for r in state['requests'] if r['request_id'] == original]) == 1
        self.open_postal()
        self.wait('Mailing request recorded', scroll=True)
        self.press('homePostalAcknowledge')
        self.wait('homePostalResume', scroll=True)
        self.no_controls('homePostalRequestMail')
        self.fixture('keys', 'POST', {'enabled': False})
        self.press('homePostalResume')
        self.wait('Mailing request recorded', scroll=True)
        self.press('homePostalAcknowledge')
        self.wait('homePostalResume', scroll=True)
        state = self.fixture('state')
        assert len(state['cards']) == 1 and state['provider_calls'] == 0
        self.evidence('admitted-original-survives-missing-keys-without-another-card')
        self.fixture('keys', 'POST', {'enabled': True})
        self.fixture('delivery', 'POST', {'state': 'unknown'})
        self.press('homePostalResume')
        self.wait('Mailing request recorded', scroll=True)
        self.press('homePostalAcknowledge')
        self.wait('Mailing outcome is unknown', scroll=True)
        self.no_controls('homePostalRequestMail', 'homePostalResume')
        state = self.fixture('state')
        assert len(state['cards']) == 1 and state['provider_calls'] == 1
        self.evidence('unknown-delivery-does-not-resend-mail')

    def cancel_code(self):
        self.fixture('native-hold', 'POST', {'suffix': '/verifications'})
        self.field('homePostalCode', '111111')
        self.press('homePostalVerifyCode')
        self.await_database(lambda s: s['held_admission'], 'native-state')
        self.open_postal()
        self.press('homePostalCancel')
        self.press('homePostalConfirmCancel')
        self.wait('Original request cancelled', scroll=True)
        self.fixture('native-release', 'POST')
        state = self.await_cancelled_worker('verify_home_postcard_current')
        assert state['cards'][0]['attempts'] == 0
        assert state['occupancy']['verification_status'] == 'pending_postcard'
        self.evidence('cancelled-code-spends-no-guess-and-grants-no-access')
        self.press('homePostalAcknowledge')

    def code_recovery(self):
        printed = self.fixture('code')['code']
        self.fixture('fault', 'POST', {'name': 'verify_home_postcard_current', 'kind': 'lost'})
        self.field('homePostalCode', '222222' if printed == '111111' else '111111')
        self.press('homePostalVerifyCode')
        self.await_database(lambda s: s['cards'][0]['attempts'] == 1)
        self.open_postal()
        self.wait('Review the recorded result', scroll=True)
        assert self.fixture('state')['cards'][0]['attempts'] == 1
        self.evidence('lost-wrong-code-response-consumes-exactly-one-guess')
        self.press('homePostalAcknowledge')
        self.fixture('fault', 'POST', {'name': 'verify_home_postcard_current', 'kind': 'lost'})
        self.field('homePostalCode', printed)
        self.press('homePostalVerifyCode')
        self.await_database(lambda s: s['occupancy']['verification_status'] == 'provisional')
        self.open_postal()
        self.wait('Address proof recorded', scroll=True)
        state = self.fixture('state')
        assert state['occupancy']['verification_status'] == 'provisional' and state['provider_calls'] == 1
        self.no_controls('Open Home')
        self.evidence('recovered-proof-is-separate-from-current-access')
        self.press('homePostalAcknowledge')

    def retire_old_approval(self):
        self.fixture('access', 'POST', {'state': 'verified'})
        self.press('homePostalRefresh')
        self.wait('Open Home', scroll=True)
        self.no_controls('homePostalAttemptsRemaining')
        self.fixture('hold', 'POST', {'name': 'get_home_postcard_current_status'})
        self.press('homePostalRefresh')
        self.await_database(lambda s: s['held'])
        self.fixture('access', 'POST', {'state': 'removed'})
        self.background_and_return()
        self.wait('Household access needs review', scroll=True)
        self.fixture('release', 'POST')
        self.wait('Household access needs review', scroll=True)
        self.no_controls('Open Home', 'homePostalVerifyCode', 'homePostalAttemptsRemaining')
        state = self.fixture('state')
        assert state['provider_calls'] == 1 and len(state['cards']) == 1 and len(state['verifications']) == 3
        assert sorted(v['state'] for v in state['verifications']) == ['cancelled', 'completed', 'rejected']
        assert not state['occupancy']['is_active'] and not state['held']
        assert not self.fixture('native-state')['held_admission']
        self.evidence('retired-response-cannot-restore-removed-access')

    def run(self):
        if self.args.login: self.first_login()
        self.open_postal()
        phases = ['failed_status_changed_address', 'cancel_mailing', 'mailing_recovery',
                  'cancel_code', 'code_recovery', 'retire_old_approval']
        if self.args.resume == 'mailing_recovery': phases = ['continue_original_mailing', *phases[3:]]
        passed = []
        for phase in phases:
            getattr(self, phase)()
            passed.append(phase)
            (self.output / 'result.json').write_text(json.dumps({'passed': passed, 'complete': passed == phases}, indent=2))
            print('PASS installed Android postal: ' + phase, flush=True)
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--login', action='store_true')
    parser.add_argument('--resume', choices=['mailing_recovery'])
    journey = Journey(parser.parse_args())
    try:
        journey.run()
    except Exception:
        try: journey.evidence('failure-current-screen')
        except Exception: pass
        try: journey.adb('shell', 'am', 'force-stop', base.PACKAGE)
        except Exception: pass
        raise
