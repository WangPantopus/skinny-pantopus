#!/usr/bin/env python3
"""Installed app/Keystore -> production publication HTTP/service -> isolated SQL.

Uses the owned recurrence AVD and shared native SQL fixture, never an owner AVD.
Identity/geo and the legacy detail-layout switch are synthetic. Status rows are
real SQL; direct fixture state changes do not certify assignment/payment flows.
"""
import argparse
import base64
import importlib.util
import json
from pathlib import Path
import shlex
import subprocess
import time
import urllib.request
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location('native_journey', Path(__file__).with_name('home-task-recurrence-journey.py'))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
REVIEW = 'I reviewed the public details, location, budget and cancellation policy.'
TITLE = 'Reviewed Android kitchen help'


class Journey(base.Journey):
    def fixture(self, action, method='GET', body=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(base.ORIGIN + '/fixture/' + action, method=method, data=data,
                                         headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)

    def open_publication(self):
        self.adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                 '-d', f'pantopus://homes/{self.home}/tasks/{self.task}', base.PACKAGE)
        self.tap('Review Gig publication', scroll=True)
        self.wait('Private household task')

    def cold_return(self):
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.launch()
        self.wait('Place', seconds=45)
        self.open_publication()

    def field(self, label, value):
        self.tap(label, scroll=True)
        self.adb('shell', 'input', 'text', value.replace(' ', '%s'))
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')

    def no_labels(self, *labels):
        nodes = self.nodes()
        for label in labels:
            assert self.match(nodes, label) is None, 'Unexpected control/content: ' + label

    @staticmethod
    def interactive(nodes, node):
        parents = {child: parent for parent in nodes for child in parent}
        candidate = node
        while candidate is not None:
            if candidate.get('clickable') == 'true' or candidate.get('checkable') == 'true':
                return candidate
            candidate = parents.get(candidate)
        return None

    @classmethod
    def match(cls, nodes, label):
        node = base.Journey.match(nodes, label)
        if node is None: return None
        control = cls.interactive(nodes, node)
        return control if control is not None else node

    def disabled(self, label):
        self.wait(label, scroll=True)
        nodes = self.nodes()
        controls = [self.interactive(nodes, node) for node in nodes
                    if label in (node.get('text'), node.get('content-desc'))]
        controls = [node for node in controls if node is not None]
        assert controls and all(node.get('enabled') == 'false' for node in controls), 'Unavailable action is enabled: ' + label

    def ready(self, label):
        end = time.monotonic() + 30
        while time.monotonic() < end:
            node = self.match(self.nodes(), label)
            if node is not None and node.get('enabled') == 'true': return
            time.sleep(0.3)
        raise RuntimeError('Control did not finish loading: ' + label)

    def write_private_original(self, data):
        command = 'cat > shared_prefs/private_home_task_gig_v1.xml'
        subprocess.run([self.args.adb, '-s', self.args.serial, 'shell', 'run-as', base.PACKAGE,
                        'sh', '-c', shlex.quote(command)], input=data, check=True,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)

    def corrupt_and_restore(self):
        original = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/private_home_task_gig_v1.xml')
        root = ET.fromstring(original)
        entries = [entry for entry in root.findall('string') if not entry.get('name', '').startswith('__androidx_')]
        assert len(entries) == 1, 'Only the owned single publication slot may be corrupted'
        cipher = bytearray(base64.b64decode(entries[0].text))
        cipher[-1] ^= 1
        entries[0].text = base64.b64encode(cipher).decode()
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        try:
            self.write_private_original(ET.tostring(root, encoding='utf-8', xml_declaration=True))
            self.launch()
            self.wait('Place', seconds=45)
            self.open_publication_without_source()
            self.ready('Reload publication')
            messages = [node.get('text', '') for node in self.nodes()]
            assert any('storage could not be' in text or 'recovery could not be verified' in text or
                       'recovery storage is unavailable' in text for text in messages), 'Storage failure was not shown'
            self.no_labels('Publish Gig', 'Open Gig', 'Retry original publication', 'Changed private native repair')
            assert len(self.fixture('state')['commands']) == 3
            self.evidence('corrupt-original-fails-closed')
        finally:
            self.adb('shell', 'am', 'force-stop', base.PACKAGE)
            self.write_private_original(original)
        self.launch()
        self.wait('Place', seconds=45)
        self.open_publication()
        self.wait('I reviewed this confirmation', scroll=True)
        assert len(self.fixture('state')['commands']) == 3
        self.evidence('exact-encrypted-original-restored')

    def open_publication_without_source(self):
        self.adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                 '-d', f'pantopus://homes/{self.home}/tasks/{self.task}', base.PACKAGE)
        self.tap('Review Gig publication', scroll=True)
        self.wait('Find help for this task')

    def detail(self, label, dock, name):
        self.wait(TITLE)
        self.wait(label)
        self.wait('$30')
        self.disabled(dock)
        self.no_labels('Place bid', 'Verified address', 'Be the first to bid', 'Changed private native repair')
        self.evidence(name)
        # This is the public Gig detail; private dialogs retain FLAG_SECURE.
        (self.output / (name + '.png')).write_bytes(self.adb('exec-out', 'screencap', '-p'))

    def run(self):
        self.adb('shell', 'pm', 'clear', base.PACKAGE)
        initial = self.fixture('reset', 'POST')
        self.home, self.task = initial['home_id'], initial['task_id']
        self.launch()
        try:
            self.tap('Sign in')
        except RuntimeError as error:
            # API 34 occasionally exposes no accessibility root for its first
            # notification prompt. Use ordinary Back to decline that observed
            # OS prompt, never seed permissions/auth or bypass app controls.
            window = self.adb('shell', 'dumpsys', 'window').decode()
            focused = next((line for line in window.splitlines() if 'mCurrentFocus=' in line), '')
            assert str(error) == 'No current UI hierarchy' and 'permission.ui.GrantPermissionsActivity' in focused
            (self.output / 'initial-os-permission-prompt.png').write_bytes(self.adb('exec-out', 'screencap', '-p'))
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
            self.tap('Sign in')
        self.fill('Email address', 'bp-task-ui@example.com')
        self.fill('Password', 'synthetic-loopback-only')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Log in')
        for _ in range(4):
            nodes = self.nodes()
            prompt = next((label for label in ('Don’t allow', "Don't allow", 'Not now') if self.match(nodes, label) is not None), None)
            if prompt is None: break
            self.tap(prompt)
        self.wait('Place', seconds=45)
        self.open_publication()
        title = self.wait('Public title')
        assert title.get('text', '') == '', 'Private task title was copied automatically'
        self.field('Public title', TITLE)
        self.field('Public description', 'Please help with this reviewed repair.')
        self.field('Budget (USD)', '25.25')
        self.tap('Category: General', scroll=True)
        self.tap('Cleaning')
        self.tap('Category: Cleaning')
        self.tap('General')
        self.field('Search an address', 'Reviewed native')
        self.tap('Find location', scroll=True)
        self.tap('Reviewed native work location', scroll=True)
        self.wait('Selected: Reviewed native work location')
        self.tap(REVIEW, scroll=True)
        self.tap('Cancellation policy: standard', scroll=True)
        self.tap('flexible')
        self.disabled('Publish Gig')
        self.tap(REVIEW, scroll=True)
        self.evidence('reviewed-public-fields')
        self.fixture('change-task', 'POST')
        self.tap('Publish Gig', scroll=True)
        self.tap('Review current task again', scroll=True)
        self.disabled('Publish Gig')
        assert len(self.fixture('state')['receipts']) == 0
        self.tap(REVIEW, scroll=True)
        self.tap('Publish Gig', scroll=True)
        self.wait('Retry original publication', scroll=True)
        before = self.fixture('state')
        assert len(before['receipts']) == 1 and len(before['gigs']) == 1
        original = before['commands'][-1]
        gig = before['receipts'][0]['gig_id']
        assert original['title'] == TITLE and original['price'] == 25.25
        encrypted = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/private_home_task_gig_v1.xml')
        assert all(value.encode() not in encrypted for value in (TITLE, self.home, self.task, original['home_task_source']['request_id']))
        self.evidence('original-retained-after-lost-reply')
        self.fixture('cancel-elsewhere', 'POST')
        self.cold_return()
        self.tap('Retry original publication', scroll=True)
        self.wait('I reviewed this confirmation', scroll=True)
        recovered = self.fixture('state')
        assert recovered['commands'][-1] == original
        assert recovered['gigs'][0]['status'] == 'cancelled' and recovered['gigs'][0]['price'] == 30
        self.evidence('original-confirmed-current-cancelled')
        self.cold_return()
        self.corrupt_and_restore()
        self.tap('Open Gig', scroll=True)
        self.detail('Cancelled', 'Cancelled', 'exact-current-gig')
        for layout in ('v1', 'v2'):
            for status, label in (('open', 'Open'), ('assigned', 'Assigned'), ('in_progress', 'In progress'),
                                  ('completed', 'Completed'), ('cancelled', 'Cancelled')):
                self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
                self.fixture('gig-state', 'POST', {'status': status, 'layout': layout})
                self.adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                         '-d', f'pantopus://gigs/{gig}', base.PACKAGE)
                visible = 'Open · No bids yet' if status == 'open' and layout == 'v2' else label
                dock = 'Your task' if status == 'open' else 'Cancelled' if status == 'cancelled' else 'Bidding closed'
                self.detail(visible, dock, f'{layout}-{status}')
                if layout == 'v2': self.wait('GENERAL')
        self.open_publication()
        self.tap('I reviewed this confirmation', scroll=True)
        self.wait('Open Gig', scroll=True)
        self.no_labels('Publish Gig')
        self.fixture('revoke', 'POST')
        self.background_return()
        self.ready('Reload publication')
        assert any(event['event'] == 'fixture_denied' and event.get('status') == 403 for event in self.fixture('state')['events'])
        self.no_labels('Changed private native repair', 'Open Gig', 'Publish Gig')
        self.evidence('revoked-source-and-controls-hidden')
        self.fixture('restore', 'POST')
        self.tap('Reload publication')
        self.tap('Open Gig', scroll=True)
        self.wait(TITLE)
        final = self.fixture('state')
        assert len(final['receipts']) == 1 and len(final['gigs']) == 1 and len(final['commands']) == 3
        assert final['commands'][1] == final['commands'][2]
        assert final['gigs'][0]['status'] == 'cancelled' and final['gigs'][0]['price'] == 30
        assert [e for e in final['events'] if e['event'] == 'gig_opened'][-1]['gig_id'] == gig
        (self.output / 'fixture-final.json').write_text(json.dumps(final, indent=2))
        (self.output / 'result.json').write_text(json.dumps({'passed': True, 'receipts': 1, 'gigs': 1, 'posts': 3,
                                                            'encrypted_storage': True, 'corrupt_restore': True, 'detail_states': 10}, indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print('Installed Android publication passed: review, stale source, two cold returns, exact recovery, current detail states and denial.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    Journey(parser.parse_args()).run()
