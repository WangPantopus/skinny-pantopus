#!/usr/bin/env python3
"""Owned Android joining/status UI against real loopback HTTP, SDK and SQL.

Uses the existing synthetic residency fixture on 18084 and the owned recurrence
AVD. Never clears app data, changes auth storage or contacts a mail provider.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import time
import subprocess
import re

spec = importlib.util.spec_from_file_location('creation', Path(__file__).with_name('home-create-recovery-journey.py'))
creation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(creation)
base = creation.base
STREET = creation.STREET


class Journey(creation.Journey):
    def nodes(self):
        # A killed inspector is not an app failure or a valid stale hierarchy.
        # Retry only this read; acceptance still requires fresh observed controls.
        for attempt in range(3):
            try:
                return super().nodes()
            except subprocess.CalledProcessError as error:
                if error.returncode != 137 or attempt == 2: raise
                time.sleep(0.5)

    def open_list(self):
        self.tap('Profile')
        # My homes is below Saved places in the Profile Activity section.
        # Move consistently down instead of reversing before reaching it.
        for _ in range(24):
            if self.match(self.nodes(), 'My homes') is not None:
                self.tap('My homes')
                return
            self.adb('shell', 'input', 'swipe', '530', '1660', '530', '780', '250')
        raise AssertionError('My homes did not appear in the Profile Activity section')

    def background_and_return(self):
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        # Await the observed launcher before starting the existing Activity;
        # otherwise the still-running Home transition can cover the app again.
        self.wait('Google app')
        self.launch()

    def acknowledge_prior_rejection(self):
        self.open_wizard()
        self.wait('Review your residency request')
        self.evidence('previous-refusal-keeps-original-before-acknowledgement')
        self.tap('Edit details')
        self.wait('Unit or apartment (optional)', scroll=True)

    def complete_joining(self, unit, role='Tenant'):
        self.wait('Find your home')
        self.tap('Add address manually', scroll=True)
        for label, value in [('Street address', STREET), ('Unit or apartment (optional)', unit),
                             ('City', 'Test'), ('State', 'WA'), ('ZIP code', '98607')]:
            self.field(label, value)
        self.tap('Continue')
        end = time.monotonic() + 30
        while time.monotonic() < end:
            nodes = self.nodes()
            if self.match(nodes, 'This address is correct') is not None:
                self.tap('This address is correct')
                self.wait('Confirm this is your address')
                assert any(unit in (n.get('text') or '') and STREET in (n.get('text') or '') for n in self.nodes())
                self.tap('Confirm address')
                break
            if any((n.get('text') or '').startswith('Address recognized') for n in nodes):
                self.tap('Continue')
                break
        else:
            raise AssertionError('Selected Home address could not be confirmed')
        self.tap(role, scroll=True)
        self.absent('Label (e.g. Main WiFi, Front door)', 'addHome_accessSecret')
        self.tap('Continue')
        self.contains('Review and submit', scroll=True)
        self.evidence(unit + '-selected-address-role-review')

    def cancel_delayed(self):
        self.open_wizard()
        self.complete_joining('605')
        self.fixture('hold-submission', 'POST')
        self.tap('Submit claim')
        self.await_flag('held_submission')
        self.resume_cancel_delayed()

    def resume_cancel_delayed(self):
        assert self.fixture('state')['held_submission']
        self.open_wizard()
        self.wait('Recover your residency request')
        self.tap('addHomeRecoveryCancel', scroll=True)
        self.tap('Cancel request')
        self.wait('Request cancelled')
        self.fixture('release-submission', 'POST')
        home = self.home(self.fixture('state'), '605')
        assert home['occupancies'] == 0 and not home['claims']
        self.evidence('605-cancelled-command-prevents-delayed-admission')
        self.tap('Edit details')
        self.wait('Unit or apartment (optional)', scroll=True)
        assert any(n.get('class') == 'android.widget.EditText' and n.get('text') == '605' for n in self.nodes())

    def changed_unit(self):
        self.open_wizard()
        self.complete_joining('602', 'Household member')
        self.fixture('change-unit', 'POST', {'home': 602, 'unit': '612'})
        self.tap('Submit claim')
        self.wait('Review your residency request')
        home = self.home(self.fixture('state'), '612')
        assert home['occupancies'] == 0 and not home['claims']
        self.evidence('602-changed-unit-refuses-original-request')
        self.tap('Edit details')
        self.wait('Unit or apartment (optional)', scroll=True)
        assert any(n.get('class') == 'android.widget.EditText' and n.get('text') == '602' for n in self.nodes())

    def lost_reply_current_status(self):
        self.open_wizard()
        self.complete_joining('601')
        self.fixture('mode', 'POST', {'mode': 'residency_lost_reply'})
        self.tap('Submit claim')
        self.wait('Recover your residency request')
        home = self.home(self.fixture('state'), '601')
        assert home['occupancies'] == 1 and home['claims'][0]['status'] == 'pending'
        encrypted = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/private_home_creation_v1.xml')
        assert STREET.encode() not in encrypted
        self.evidence('601-lost-submission-keeps-protected-original')
        self.open_wizard()
        self.wait('Residency request saved')
        self.evidence('601-restart-recovers-same-command')
        self.tap('Open My Homes')
        self.tap('myHomes.row_' + home['id'] + '.continue', scroll=True)
        self.wait('Waiting for household review')
        self.contains(STREET + ', 601')
        self.absent('Open Home', 'Upload proof')
        self.evidence('601-current-household-review')
        for kind in ['error', 'malformed']:
            self.fixture('residency-read-fault', 'POST', {'kind': kind, 'persistent': True})
            self.tap('homeResidencyRefresh', scroll=True)
            self.wait('homeResidencyError')
            self.absent('homeResidencyAddress', 'Open Home')
            self.evidence('601-unavailable-' + kind)
            self.fixture('residency-read-fault', 'POST', {'kind': 'clear'})
            self.tap('homeResidencyRetry')
            self.wait('Waiting for household review')
        self.fixture('residency-state', 'POST', {'home': 601, 'state': 'verified'})
        self.tap('homeResidencyRefresh', scroll=True)
        self.wait('Household access is available')
        self.contains('Open Home')
        self.fixture('hold', 'POST', {'suffix': '/my-residency'})
        self.tap('homeResidencyRefresh', scroll=True)
        self.await_flag('held')
        self.fixture('residency-state', 'POST', {'home': 601, 'state': 'removed'})
        self.background_and_return()
        self.wait('Household access needs review')
        self.fixture('release', 'POST')
        self.wait('Household access needs review')
        self.absent('Open Home')
        self.evidence('601-retired-reply-cannot-restore-removed-access')
        self.tap('homeResidencyBack')
        self.contains(STREET + ', 601', scroll=True)
        self.contains('Review recorded')
        self.evidence('601-personal-history-survives-removal')
        state = self.fixture('state')
        posts = [e for e in state['events'] if e.get('method') == 'POST' and
                 e.get('path') == '/api/homes/' + home['id'] + '/residency-submissions']
        assert len(posts) == 1

    def rejected_resubmission(self):
        self.open_wizard()
        self.complete_joining('604', 'Household member')
        self.tap('Submit claim')
        self.wait('Residency request saved')
        home = self.home(self.fixture('state'), '604')
        assert home['occupancies'] == 1 and len(home['claims']) == 1
        assert home['claims'][0]['status'] == 'pending' and home['claims'][0]['claimed_role'] == 'household'
        self.evidence('604-rejected-request-reuses-existing-records')
        self.tap('Open My Homes')
        self.tap('myHomes.row_' + home['id'] + '.continue', scroll=True)
        self.wait('Waiting for household review')
        self.absent('Open Home')

    def history_pagination(self):
        self.fixture('residency-history', 'POST', {'count': 51})
        self.resume_history_pagination()

    def resume_history_pagination(self):
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.launch()
        self.wait('Place', seconds=45)
        self.open_list()
        for _ in range(65):
            node = self.match(self.nodes(), 'myHomes.residency-more')
            if node is not None:
                bounds = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
                if len(bounds) == 4 and 350 < (bounds[1] + bounds[3]) // 2 < 1850: break
            self.adb('shell', 'input', 'swipe', '530', '1660', '530', '580', '200')
        self.evidence('history-first-page-load-more')
        self.tap('myHomes.residency-more')
        self.evidence('history-after-load-more')
        for _ in range(65):
            if self.match(self.nodes(), 'Personal historical request 50') is not None: break
            self.adb('shell', 'input', 'swipe', '530', '1660', '530', '580', '200')
        self.wait('Personal historical request 50')
        self.absent('myHomes.residency-more')
        self.evidence('history-complete-beyond-first-50')
        self.fixture('residency-read-fault', 'POST', {'kind': 'error', 'persistent': True})
        self.background_and_return()
        self.wait('myHomes.residency-retry', scroll=True)
        self.absent('Personal historical request 50')
        self.evidence('history-failed-read-has-explicit-retry')
        self.fixture('residency-read-fault', 'POST', {'kind': 'clear'})
        self.tap('myHomes.residency-retry')
        self.contains('Personal historical request 0', scroll=True)

    def run(self):
        if self.args.login: self.first_login()
        passed = []
        for name in self.args.cases:
            self.adb('shell', 'am', 'force-stop', base.PACKAGE)
            if name not in ['resume_cancel_delayed', 'acknowledge_prior_rejection']: self.fixture('reset', 'POST')
            getattr(self, name)()
            state = self.fixture('state')
            assert not any(e['event'] == 'fixture_error' for e in state['events'])
            self.evidence(name + '-complete')
            passed.append(name)
            (self.output / 'result.json').write_text(json.dumps({'passed': passed, 'complete': passed == self.args.cases}, indent=2))
            print('PASS installed Android residency: ' + name, flush=True)
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--login', action='store_true')
    parser.add_argument('--cases', nargs='+', choices=['cancel_delayed', 'resume_cancel_delayed', 'acknowledge_prior_rejection', 'changed_unit', 'lost_reply_current_status',
                        'rejected_resubmission', 'history_pagination', 'resume_history_pagination', 'cancelled_request', 'lost_reply', 'atomic_refusal'], default=['cancel_delayed', 'changed_unit',
                        'lost_reply_current_status', 'rejected_resubmission', 'history_pagination'])
    journey = Journey(parser.parse_args())
    try:
        journey.run()
    except Exception:
        try: journey.evidence('failure-current-screen')
        except Exception: pass
        try: journey.adb('shell', 'am', 'force-stop', base.PACKAGE)
        except Exception: pass
        raise
