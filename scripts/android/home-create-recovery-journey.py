#!/usr/bin/env python3
"""Owned installed Android creation/restart/cancellation against production HTTP/SDK/SQL.

Use the Home creation fixture on 18084 and the specifically owned recurrence AVD.
This driver never clears application data or replaces authentication storage.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import time
import urllib.request

spec = importlib.util.spec_from_file_location('entry_journey', Path(__file__).with_name('home-address-entry-journey.py'))
entry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(entry)
base = entry.base
ORIGIN = 'http://127.0.0.1:18084'
STREET = '9141 Home Creation Fixture Way'
SECRET = 'synthetic-loopback-access'


class Journey(entry.Journey):
    def nodes(self):
        # Cold startup can briefly lose its accessibility root while the owned
        # emulator and native analysis share this Mac. Keep the original request.
        end = time.monotonic() + 60
        while True:
            try:
                return super().nodes()
            except RuntimeError as error:
                if str(error) != 'No current UI hierarchy' or time.monotonic() >= end: raise
                time.sleep(0.3)

    def fixture(self, action, method='GET', body=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(ORIGIN + '/fixture/' + action, method=method, data=data,
                                         headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)

    def first_login(self):
        self.launch()
        nodes = self.nodes()
        if self.match(nodes, 'Place') is not None:
            self.tap('Profile')
            self.tap('Log out', scroll=True)
            self.tap('Sign out')
        self.login()

    def login(self):
        self.launch()
        end = time.monotonic() + 30
        while time.monotonic() < end:
            nodes = self.nodes()
            if self.match(nodes, 'Email address') is not None: break
            if self.match(nodes, 'Sign in') is not None:
                self.tap('Sign in')
                break
        self.fill('Email address', 'entry-ui@example.invalid')
        self.fill('Password', 'synthetic-loopback-only')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Log in')
        self.wait('Place', seconds=45)

    def open_wizard(self):
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.launch()
        self.wait('Place', seconds=45)
        self.open_list()
        self.tap('Add a home')

    def complete_form(self, unit, role='Owner', incomplete=False):
        self.wait('Find your home')
        self.tap('Add address manually', scroll=True)
        for label, value in [('Street address', STREET), ('Unit or apartment (optional)', unit),
                             ('City', 'Test'), ('State', 'WA'), ('ZIP code', '98607')]:
            self.field(label, value)
        self.tap('Continue')
        self.contains('Address recognized', scroll=True)
        self.tap('Continue')
        self.tap(role, scroll=True)
        self.field('Label (e.g. Main WiFi, Front door)', 'Fixture network')
        if incomplete:
            self.tap('Continue')
            self.contains('Password/code is required', scroll=True)
            self.absent('Review and submit')
            self.evidence(unit + '-incomplete-optional-setup')
        self.tap('Show value', scroll=True)
        self.field('Password', SECRET)
        self.tap('Hide value', scroll=True)
        self.tap('Continue')
        self.contains('Review and submit', scroll=True)
        self.evidence(unit + '-review-original-home')

    def await_flag(self, key):
        end = time.monotonic() + 30
        while time.monotonic() < end:
            state = self.fixture('state')
            if state[key]: return state
            time.sleep(0.2)
        raise AssertionError('Expected held production request: ' + key)

    @staticmethod
    def home(state, unit):
        rows = [row for row in state['database']['homes'] if row['unit'] == unit]
        assert len(rows) == 1, 'Expected one Home for unit ' + unit
        return rows[0]

    def private_home(self, home):
        self.wait('My homes')
        self.contains('Unit ' + home['unit'], scroll=True)
        self.wait('myHomes.row_' + home['id'] + '.continue', scroll=True)
        self.contains('My tasks')
        self.contains('Private setup')
        self.absent('Ownership verified', 'Residency verified')

    def cancelled_request(self):
        self.open_wizard()
        self.complete_form('402', incomplete=True)
        self.fixture('mode', 'POST', {'mode': 'hold_provider'})
        self.tap('Submit')
        self.await_flag('held_provider')
        self.resume_cancelled_request()

    def resume_cancelled_request(self):
        state = self.fixture('state')
        assert state['held_provider'] and any(c['state'] == 'pending' for c in state['database']['commands'])
        self.open_wizard()
        self.wait('Finish adding your Home')
        self.tap('addHomeRecoveryCancel', scroll=True)
        self.tap('Cancel request')
        self.wait('Request cancelled')
        self.fixture('mode', 'POST', {'mode': 'current'})
        self.fixture('release-provider', 'POST')
        self.evidence('402-confirmed-cancellation-fences-delayed-worker')
        self.tap('Edit details')
        self.wait('Unit or apartment (optional)', scroll=True)
        assert any(n.get('class') == 'android.widget.EditText' and n.get('text') == '402' for n in self.nodes())
        state = self.fixture('state')
        assert not any(row['unit'] == '402' for row in state['database']['homes'])
        assert any(command['state'] == 'cancelled' for command in state['database']['commands'])
        self.back_to_discard()
        self.tap('Discard')

    def lost_reply(self):
        initial = len(self.fixture('state')['events'])
        self.open_wizard()
        self.complete_form('401')
        self.fixture('hold', 'POST', {'suffix': '/api/homes'})
        self.tap('Submit')
        state = self.await_flag('held')
        home = self.home(state, '401')
        assert all(home[key] == 1 for key in ['secrets', 'occupancies', 'pending_owners', 'preferences'])
        assert home['verified_occupancies'] == 0 and home['owner_id'] is None
        encrypted = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/private_home_creation_v1.xml')
        assert SECRET.encode() not in encrypted and STREET.encode() not in encrypted
        self.evidence('401-original-command-encrypted-and-awaiting-reply')
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.fixture('release', 'POST')
        self.open_wizard()
        self.wait('Home saved')
        self.absent('addHome_accessSecret', 'addHome_street')
        self.evidence('401-restarted-app-recovers-original-completion')
        self.tap('Open My Homes')
        self.private_home(home)
        self.evidence('401-current-private-home-with-unit')
        final = self.fixture('state')
        assert self.home(final, '401')['id'] == home['id']
        posts = [e for e in final['events'][initial:] if e.get('path') == '/api/homes' and e.get('method') == 'POST']
        assert len(posts) == 1, 'Status recovery must not create a second command'

    def atomic_refusal(self):
        initial = len(self.fixture('state')['events'])
        self.open_wizard()
        self.complete_form('403', role='Household member')
        self.fixture('reject-next-access', 'POST')
        self.tap('Submit')
        self.wait('Review your Home details')
        state = self.fixture('state')
        assert not any(row['unit'] == '403' for row in state['database']['homes'])
        self.evidence('403-optional-refusal-rolls-back-entire-home')
        self.fixture('restore-age', 'POST')
        self.tap('Edit details')
        self.tap('Continue')
        self.contains('Address recognized', scroll=True)
        self.tap('Continue')
        self.wait('Label (e.g. Main WiFi, Front door)', scroll=True)
        assert any(n.get('class') == 'android.widget.EditText' and n.get('text') == 'Fixture network' for n in self.nodes())
        self.tap('Continue')
        self.tap('Submit')
        self.wait('Home saved')
        final = self.fixture('state')
        home = self.home(final, '403')
        assert home['secrets'] == 1 and home['verified_occupancies'] == 0
        posts = [e for e in final['events'][initial:] if e.get('path') == '/api/homes' and e.get('method') == 'POST']
        assert len(posts) == 2 and posts[0]['request_id'] != posts[1]['request_id']
        self.tap('Open My Homes')
        self.private_home(home)
        self.contains('Unit 401', scroll=True)
        self.evidence('403-corrected-original-setup-and-distinct-units')

    def run(self):
        self.fixture('reset', 'POST')
        if self.args.login: self.first_login()
        for name in self.args.cases:
            getattr(self, name)()
        state = self.fixture('state')
        assert not any(e['event'] == 'fixture_error' for e in state['events'])
        (self.output / 'result.json').write_text(json.dumps({'passed': True, 'cases': self.args.cases}, indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print('PASS installed Android Home creation: ' + ', '.join(self.args.cases), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--login', action='store_true')
    parser.add_argument('--cases', nargs='+', choices=['cancelled_request', 'resume_cancelled_request', 'lost_reply', 'atomic_refusal'],
                        default=['cancelled_request', 'lost_reply', 'atomic_refusal'])
    journey = Journey(parser.parse_args())
    try:
        journey.run()
    except Exception:
        try: journey.evidence('failure-current-screen')
        except Exception: pass
        try: journey.adb('shell', 'am', 'force-stop', base.PACKAGE)
        except Exception: pass
        raise
