#!/usr/bin/env python3
"""Private Home first use through installed Android UI and real local HTTP/SDK/SQL.

Uses the private-first-use fixture on 18084 and the owned recurrence AVD.
No data clearing, authentication injection, actual mailing or hosted mutation.
"""
import argparse
import importlib.util
import json
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location('residency', Path(__file__).with_name('home-residency-recovery-journey.py'))
residency = importlib.util.module_from_spec(spec)
spec.loader.exec_module(residency)
base = residency.base
HOME = 'ddc24100-0000-4000-8000-000000000606'


class Journey(residency.Journey):
    def open_list(self):
        if self.match(self.nodes(), 'Profile') is None:
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        super().open_list()

    def first_login(self):
        self.launch()
        if self.match(self.nodes(), 'Place') is not None:
            if self.match(self.nodes(), 'Profile') is None:
                self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
            self.tap('Profile')
            self.tap('Log out', scroll=True)
            self.tap('Sign out')
        self.login()

    def run(self):
        if self.args.login: self.first_login()
        if not self.args.resume_confirmation:
            self.launch()
            self.wait('Place', seconds=45)
            self.open_list()
            self.tap('myHomes.row_' + HOME + '.verification', scroll=True)
            self.wait('Request residency review')
            self.absent('Review mail verification', 'Open Home')
            self.evidence('private-home-before-mail')
            self.fixture('residency-read-fault', 'POST', {'kind': 'error', 'persistent': True})
            self.tap('homeResidencyRefresh', scroll=True)
            self.wait('homeResidencyError')
            self.fixture('residency-read-fault', 'POST', {'kind': 'clear'})
            self.tap('homeResidencyRetry')
            self.wait('Request residency review')
            self.tap('Check address and request residency', scroll=True)
            self.wait('Find your home')
            self.tap('Add address manually', scroll=True)
            for label, value in [('Street address', residency.STREET), ('Unit or apartment (optional)', '603'),
                                 ('City', 'Test'), ('State', 'WA'), ('ZIP code', '98607')]:
                self.field(label, value)
            for unit in ['603', '799']:
                if unit == '799':
                    self.tap('wizardLeadingButton')
                    self.field('Unit or apartment (optional)', unit)
                self.tap('Continue')
                self.contains('This address does not match the Home you opened.', scroll=True)
                self.absent('addHomeClaimedCorrect', 'Confirm address')
                state = self.fixture('state')
                assert not state['database']['commands'] and not state['database']['submissions']
                self.evidence('wrong-apartment-' + unit)
            self.tap('wizardLeadingButton')
            self.field('Unit or apartment (optional)', '606')
            self.tap('Continue')
        end = time.monotonic() + 30
        while time.monotonic() < end:
            nodes = self.nodes()
            if self.match(nodes, 'This address is correct') is not None:
                self.tap('This address is correct')
                self.wait('Confirm this is your address')
                assert any('606' in (n.get('text') or '') and residency.STREET in (n.get('text') or '') for n in self.nodes())
                self.tap('Confirm address')
                break
            if any((n.get('text') or '').startswith('Address recognized') for n in nodes):
                self.tap('Continue')
                break
        else:
            raise AssertionError('Selected private Home could not be confirmed')
        self.tap('Tenant', scroll=True)
        self.tap('Continue')
        self.contains('Review and submit', scroll=True)
        self.fixture('mode', 'POST', {'mode': 'residency_lost_reply'})
        self.tap('Submit claim')
        self.wait('Recover your residency request')
        self.evidence('lost-private-home-submission')
        original = self.fixture('state')['database']['submissions']
        assert len(original) == 1
        self.open_wizard()
        self.wait('Residency request saved')
        self.tap('Open My Homes')
        self.tap('myHomes.row_' + HOME + '.continue', scroll=True)
        self.wait('Address verification is required')
        self.contains('Review mail verification', scroll=True)
        self.absent('Check address and request residency', 'Open Home')
        self.evidence('saved-request-before-separate-mail')
        state = self.fixture('state')
        home = self.home(state, '606')
        assert home['occupancies'] == 1 and home['verified_occupancies'] == 0 and len(home['claims']) == 1
        assert not state['database']['commands'] and state['database']['submissions'] == original
        posts = [e for e in state['events'] if e.get('method') == 'POST' and e.get('path') == f'/api/homes/{HOME}/residency-submissions']
        assert len(posts) == 1
        assert not any('postcard' in e.get('path', '') or e['event'] == 'fixture_error' for e in state['events'])
        self.evidence('private-first-use-complete')
        (self.output / 'result.json').write_text(json.dumps({'complete': True, 'submission_posts': 1, 'claims': 1,
                                                          'mail_requests': 0, 'shared_access': False, 'resumed_confirmation': self.args.resume_confirmation}, indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print('PASS: installed private Home status, selected-address correction, retained original and separate mail next step', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--login', action='store_true')
    parser.add_argument('--resume-confirmation', action='store_true', help='Continue the observed selected-address modal after a driver interruption.')
    journey = Journey(parser.parse_args())
    try:
        journey.run()
    except Exception:
        try: journey.evidence('failure-current-screen')
        except Exception: pass
        raise
