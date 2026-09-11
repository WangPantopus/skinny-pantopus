#!/usr/bin/env python3
"""Installed Home retirement with produced authority/intelligence replies held on loopback."""
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
    def run(self):
        self.adb('shell', 'pm', 'clear', base.PACKAGE)
        self.fixture('reset', 'POST')
        self.login()
        self.open_dashboard()
        self.wait('Docs')
        self.evidence('current-shortcuts-readable')
        self.current()
        for suffix in ('/dashboard-access', '/health-score', '/seasonal-checklist', '/property-value'):
            print('Checking installed Home retirement: ' + suffix, flush=True)
            self.fixture('hold', 'POST', {'suffix': suffix})
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
            self.launch()
            deadline = time.monotonic() + 30
            while not self.fixture('state')['held']:
                if time.monotonic() > deadline:
                    raise RuntimeError('Production reply was not held: ' + suffix)
                time.sleep(0.2)
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
            self.fixture('mode', 'POST', {'mode': 'revoked'})
            self.launch()
            self.limited('revoked')
            self.fixture('release', 'POST')
            for _ in range(3):
                self.absent('Smoke alarm check', 'Quarterly Home check', '142.50', 'Home health score')
            self.evidence('retired-' + suffix[1:])
            self.fixture('mode', 'POST', {'mode': 'current'})
            self.tap('Reload access')
            self.current()
        final = self.fixture('state')
        held = [event for event in final['events'] if event['event'] == 'held']
        assert len(held) == 4
        assert not [event for event in final['events'] if event['event'] == 'fixture_error']
        assert not final['held']
        (self.output / 'fixture-final.json').write_text(json.dumps(final, indent=2))
        (self.output / 'result.json').write_text(json.dumps({'passed': True, 'held_replies': len(held)}, indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print('PASS installed Android retirement and restoration after four held authority/intelligence replies')


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
