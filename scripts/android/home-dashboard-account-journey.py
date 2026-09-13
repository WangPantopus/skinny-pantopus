#!/usr/bin/env python3
"""Actual installed logout, second-account login, cold denial and original-account return."""
import argparse
import importlib.util
import json
from pathlib import Path
import time

spec = importlib.util.spec_from_file_location('dashboard_journey', Path(__file__).with_name('home-dashboard-journey.py'))
dashboard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dashboard)
base = dashboard.base


class Journey(dashboard.Journey):
    def logout(self):
        self.tap('Back')
        self.wait('My homes')
        self.tap('Back')
        self.tap('Log out', scroll=True)
        self.wait('Sign out of Pantopus?')
        self.tap('Sign out')

    def sign_in_as(self, email):
        deadline = time.monotonic() + 45
        while True:
            nodes = self.nodes()
            if self.match(nodes, 'Email address') is not None:
                break
            if time.monotonic() > deadline:
                raise RuntimeError('Account login did not become reachable')
            for label in ('Use a different account', 'Sign in'):
                if self.match(nodes, label) is not None:
                    self.tap(label)
                    break
        self.absent('Smoke alarm check', 'Quarterly Home check', '142.50')
        for label, value in (('Email address', email), ('Password', 'synthetic-loopback-only')):
            self.tap(label)
            # Clear the remembered email through the normal focused text field.
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
            self.adb('shell', 'input', 'keyevent', *(['KEYCODE_DEL'] * 96))
            self.adb('shell', 'input', 'text', value)
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Log in')
        self.wait('Place', seconds=45)

    def run(self):
        self.adb('shell', 'pm', 'clear', base.PACKAGE)
        self.fixture('reset', 'POST')
        self.login()
        self.open_dashboard()
        self.current()
        self.evidence('original-account-current-home')
        print('Checking normal logout and a different account', flush=True)
        self.logout()
        self.sign_in_as('dashboard-other@example.com')
        self.open_dashboard()
        self.limited('second-account')
        self.evidence('second-account-cannot-see-original-home-summary')
        print('Checking cold return to the second account', flush=True)
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.launch()
        self.wait('Place', seconds=45)
        self.open_dashboard()
        self.limited('second-account-cold')
        print('Checking normal return to the original account', flush=True)
        self.logout()
        self.sign_in_as('bill-ui@example.com')
        self.open_dashboard()
        self.current()
        self.evidence('original-account-current-authority-restored')
        final = self.fixture('state')
        events = final['events']
        signed_in = [event['actor_id'] for event in events if event['event'] == 'signed_in']
        assert len(signed_in) == 3 and signed_in[0] == signed_in[2] and signed_in[0] != signed_in[1]
        assert len([event for event in events if event['event'] == 'signed_out']) == 2
        other = signed_in[1]
        other_reads = [event for event in events if event['event'] == 'home_read' and event['actor_id'] == other]
        assert not [event for event in other_reads if event['path'].endswith('/dashboard')]
        denied = [event for event in events if event['event'] == 'home_response' and event['actor_id'] == other
                  and event['path'].endswith('/dashboard-access') and event['status'] == 403]
        assert len(denied) >= 2
        assert not [event for event in events if event['event'] == 'fixture_error']
        (self.output / 'fixture-final.json').write_text(json.dumps(final, indent=2))
        (self.output / 'result.json').write_text(json.dumps({'passed': True, 'sign_ins': 3, 'sign_outs': 2,
                                                           'second_account_denials': len(denied)}, indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print('PASS installed account switching, cold current denial and original-account restoration')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    journey = Journey(parser.parse_args())
    try:
        journey.run()
    except Exception:
        try:
            journey.evidence('failure-current-screen')
        except Exception:
            pass
        raise
