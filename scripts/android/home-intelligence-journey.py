#!/usr/bin/env python3
"""Installed Home malformed cards and committed-but-unconfirmed checklist recovery."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import time

spec = importlib.util.spec_from_file_location('dashboard_journey', Path(__file__).with_name('home-dashboard-journey.py'))
dashboard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dashboard)
base = dashboard.base


class Journey(dashboard.Journey):
    def visible_control(self, label):
        deadline = time.monotonic() + 60
        previous = None
        down = True
        while True:
            nodes = self.nodes()
            node = self.match(nodes, label)
            if node is not None:
                left, top, right, bottom = map(int, re.findall(r'\d+', node.get('bounds')))
                if right > left and bottom > top and top >= 300 and bottom <= 1850:
                    return node
                down = bottom == 0 or bottom > 1850
            else:
                signature = tuple((n.get('text'), n.get('content-desc'), n.get('bounds')) for n in nodes)
                if signature == previous:
                    down = not down
                previous = signature
            # Check the resulting viewport before timing out after a slow dump
            # or swipe; the inherited form navigator could miss its last move.
            if time.monotonic() >= deadline:
                raise RuntimeError('Missing fully visible control: ' + label)
            start, finish = ('1660', '950') if down else ('780', '1490')
            self.adb('shell', 'input', 'swipe', '530', start, '530', finish, '250')

    def retry_card(self, suffix):
        deadline = time.monotonic() + 45
        while True:
            node = self.wait('Retry', scroll=True)
            _, top, _, bottom = map(int, re.findall(r'\d+', node.get('bounds')))
            if top >= 300 and bottom <= 1750:
                break
            if time.monotonic() > deadline:
                raise RuntimeError('Card Retry did not become fully reachable')
            start, finish = ('780', '1220') if top < 300 else ('1660', '1000')
            self.adb('shell', 'input', 'swipe', '530', start, '530', finish, '250')
        responses = lambda: len([e for e in self.fixture('state')['events']
                                 if e['event'] == 'home_response' and e['path'].endswith(suffix)])
        before = responses()
        self.tap('Retry')
        deadline = time.monotonic() + 30
        while responses() <= before:
            if time.monotonic() > deadline:
                raise RuntimeError('Card Retry did not produce a new response')
            time.sleep(0.2)

    def run(self):
        self.adb('shell', 'pm', 'clear', base.PACKAGE)
        self.fixture('reset', 'POST')
        self.login()
        self.open_dashboard()
        self.current()
        checks = []
        card_cases = [
            ('malformed_health', '/health-score', 'Home health score '),
            ('inconsistent_health', '/health-score', 'Home health score '),
            ('wrong_home_action', '/health-score', 'Home health score '),
            ('malformed_checklist', '/seasonal-checklist', 'Mark Install or replace HEPA air filter complete'),
            ('wrong_home_checklist', '/seasonal-checklist', 'Mark Install or replace HEPA air filter complete'),
            ('incorrect_progress', '/seasonal-checklist', 'Mark Install or replace HEPA air filter complete'),
            ('duplicate_checklist', '/seasonal-checklist', 'Mark Install or replace HEPA air filter complete'),
            ('malformed_property', '/property-value', 'No estimate available'),
            ('invalid_property', '/property-value', 'No estimate available'),
            ('property_error_payload', '/property-value', 'No estimate available'),
        ] if self.args.cases != 'receipts' else []
        for mode, suffix, recovered in card_cases:
            self.cold(mode)
            self.contains('Current Home information is unavailable', scroll=True)
            self.wait('Retry')
            self.evidence(mode + '-rejected')
            self.fixture('mode', 'POST', {'mode': 'current'})
            self.retry_card(suffix)
            self.contains(recovered, scroll=True)
            self.evidence(mode + '-completed-recovery')
            checks.append(mode)
        state = self.fixture('state')
        assert not [e for e in state['events'] if e.get('method') == 'PATCH' or e['event'] == 'fixture_error']
        (self.output / 'malformed-cards-fixture.json').write_text(json.dumps(state, indent=2))

        receipt_cases = ('receipt_wrong_home', 'receipt_wrong_item', 'receipt_missing_status', 'receipt_lost_reply') if self.args.cases != 'cards' else ()
        for mode in receipt_cases:
            print('Checking committed checklist reply: ' + mode, flush=True)
            self.fixture('reset', 'POST')
            self.cold('current')
            self.visible_control('Mark Install or replace HEPA air filter complete')
            self.fixture('mode', 'POST', {'mode': mode})
            self.tap('Mark Install or replace HEPA air filter complete')
            self.contains("Couldn't load the seasonal checklist", scroll=True)
            self.evidence(mode + '-requires-reload')
            records = self.fixture('checklist')['items']
            assert len([item for item in records if item['status'] == 'completed']) == 1
            self.fixture('mode', 'POST', {'mode': 'current'})
            self.retry_card('/seasonal-checklist')
            self.contains('1/2 done', scroll=True)
            self.evidence(mode + '-committed-change-restored')
            self.cold('current')
            self.contains('1/2 done', scroll=True)
            state = self.fixture('state')
            assert len([e for e in state['events'] if e['event'] == 'home_read' and e['method'] == 'PATCH']) == 1
            assert not [e for e in state['events'] if e['event'] == 'fixture_error']
            (self.output / (mode + '-fixture.json')).write_text(json.dumps(state, indent=2))
            checks.append(mode)
        (self.output / 'result.json').write_text(json.dumps({'passed': True, 'checks': checks}, indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print(f'PASS {len(card_cases)} malformed cards and {len(receipt_cases)} committed-but-unconfirmed checklist recoveries with cold returns')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--cases', choices=('all', 'cards', 'receipts'), default='all')
    journey = Journey(parser.parse_args())
    try:
        journey.run()
    except Exception:
        try:
            journey.evidence('failure-current-screen')
        except Exception:
            pass
        raise
