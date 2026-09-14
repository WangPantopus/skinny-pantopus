#!/usr/bin/env python3
"""Owned installed Android Home -> production authority/aggregate/intelligence -> local SQL."""
import argparse
import importlib.util
import json
from pathlib import Path
import time

spec = importlib.util.spec_from_file_location('bill_journey', Path(__file__).with_name('home-bill-comparison-journey.py'))
bill = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bill)
base = bill.base


class Journey(bill.Journey):
    def open_dashboard(self):
        if self.match(self.nodes(), 'Profile') is None:
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Profile')
        self.tap('My homes', scroll=True)
        self.tap('Dashboard UI Fixture', scroll=True)

    def cold(self, mode):
        self.reopen(mode)

    def current(self):
        self.contains('Smoke alarm check', scroll=True)
        self.contains('Quarterly Home check')
        self.absent('Private legal fixture name')

    def limited(self, mode):
        self.wait('Reload access')
        self.absent('Smoke alarm check', 'Quarterly Home check', '142.50', 'Bill trends')
        if mode == 'pending_residency':
            self.contains('Your residency request')
            self.absent('Continue ownership verification')
        elif mode in ('pending_ownership', 'private_creator'):
            self.wait('Continue ownership verification')
        else:
            self.absent('Continue ownership verification')
        self.evidence('limited-' + mode)

    def run(self):
        self.adb('shell', 'pm', 'clear', base.PACKAGE)
        self.fixture('reset', 'POST')
        self.login()
        self.open_dashboard()
        self.current()
        self.evidence('current-real-summary')
        self.contains('current_household_member', scroll=True)
        # Move the complete activity row above the bottom navigation before proof.
        self.adb('shell', 'input', 'swipe', '530', '1660', '530', '1180', '250')
        self.contains('current_household_member: Fixture dashboard review')
        self.absent('Private legal fixture name')
        self.evidence('current-safe-activity-identity')
        for mode in ('summary_error', 'malformed_summary', 'wrong_home'):
            self.cold(mode)
            self.wait('Try again')
            self.absent('Smoke alarm check', '142.50')
            self.evidence(mode + '-unavailable')
            self.fixture('mode', 'POST', {'mode': 'current'})
            self.tap('Try again')
            self.current()
        self.cold('finance_denied')
        self.current()
        # A positive finished card is required before counting hidden bill UI.
        self.wait('No estimate available', scroll=True)
        self.adb('shell', 'input', 'swipe', '530', '1660', '530', '780', '250')
        self.absent('Bill trends', '142.50')
        self.evidence('loaded-finance-denial')
        for mode in ('pending_residency', 'pending_ownership', 'revoked', 'frozen', 'denied'):
            self.cold(mode)
            self.limited(mode)
        self.fixture('mode', 'POST', {'mode': 'current'})
        self.tap('Reload access')
        self.current()

        for mode, error, recovered in (
            ('health_error', "Couldn't load home health", 'Home health score 35 out of 100'),
            ('checklist_error', "Couldn't load the seasonal checklist", 'Mark Install or replace HEPA air filter complete'),
            ('property_error', "Couldn't load the property value", 'No estimate available'),
        ):
            self.cold(mode)
            self.wait(error, scroll=True)
            self.evidence(mode + '-unavailable')
            self.fixture('mode', 'POST', {'mode': 'current'})
            self.tap('Retry')
            self.wait(recovered, scroll=True)
            self.evidence(mode + '-completed-recovery')

        self.cold('current')
        self.current()
        self.fixture('hold', 'POST', {'suffix': '/dashboard'})
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        self.launch()
        deadline = time.monotonic() + 20
        while not self.fixture('state')['held']:
            if time.monotonic() > deadline: raise RuntimeError('Production aggregate was not held')
            time.sleep(0.2)
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        self.fixture('mode', 'POST', {'mode': 'revoked'})
        self.launch()
        self.limited('revoked')
        self.fixture('release', 'POST')
        # More than one hierarchy capture after the obsolete response is released.
        for _ in range(3): self.absent('Smoke alarm check', '142.50')
        self.evidence('held-aggregate-cannot-revive-private-home')
        self.fixture('mode', 'POST', {'mode': 'current'})
        self.tap('Reload access')
        self.current()
        self.cold('private_creator')
        self.limited('private_creator')
        self.tap('Open your Tasks')
        self.wait('No tasks yet')
        self.wait('Add a task')
        self.evidence('private-first-use-tasks-destination')
        state = self.fixture('state')
        (self.output / 'fixture-final.json').write_text(json.dumps(state, indent=2))
        errors = [e for e in state['events'] if e['event'] == 'fixture_error']
        assert not errors
        reads = [e for e in state['events'] if e['event'] == 'home_read']
        (self.output / 'result.json').write_text(json.dumps({'passed': True, 'production_reads': len(reads)}, indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print('PASS installed Android current Home, unavailable/retry, current applicants, foreground retirement and private Tasks')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    journey = Journey(parser.parse_args())
    try:
        journey.run()
    except Exception:
        try: journey.evidence('failure-current-screen')
        except Exception: pass
        raise
