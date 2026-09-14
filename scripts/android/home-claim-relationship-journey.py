#!/usr/bin/env python3
"""Installed Android/Keystore -> production relationship HTTP/service -> local SQL.

Normal login and navigation on the explicitly owned recurrence AVD. The shared
native fixture supplies synthetic identity/shell services; claim authority,
decisions, receipts and injected current-state changes use actual PostgreSQL.
"""
import argparse
import base64
import importlib.util
import json
from pathlib import Path
import re
import shlex
import subprocess
import time
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location('gig_journey', Path(__file__).with_name('home-task-gig-journey.py'))
gig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gig)
base = gig.base
RECOVERY = 'Relationship decisions and recovery'
REVIEW = 'I reviewed the current claim, evidence eligibility and this response.'
DECLINE = 'Continue independent review'
FLAG = 'Flag unknown claimant'
ACK = 'I reviewed this confirmation'
NOTE = 'Original private Android household response'
STORE = 'shared_prefs/private_home_relationship_v1.xml'


class Journey(gig.Journey):
    def launch(self):
        # Await the OS Activity startup across repeated process deaths before
        # attaching UIAutomator to its replacement accessibility window.
        self.adb('shell', 'am', 'start', '-W', '-n', base.ACTIVITY)

    def nodes(self):
        # A cold Activity can temporarily have no accessibility root. Wait for
        # observable readiness; never swallow a different UI/ADB failure.
        end = time.monotonic() + 20
        while True:
            try:
                return super().nodes()
            except RuntimeError as error:
                if str(error) != 'No current UI hierarchy' or time.monotonic() >= end:
                    raise
                time.sleep(0.3)

    def wait(self, label, seconds=35, scroll=False):
        if not scroll:
            return super().wait(label, seconds=seconds)
        end = time.monotonic() + seconds
        index = 0
        while time.monotonic() < end:
            node = self.match(self.nodes(), label)
            if node is not None: return node
            # Form controls can be above or below the current viewport.
            start, finish = ('1660', '780') if index % 12 < 4 else ('780', '1660')
            self.adb('shell', 'input', 'swipe', '530', start, '530', finish, '250')
            index += 1
        raise RuntimeError('Missing reachable control: ' + label)

    def open_queue(self):
        nodes = self.nodes()
        if self.match(nodes, RECOVERY) is not None: return
        if self.match(nodes, 'Review claims on this home') is not None:
            self.tap('Review claims on this home')
            self.wait(RECOVERY)
            return
        if self.match(nodes, 'Profile') is None and self.match(nodes, 'Owners') is None:
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        if self.match(self.nodes(), 'Owners') is None:
            self.tap('Profile')
            self.tap('Home')
        self.tap('Owners', scroll=True)
        self.tap('Review claims on this home')
        self.wait(RECOVERY)

    def cold_return(self):
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.launch()
        self.wait('Place', seconds=45)
        self.open_queue()
        self.tap(RECOVERY)
        self.wait('Household response')

    def prepare(self, note):
        self.field('Optional private note', note)
        self.tap(REVIEW, scroll=True)

    def login(self):
        self.launch()
        try:
            self.tap('Sign in')
        except RuntimeError as error:
            window = self.adb('shell', 'dumpsys', 'window').decode()
            focused = next((line for line in window.splitlines() if 'mCurrentFocus=' in line), '')
            assert str(error) == 'No current UI hierarchy' and 'permission.ui.GrantPermissionsActivity' in focused
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
            self.tap('Sign in')
        self.fill('Email address', 'relationship-ui@example.com')
        self.fill('Password', 'synthetic-loopback-only')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Log in')
        for _ in range(4):
            nodes = self.nodes()
            prompt = next((label for label in ('Don’t allow', "Don't allow", 'Not now') if self.match(nodes, label) is not None), None)
            if prompt is None: break
            self.tap(prompt)
        self.wait('Place', seconds=45)

    def write_original(self, data):
        subprocess.run([self.args.adb, '-s', self.args.serial, 'shell', 'run-as', base.PACKAGE,
                        'sh', '-c', shlex.quote('cat > ' + STORE)], input=data, check=True,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)

    def corrupt_and_restore(self):
        original = self.adb('shell', 'run-as', base.PACKAGE, 'cat', STORE)
        root = ET.fromstring(original)
        entries = [item for item in root.findall('string') if not item.get('name', '').startswith('__androidx_')]
        assert len(entries) == 1, 'Only this owned relationship slot may be corrupted'
        cipher = bytearray(base64.b64decode(entries[0].text)); cipher[-1] ^= 1
        entries[0].text = base64.b64encode(cipher).decode()
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        try:
            self.write_original(ET.tostring(root, encoding='utf-8', xml_declaration=True))
            self.launch(); self.wait('Place', seconds=45); self.open_queue(); self.tap(RECOVERY)
            self.ready('Reload current claim')
            messages = [item.get('text', '') for item in self.nodes()]
            assert any('storage could not be' in text or 'recovery could not be verified' in text or
                       'recovery storage is unavailable' in text for text in messages), 'Corrupt original was not reported'
            self.no_labels(NOTE, 'owner claim · rejected', 'Retry original decision', ACK)
            assert len(self.fixture('state')['commands']) == 2
            self.evidence('corrupt-original-fails-closed')
        finally:
            self.adb('shell', 'am', 'force-stop', base.PACKAGE)
            self.write_original(original)
        self.cold_return()
        self.wait(ACK, scroll=True)
        assert len(self.fixture('state')['commands']) == 2
        self.evidence('exact-encrypted-confirmation-restored')

    def run(self):
        self.adb('shell', 'pm', 'clear', base.PACKAGE)
        initial = self.fixture('reset', 'POST')
        self.home = initial['home_id']
        print('Running normal login and claim-review navigation', flush=True)
        self.login(); self.open_queue()
        print('Review queue reached; exercising prepared original and lost reply', flush=True)
        self.tap('Continue review', scroll=True)
        self.wait('0 of 1 evidence items eligible for review.')
        self.disabled(DECLINE)
        self.prepare(NOTE)
        self.tap('Response: ' + DECLINE, scroll=True); self.tap(FLAG)
        self.disabled(FLAG)
        self.tap('Response: ' + FLAG, scroll=True); self.tap(DECLINE)
        self.disabled(DECLINE)
        self.tap(REVIEW, scroll=True)
        self.evidence('explicit-reviewed-independent-response')
        self.fixture('lose-reply', 'POST'); self.tap(DECLINE, scroll=True)
        self.wait('Retry original decision', scroll=True)
        lost = self.fixture('state')
        assert len(lost['commands']) == 1 and len(lost['receipts']) == 1
        original = lost['commands'][0]
        encrypted = self.adb('shell', 'run-as', base.PACKAGE, 'cat', STORE)
        assert all(value.encode() not in encrypted for value in (NOTE, self.home, original['request_id']))
        self.evidence('lost-reply-original-encrypted')
        self.fixture('reject-elsewhere', 'POST')
        self.cold_return(); self.tap('Retry original decision', scroll=True)
        self.wait('Recorded outcome: under review', scroll=True)
        self.wait('owner claim · rejected', scroll=True)
        self.evidence('original-under-review-current-rejected')
        self.cold_return(); self.wait(ACK, scroll=True)
        cold = self.fixture('state')
        assert len(cold['commands']) == 2 and cold['commands'][0] == cold['commands'][1]
        assert len(cold['receipts']) == 1
        print('Cold original/receipt recovery passed; checking encrypted corruption and restoration', flush=True)
        self.corrupt_and_restore()
        self.tap(ACK, scroll=True); self.no_labels(DECLINE)
        print('Checking stale review and pending-evidence flag', flush=True)
        self.fixture('next-claim', 'POST'); self.tap('Close'); self.tap(FLAG, scroll=True)
        self.prepare('Reviewed pending Android claimant')
        self.fixture('change-claim', 'POST'); self.tap(FLAG, scroll=True)
        self.tap('Review current claim again', scroll=True); self.disabled(FLAG)
        assert len(self.fixture('state')['receipts']) == 1
        self.prepare('Pending deed remains unverified'); self.tap(FLAG, scroll=True)
        self.wait('Sent for admin review. This response did not establish a qualifying dispute.', scroll=True)
        self.evidence('pending-deed-admin-review-only')
        print('Checking current authority revocation and recovery', flush=True)
        self.fixture('revoke', 'POST'); self.background_return()
        self.ready('Reload current claim')
        self.no_labels('owner claim · under review', 'Pending deed remains unverified', ACK, 'Retry original decision')
        self.evidence('revoked-private-state-hidden')
        self.fixture('restore', 'POST'); self.tap('Reload current claim'); self.tap(ACK, scroll=True)
        self.fixture('next-claim', 'POST'); self.tap('Close'); self.tap(FLAG, scroll=True)
        self.wait('1 of 1 evidence items eligible for review.')
        self.prepare('Reviewed verified title evidence')
        print('Checking held preflight, background return and qualifying challenge', flush=True)
        self.fixture('hold-read', 'POST'); self.tap(FLAG, scroll=True)
        deadline = time.monotonic() + 20
        held = self.fixture('state')
        while not held['held'] and time.monotonic() < deadline:
            time.sleep(0.1)
            held = self.fixture('state')
        assert held['held'], 'The explicit decision never reached its held preflight'
        before = len(held['commands'])
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        self.fixture('release-read', 'POST'); self.launch()
        self.wait('Retry original decision', scroll=True)
        assert len(self.fixture('state')['commands']) == before
        self.tap('Retry original decision', scroll=True)
        self.wait('Recorded outcome: challenged', scroll=True)
        self.wait('owner claim · challenged', scroll=True)
        self.evidence('qualified-challenge-after-background')
        final = self.fixture('state')
        assert len(final['commands']) == 5 and len(final['receipts']) == 3
        assert final['claims'][0]['state'] == 'rejected'
        assert final['claims'][1]['challenge_state'] == 'none'
        assert final['claims'][2]['claim_phase_v2'] == 'challenged' and final['claims'][2]['challenge_state'] == 'challenged'
        assert final['security_state'] == 'normal'
        self.tap(ACK, scroll=True); self.tap('Close'); self.tap(RECOVERY)
        self.wait('No saved relationship decision on this device. Choose a claim from the review queue to begin.')
        self.evidence('recovery-empty-after-acknowledgement')
        self.fixture('revoke', 'POST'); self.tap('Close')
        self.wait("Couldn't load ownership claims")
        self.no_labels('No pending ownership claims')
        self.evidence('denied-ownership-list-is-unavailable')
        self.fixture('restore', 'POST')
        (self.output / 'fixture-final.json').write_text(json.dumps(final, indent=2))
        (self.output / 'result.json').write_text(json.dumps(dict(passed=True, posts=5, receipts=3, encrypted=True, corrupt_restore=True), indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print('Installed Android relationship journey passed: review, original recovery, stale/current authority, corrupt storage and background interruption.')


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
