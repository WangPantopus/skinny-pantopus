#!/usr/bin/env python3
"""Owned installed Android -> real SDK/HTTP/SQL Home list and first-use routes."""
import argparse
import importlib.util
import json
from pathlib import Path
import time

spec = importlib.util.spec_from_file_location('dashboard', Path(__file__).with_name('home-dashboard-journey.py'))
dashboard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dashboard)
base = dashboard.base


class Journey(dashboard.Journey):
    def fill(self, label, value):
        self.tap(label)
        deadline = time.monotonic() + 15
        while True:
            field = self.match(self.nodes(), label)
            if field is not None and field.get('focused') == 'true': break
            if time.monotonic() > deadline: raise RuntimeError('Text field did not receive focus: ' + label)
        for character in value:
            self.adb('shell', 'input', 'text', character)
            time.sleep(0.05)
        if label == 'Email address': self.wait(value)

    def evidence(self, name):
        super().evidence(name)
        (self.output / (name + '-http.json')).write_text(json.dumps(self.fixture('state'), indent=2))

    def open_list(self):
        if self.match(self.nodes(), 'Profile') is None:
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Profile')
        self.tap('My homes', scroll=True)

    def cold_list(self, mode):
        print('Checking installed Home list: ' + mode, flush=True)
        self.fixture('reset', 'POST')
        self.fixture('mode', 'POST', {'mode': mode})
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.launch()
        self.wait('Place', seconds=45)
        self.open_list()

    def list_row(self):
        self.wait('Dashboard UI Fixture')
        self.contains('1 saved Home')
        self.absent('Private legal fixture name', 'Verified Home', 'Active home')

    def run(self):
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.adb('shell', 'pm', 'clear', base.PACKAGE)
        self.fixture('reset', 'POST')
        self.login()
        self.open_list()
        self.list_row()
        self.contains('Owner role')
        self.contains('Ownership verified')
        self.contains('Residency verified')
        self.evidence('current-list-distinct-authority')
        self.tap('Dashboard UI Fixture')
        self.current()
        self.evidence('current-list-real-dashboard')

        self.cold_list('role_owner_unverified_ownership')
        self.list_row()
        self.contains('Owner role')
        self.absent('Ownership verified')
        self.evidence('owner-role-without-ownership-proof')
        self.tap('Dashboard UI Fixture')
        self.current()
        self.contains('Shared Home', scroll=True)
        self.absent('Ownership verified')
        self.evidence('role-does-not-verify-dashboard')

        self.cold_list('verified_owner_no_occupancy')
        self.list_row()
        self.contains('Owner role')
        self.contains('Ownership verified')
        self.absent('Residency verified')
        self.evidence('verified-owner-without-residency')

        self.cold_list('minor_owner')
        self.list_row()
        self.contains('Member')
        self.absent('Owner role', 'More actions for Dashboard UI Fixture')
        self.evidence('minor-effective-role-and-no-delete')

        for mode, title, other in (
            ('pending_ownership', 'Continue ownership verification', 'Residency request'),
            ('pending_residency', 'Continue residency verification', 'Ownership request'),
        ):
            self.cold_list(mode)
            self.wait('Home verification')
            self.contains('1 saved Home')
            self.wait(title)
            self.absent('Ownership verified', 'Residency verified', other, 'Smoke alarm check')
            self.evidence(mode + '-personal-continuation')
            self.tap(title)
            # Count a real navigation/request, not only a list label.
            self.wait('Claim ownership' if mode == 'pending_ownership' else 'Verify residency')
            self.wait('Could not load verification. Try again.')
            self.absent('412 Elm St', 'Government-issued ID', 'Smoke alarm check')
            self.tap('Try again')
            self.wait('Could not load verification. Try again.')
            self.absent('1 saved Home')
            self.evidence(mode + '-destination')

        for mode in ('list_error', 'malformed_list'):
            self.cold_list(mode)
            self.wait('Try again')
            self.absent('Dashboard UI Fixture', 'No saved Homes yet')
            self.evidence(mode + '-retryable')
            self.fixture('mode', 'POST', {'mode': 'current'})
            self.tap('Try again')
            self.list_row()
            self.evidence(mode + '-recovered')

        self.cold_list('current')
        self.list_row()
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        self.fixture('hold', 'POST', {'suffix': '/my-homes'})
        self.launch()
        deadline = time.monotonic() + 30
        while not self.fixture('state')['held']:
            if time.monotonic() > deadline: raise RuntimeError('Current list reply was not held')
            time.sleep(0.2)
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        self.fixture('mode', 'POST', {'mode': 'denied'})
        self.launch()
        self.wait('No saved Homes yet')
        self.fixture('release', 'POST')
        for _ in range(3): self.absent('Dashboard UI Fixture', 'Ownership verified')
        self.evidence('foreground-denial-retires-held-list')

        self.cold_list('private_creator')
        self.list_row()
        self.contains('Your private Home')
        self.contains('Private setup')
        self.absent('Ownership verified', 'Residency verified', 'Continue ownership verification')
        self.tap('My tasks')
        self.wait('No tasks yet')
        self.wait('Add a task')
        self.evidence('private-list-to-real-tasks')
        state = self.fixture('state')
        all_events = state['events'] + [event for run in state['history'] for event in run]
        assert not any(e['event'] == 'fixture_error' for e in all_events)
        (self.output / 'fixture-final.json').write_text(json.dumps(state, indent=2))
        (self.output / 'result.json').write_text(json.dumps({'passed': True}, indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print('PASS native Home list identities, modes, recovery, held retirement and private Tasks', flush=True)


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
        try: journey.adb('shell', 'am', 'force-stop', base.PACKAGE)
        except Exception: pass
        raise
