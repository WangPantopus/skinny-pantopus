#!/usr/bin/env python3
"""Installed Home currency/history, delayed replies and visible layout acceptance.

Uses the bill journey's normal login and owned-AVD guard. SQL is isolated and
provider-free. Screenshots preserve the app's existing capture protection.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import time

spec = importlib.util.spec_from_file_location('bill_journey', Path(__file__).with_name('home-bill-comparison-journey.py'))
bill = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bill)
base = bill.base


class Journey(bill.Journey):
    def currency(self, current, target):
        self.tap('Currency: ' + current, scroll=True)
        self.tap(target)
        self.wait('Currency: ' + target)

    def cold_dashboard(self):
        # No mode write: it would alter the deliberately seeded 24-month history.
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.launch()
        self.wait('Place', seconds=45)
        self.open_dashboard()

    def expand_months(self, evidence_name):
        self.wait('Monthly totals', scroll=True)
        self.evidence(evidence_name + '-before-expand')
        # Assert the visible reaction before looking for a later monthly row.
        self.tap('Monthly totals')
        self.wait('Hide monthly totals')
        self.evidence(evidence_name + '-expanded')

    def monthly_row(self, month):
        end = time.monotonic() + 50
        while time.monotonic() < end:
            nodes = self.nodes()
            row = next((n for n in nodes if n.get('content-desc', '').startswith('Monthly total for ' + month)), None)
            if row is not None:
                return row
            self.adb('shell', 'input', 'swipe', '530', '1660', '530', '780', '250')
        raise RuntimeError('Missing reachable monthly row: ' + month)

    def unobscured(self, row):
        create = self.match(self.nodes(), 'Create')
        assert create is not None, 'Create must remain available'
        a, b = (list(map(int, re.findall(r'\d+', n.get('bounds')))) for n in (row, create))
        assert a[2] > a[0] and a[3] > a[1], 'Monthly row must have visible bounds'
        assert min(a[2], b[2]) <= max(a[0], b[0]) or min(a[3], b[3]) <= max(a[1], b[1]), 'Create covers monthly amount'

    def run(self):
        print('Checking normal sign-in and monthly USD/CAD presentation', flush=True)
        self.adb('shell', 'pm', 'clear', base.PACKAGE)
        self.fixture('reset', 'POST')
        self.login()
        self.open_dashboard()
        self.contains('142.50', scroll=True)
        self.expand_months('usd-monthly')
        self.contains('210.25', scroll=True)
        self.contains('104.70', scroll=True)
        self.evidence('usd-monthly-totals')
        self.currency('USD', 'CAD')
        self.contains('999.99')
        self.absent('142.50', '104.70')
        self.evidence('cad-never-mixes-usd-neighbors')
        self.currency('CAD', 'USD')
        self.contains('142.50')
        print('Checking a held CAD reply after selecting USD', flush=True)
        self.fixture('hold-currency', 'POST', {'currency': 'CAD'})
        self.currency('USD', 'CAD')
        assert self.fixture('state')['held'], 'CAD response must actually be held'
        self.absent('142.50', '999.99')
        self.currency('CAD', 'USD')
        self.contains('142.50')
        self.fixture('release-read', 'POST')
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            self.absent('999.99')
        self.contains('142.50')
        self.evidence('earlier-cad-response-retired')
        history = self.fixture('history', 'POST')
        print('Checking 24 months after a normal cold return', flush=True)
        self.cold_dashboard()
        self.contains('137.25', scroll=True)
        self.expand_months('full-history')
        oldest = self.monthly_row(history['periods']['oldest'])
        assert '160.25' in oldest.get('content-desc', '')
        self.unobscured(oldest)
        self.evidence('oldest-of-24-months-visible')
        latest = self.monthly_row(history['periods']['latest'])
        assert '137.25' in latest.get('content-desc', '')
        assert '104.18' in latest.get('content-desc', '')
        self.unobscured(latest)
        self.evidence('latest-of-24-months-visible')
        self.tap('Back')
        self.wait('My homes')
        self.evidence('single-back-to-my-homes')
        final = self.fixture('state')
        reads = [event for event in final['events'] if event['event'] == 'bill_read']
        assert all(event['format'] == '2' for event in reads)
        assert {event['currency'] for event in reads} == {'USD', 'CAD'}
        assert not final['held']
        (self.output / 'fixture-final.json').write_text(json.dumps(final, indent=2))
        (self.output / 'result.json').write_text(json.dumps({'passed': True, 'reads': len(reads), 'months': 24}, indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print('PASS installed Android currencies, delayed reply, 24-month history, visible amounts and Back')


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
