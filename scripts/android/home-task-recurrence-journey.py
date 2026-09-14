#!/usr/bin/env python3
"""Installed Android recurrence acceptance using only normal UI and loopback HTTP.

Requires an installed debug APK compiled for http://10.0.2.2:18083 and the
scripts/ios/home-task-recurrence-ui-fixture.py server. This driver clears only
the debug app on the specifically named dedicated recurrence AVD. Evidence must
stay outside the checkout. It never seeds authentication or modifies an owner AVD.
"""
import argparse
import collections
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.request
import xml.etree.ElementTree as ET

PACKAGE = 'app.pantopus.android.debug'
ACTIVITY = PACKAGE + '/app.pantopus.android.MainActivity'
AVD = 'Pantopus_Home_Recurrence_Acceptance'
ORIGIN = 'http://127.0.0.1:18083'
HOME = '53000000-0000-4000-8000-000000000001'
TASK = '53000000-0000-4000-8000-000000000003'


class Journey:
    def __init__(self, args):
        self.args = args
        assert args.output.is_absolute(), 'Evidence output must be absolute'
        self.output = args.output.resolve()
        assert self.output.is_absolute() and not self.output.is_relative_to(Path(__file__).resolve().parents[2])
        assert args.serial.startswith('emulator-')
        os.umask(0o077)
        self.output.mkdir(parents=True, exist_ok=True)
        assert self.adb('emu', 'avd', 'name').decode().splitlines()[0] == AVD

    def adb(self, *args):
        return subprocess.run([self.args.adb, '-s', self.args.serial, *args], check=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30).stdout

    def fixture(self, action, method='GET'):
        request = urllib.request.Request(ORIGIN + '/fixture/' + action, method=method)
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.load(response)

    def nodes(self):
        for _ in range(3):
            result = self.adb('shell', 'uiautomator', 'dump', '/sdcard/recurrence-ui.xml')
            if b'dumped' in result:
                data = self.adb('shell', 'cat', '/sdcard/recurrence-ui.xml')
                (self.output / 'current.xml').write_bytes(data)
                return list(ET.fromstring(data).iter('node'))
            time.sleep(0.3)
        raise RuntimeError('No current UI hierarchy')

    @staticmethod
    def match(nodes, label):
        return next((node for key in ('content-desc', 'resource-id', 'text') for node in nodes if node.get(key) == label), None)

    def wait(self, label, seconds=30, scroll=False):
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            nodes = self.nodes()
            node = self.match(nodes, label)
            if node is not None:
                return node
            if self.match(nodes, 'Allow Pantopus to send you notifications?') is not None:
                deny = self.match(nodes, 'Don’t allow')
                if deny is None:
                    deny = self.match(nodes, "Don't allow")
                if deny is not None:
                    left, top, right, bottom = map(int, re.findall(r'\d+', deny.get('bounds')))
                    self.adb('shell', 'input', 'tap', str((left + right) // 2), str((top + bottom) // 2))
                    continue
            if scroll:
                self.adb('shell', 'input', 'swipe', '530', '1660', '530', '780', '250')
            time.sleep(0.3)
        raise RuntimeError('Missing current control: ' + label)

    def tap(self, label, scroll=False):
        node = self.wait(label, scroll=scroll)
        assert node.get('enabled') == 'true', label + ' disabled'
        left, top, right, bottom = map(int, re.findall(r'\d+', node.get('bounds')))
        assert right > left and bottom > top, label + ' has no visible bounds'
        self.adb('shell', 'input', 'tap', str((left + right) // 2), str((top + bottom) // 2))

    def fill(self, label, value):
        self.tap(label)
        self.adb('shell', 'input', 'text', value.replace(' ', '%s'))

    def evidence(self, name):
        self.nodes()
        (self.output / (name + '.xml')).write_bytes((self.output / 'current.xml').read_bytes())
        # The private dialog sets FLAG_SECURE. The hierarchy is the review
        # artifact; do not disable the app's screen-capture protection for proof.

    def launch(self):
        self.adb('shell', 'am', 'start', '-n', ACTIVITY)

    def cold_return(self):
        self.adb('shell', 'am', 'force-stop', PACKAGE)
        self.launch()
        self.wait('Place', seconds=45)
        self.open_schedule()

    def open_schedule(self):
        self.adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                 '-d', f'pantopus://homes/{HOME}/tasks/{TASK}', PACKAGE)
        self.wait('Recurring copper task')
        self.tap('Repeat schedule')
        end = time.monotonic() + 30
        while time.monotonic() < end:
            labels = [node.get('text', '') for node in self.nodes()]
            if any(label in ('Automatic repeats are off.', 'Repeats are paused.') or label.startswith('Repeating · next occurrence') for label in labels):
                return
            time.sleep(0.3)
        raise RuntimeError('Current repeat schedule did not appear')

    def background_return(self):
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        self.launch()

    def run(self):
        self.adb('shell', 'pm', 'clear', PACKAGE)
        self.fixture('reset', 'POST')
        self.launch()
        self.tap('Sign in')
        self.fill('Email address', 'bp-task-ui@example.com')
        self.fill('Password', 'synthetic-loopback-only')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Log in')
        for _ in range(4):
            nodes = self.nodes()
            if self.match(nodes, "Don’t allow") is not None:
                self.tap("Don’t allow")
            elif self.match(nodes, "Don't allow") is not None:
                self.tap("Don't allow")
            elif self.match(nodes, 'Not now') is not None:
                self.tap('Not now')
            else:
                break
        self.wait('Place', seconds=45)
        self.open_schedule()
        self.tap('Time zone: UTC')
        self.tap('Los Angeles')
        self.tap('Start repeating', scroll=True)
        self.wait('Retry saved change')
        before = self.fixture('state')
        assert len(before['commands']) == 1
        original = before['commands'][0]
        assert original['timezone'] == 'America/Los_Angeles'
        self.fixture('pause-elsewhere', 'POST')
        self.cold_return()
        self.wait('Repeats are paused.')
        self.tap('Retry saved change')
        self.wait('Done reviewing saved change')
        recovered = self.fixture('state')
        assert recovered['recurrence']['configuration']['state'] == 'paused'
        replay = [event for event in recovered['events'] if event['event'] == 'recurrence_replayed']
        assert len(replay) == 1 and replay[0]['request_id'] == original['request_id']
        self.evidence('original-confirmed-current-paused')

        self.cold_return()
        self.tap('Done reviewing saved change')
        self.tap('Start repeating', scroll=True)
        self.tap('Done reviewing saved change')
        self.wait('Pause repeats', scroll=True)
        self.evidence('active-schedule')
        self.fixture('fail-next-reply', 'POST')
        self.tap('Pause repeats', scroll=True)
        self.wait('Retry saved change')
        self.background_return()
        self.tap('Retry saved change')
        self.tap('Done reviewing saved change')
        self.wait('Repeats are paused.')

        self.fixture('revoke', 'POST')
        self.background_return()
        self.wait("You don't have permission to do that.")
        denied = self.nodes()
        assert self.match(denied, 'Recurring copper task') is None
        assert self.match(denied, 'Start repeating') is None
        self.evidence('current-access-denied')
        self.fixture('restore', 'POST')
        self.tap('Reload repeat settings')
        self.wait('Repeats are paused.')
        final = self.fixture('state')
        counts = collections.Counter(event['event'] for event in final['events'])
        assert counts['signed_in'] == 1
        assert counts['recurrence_committed'] == 4
        assert counts['recurrence_replayed'] == 2
        assert counts['recurrence_reply_lost'] == 2
        assert counts['fixture_rejected'] == 0
        assert final['recurrence']['revision'] == 4
        assert final['recurrence']['configuration']['state'] == 'paused'
        assert not final['revoked']
        (self.output / 'fixture-final.json').write_text(json.dumps(final, indent=2))
        (self.output / 'result.json').write_text(json.dumps(dict(passed=True, events=counts, revision=4, state='paused'), indent=2))
        self.evidence('final-paused')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.wait('Repeats paused')
        self.evidence('task-detail-current-projection')
        self.adb('shell', 'am', 'force-stop', PACKAGE)
        print('Installed recurrence journey passed: normal login, exact OS route, two cold returns, protected replay, later pause and current denial.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    Journey(args).run()
