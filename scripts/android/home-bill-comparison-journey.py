#!/usr/bin/env python3
"""Installed debug app -> production bill HTTP/service -> isolated local SQL.

Uses normal sign-in and Profile/My homes navigation on the guarded owned AVD.
No owner app, authentication store, hosted database or paid provider is changed.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import time

spec = importlib.util.spec_from_file_location('relationship_journey', Path(__file__).with_name('home-claim-relationship-journey.py'))
relationship = importlib.util.module_from_spec(spec)
spec.loader.exec_module(relationship)
base = relationship.base


class Journey(relationship.Journey):
    def evidence(self, name):
        if name.startswith('failure'):
            try:
                (self.output / 'fixture-at-failure.json').write_text(json.dumps(self.fixture('state'), indent=2))
            except Exception:
                # Diagnostics must not replace the original failed assertion.
                pass
        super().evidence(name)
        # Normal Home has no app-lock session here. Never remove FLAG_SECURE.
        (self.output / (name + '.png')).write_bytes(self.adb('exec-out', 'screencap', '-p'))

    def login(self):
        self.launch()
        self.tap('Sign in')
        self.fill('Email address', 'bill-ui@example.com')
        self.fill('Password', 'synthetic-loopback-only')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Log in')
        self.wait('Place', seconds=45)

    def open_dashboard(self):
        if self.match(self.nodes(), 'Profile') is None:
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Profile')
        self.tap('My homes', scroll=True)
        self.tap('Bill UI Fixture', scroll=True)

    def reopen(self, mode):
        print('Checking installed bill state: ' + mode, flush=True)
        self.fixture('mode', 'POST', {'mode': mode})
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.launch()
        self.wait('Place', seconds=45)
        self.open_dashboard()

    def contains(self, text, scroll=False, seconds=30):
        end = time.monotonic() + seconds
        previous = None
        down = True
        while time.monotonic() < end:
            nodes = self.nodes()
            if any(text.casefold() in node.get('text', '').casefold() or text.casefold() in node.get('content-desc', '').casefold() for node in nodes):
                return
            if scroll:
                # A card can finish loading above us after a layout change.
                # Reverse at an observed scroll boundary instead of staying there.
                signature = tuple((n.get('text'), n.get('content-desc'), n.get('bounds')) for n in nodes)
                if signature == previous:
                    down = not down
                previous = signature
                start, finish = ('1660', '780') if down else ('780', '1660')
                self.adb('shell', 'input', 'swipe', '530', start, '530', finish, '250')
        raise RuntimeError('Missing bill content: ' + text)

    def absent(self, *texts):
        nodes = self.nodes()
        for text in texts:
            assert not any(text.casefold() in node.get('text', '').casefold() or text.casefold() in node.get('content-desc', '').casefold() for node in nodes), text

    def retry_bill(self):
        import re
        deadline = time.monotonic() + 30
        while True:
            node = self.wait('Retry', scroll=True)
            _, top, _, bottom = map(int, re.findall(r'\d+', node.get('bounds')))
            if top >= 300 and bottom <= 1750:
                break
            if time.monotonic() > deadline:
                raise RuntimeError('Bill Retry did not become fully reachable')
            start, finish = ('780', '1220') if top < 300 else ('1660', '1000')
            self.adb('shell', 'input', 'swipe', '530', start, '530', finish, '250')
        responses = lambda: len([e for e in self.fixture('state')['events'] if e['event'] == 'bill_response'])
        before = responses()
        self.tap('Retry')
        deadline = time.monotonic() + 20
        while responses() <= before:
            if time.monotonic() > deadline:
                raise RuntimeError('Bill Retry did not produce a new HTTP response')
            time.sleep(0.2)

    def run(self):
        self.adb('shell', 'pm', 'clear', base.PACKAGE)
        self.fixture('reset', 'POST')
        self.login()
        self.open_dashboard()
        self.contains('104.70', scroll=True)
        self.contains('142.50')
        self.absent('$1.05')
        self.evidence('current-fractional-matching-month')
        for mode in ('unmatched', 'optout'):
            self.reopen(mode)
            self.contains('No comparison for this month', scroll=True)
            self.contains('142.50')
            self.absent('104.70')
            self.evidence(mode + '-comparison-unavailable')
        for mode in ('error', 'malformed', 'legacy', 'wrong_currency'):
            self.reopen(mode)
            self.contains("Couldn't load bill trends" if mode == 'error' else 'Current bill information is unavailable', scroll=True)
            self.absent('142.50', 'No paid USD bills')
            self.retry_bill()
            self.contains("Couldn't load bill trends" if mode == 'error' else 'Current bill information is unavailable', scroll=True)
            self.evidence(mode + '-retryable')
            self.fixture('mode', 'POST', {'mode': 'current'})
            self.retry_bill()
            self.contains('104.70', scroll=True)
            self.contains('142.50')
        self.reopen('empty')
        self.contains('No paid USD bills', scroll=True)
        self.evidence('confirmed-empty')
        self.reopen('denied')
        # A card heading is also present while loading; wait for the finished state.
        self.contains('No estimate available', scroll=True)
        self.adb('shell', 'input', 'swipe', '530', '1660', '530', '780', '250')
        self.absent('Bill trends', '142.50')
        self.evidence('current-permission-denied')
        self.reopen('current')
        self.contains('104.70', scroll=True)
        self.contains('142.50')
        final = self.fixture('state')
        reads = [event for event in final['events'] if event['event'] == 'bill_read']
        assert len(reads) >= 12
        assert all(event['format'] == '2' and event['currency'] == 'USD' for event in reads)
        (self.output / 'fixture-final.json').write_text(json.dumps(final, indent=2))
        (self.output / 'result.json').write_text(json.dumps({'passed': True, 'reads': len(reads)}, indent=2))
        self.evidence('restored-current-comparison')
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print('PASS installed Android bill amounts, matching months, cohort, recovery, format, empty and current permission')


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
