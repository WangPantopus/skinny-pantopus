#!/usr/bin/env python3
"""Owned Android prepared residency decisions through installed UI and real HTTP/SDK/SQL.

Uses the native review fixture on loopback 18084. Retains app data, uses normal
sign-in and acknowledgement, and never replaces authentication or protected data.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import time
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location('postal', Path(__file__).with_name('home-postal-recovery-journey.py'))
postal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(postal)
base = postal.base
HOME = 'ddc23600-0000-4000-8000-000000000100'
PREFIX = 'homeResidencyReview.'


class Journey(postal.Journey):
    def login(self):
        self.launch()
        end = time.monotonic() + 35
        while time.monotonic() < end:
            nodes = self.nodes()
            if self.match(nodes, 'Email address') is not None: break
            if self.match(nodes, 'Sign in') is not None:
                self.tap('Sign in')
                break
        self.fill('Email address', 'residency-review-ui@example.invalid')
        self.fill('Password', 'synthetic-loopback-only')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Log in')
        self.wait('Place', seconds=45)

    def open_queue(self, members=False):
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.launch()
        self.wait('Place', seconds=45)
        if self.match(self.nodes(), 'Profile') is None:
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Profile')
        self.tap('Home')
        self.tap('Members' if members else 'Owners', scroll=True)
        self.tap('Review residency claims' if members else 'Review claims on this home', scroll=True)
        if not members: self.tap('homeClaimReview_tab_residency')
        self.wait('homeClaimReview.residencyRecovery')

    def recovery(self):
        self.open_queue()
        self.press('homeClaimReview.residencyRecovery')

    def press(self, tag):
        # Review content can be above or below the current scroll position;
        # Reload and Close are fixed outside that viewport.
        end = time.monotonic() + 45
        attempt = 0
        while time.monotonic() < end:
            node = self.match(self.nodes(), tag)
            if node is not None and node.get('enabled') == 'true':
                x1, y1, x2, y2 = self.bounds(node)
                if x2 > x1 and y2 > y1:
                    self.adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))
                    return
            if node is None:
                up = attempt % 12 < 6
                self.adb('shell', 'input', 'swipe', '530', '1550' if up else '700', '530', '700' if up else '1550', '250')
                attempt += 1
            time.sleep(0.2)
        raise AssertionError('Review control did not become available: ' + tag)

    def contains_review(self, label):
        for attempt in range(20):
            if self.match(self.nodes(), label) is not None: return
            up = attempt % 12 < 6
            self.adb('shell', 'input', 'swipe', '530', '1550' if up else '700', '530', '700' if up else '1550', '250')
        raise AssertionError('Expected current review content: ' + label)

    def open_claim(self, applicant, approve=True):
        for attempt in range(24):
            nodes = self.nodes()
            card = next((node for node in nodes if node.get('resource-id') == 'homeClaimReview_residencyCard'
                         and any(n.get('text') == f'Applicant {applicant}' for n in node.iter())), None)
            if card is not None:
                tag = 'homeClaimReview_residencyApprove' if approve else 'homeClaimReview_residencyReject'
                button = next((n for n in card.iter() if n.get('resource-id') == tag), None)
                if button is not None and button.get('enabled') == 'true':
                    x1, y1, x2, y2 = self.bounds(button)
                    if y2 - y1 >= 40:
                        self.adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))
                        self.wait(PREFIX + 'claimStatus')
                        return
            up = attempt % 12 < 6
            self.adb('shell', 'input', 'swipe', '530', '1600' if up else '700', '530', '700' if up else '1600', '250')
        raise AssertionError('Applicant review action did not appear')

    def confirm(self):
        self.contains_review(PREFIX + 'reviewed')
        node = self.match(self.nodes(), PREFIX + 'reviewed')
        assert node.get('checked') == 'false'
        self.press(PREFIX + 'reviewed')
        assert self.match(self.nodes(), PREFIX + 'reviewed').get('checked') == 'true'
        self.contains_review(PREFIX + 'submit')
        assert self.match(self.nodes(), PREFIX + 'submit').get('enabled') == 'true'

    def assert_unconfirmed(self):
        self.contains_review(PREFIX + 'submit')
        assert self.match(self.nodes(), PREFIX + 'submit').get('enabled') == 'false'

    def assert_counts(self, commands, receipts, equal=None):
        state = self.fixture('state')
        assert len(state['commands']) == commands and len(state['receipts']) == receipts
        if equal:
            first, second = (state['commands'][index] for index in equal)
            assert first['body'] == second['body'] and first['path'] == second['path']
        return state

    def encrypted_original(self):
        xml = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/private_home_residency_review_v1.xml')
        state = self.fixture('state')
        assert b'Private residency fixture' not in xml and b'Original reviewed rejection' not in xml
        for command in state['commands']:
            assert command['body']['request_id'].encode() not in xml
        (self.output / 'protected-store.xml').write_bytes(xml)

    def preparation_and_approval(self):
        self.open_queue()
        self.open_claim(2, approve=False)
        self.field(PREFIX + 'reason', 'Cancelled private note')
        self.press(PREFIX + 'close')
        self.assert_counts(0, 0)
        self.open_claim(2)
        self.assert_unconfirmed()
        for kind in ['before', 'malformed']:
            self.fixture('fault', 'POST', {'kind': kind})
            self.press(PREFIX + 'reload')
            self.wait(PREFIX + 'error')
            self.no_controls(PREFIX + 'claimStatus', PREFIX + 'submit')
            self.evidence('unavailable-' + kind)
        self.fixture('fault', 'POST', {'kind': 'clear'})
        self.press(PREFIX + 'reload')
        self.confirm()
        self.press(PREFIX + 'role')
        self.tap('Guest')
        self.assert_unconfirmed()
        self.press(PREFIX + 'role')
        self.tap('Member')
        self.confirm()
        self.evidence('prepared-approval-current-membership-and-explicit-confirmation')
        self.fixture('fault', 'POST', {'kind': 'lost'})
        self.press(PREFIX + 'submit')
        self.await_database(lambda s: len(s['receipts']) == 1)
        self.contains_review(PREFIX + 'retry')
        self.encrypted_original()
        self.fixture('change', 'POST', {'kind': 'move-out', 'index': 0})
        self.recovery()
        self.press(PREFIX + 'retry')
        self.contains_review('The original residency claim was approved.')
        self.contains_review('Membership record: Inactive')
        self.assert_counts(2, 1, [0, 1])
        self.evidence('cold-original-approval-current-inactive-membership')
        self.recovery()
        self.contains_review('The original residency claim was approved.')
        self.assert_counts(2, 1)
        self.press(PREFIX + 'acknowledge')
        self.wait(PREFIX + 'empty')

    def rejection_and_revoked_access(self):
        self.open_queue(members=True)
        self.open_claim(3, approve=False)
        self.field(PREFIX + 'reason', 'Changed claim must be reviewed again')
        self.confirm()
        self.fixture('change', 'POST', {'kind': 'stale', 'index': 1})
        self.press(PREFIX + 'submit')
        self.press(PREFIX + 'acknowledge')
        self.assert_counts(3, 1)
        self.assert_unconfirmed()
        self.field(PREFIX + 'reason', 'Original reviewed rejection')
        self.confirm()
        self.fixture('fault', 'POST', {'kind': 'lost'})
        self.press(PREFIX + 'submit')
        self.await_database(lambda s: len(s['receipts']) == 2)
        self.contains_review(PREFIX + 'retry')
        self.encrypted_original()
        self.fixture('change', 'POST', {'kind': 'resubmit', 'index': 1})
        self.recovery()
        self.press(PREFIX + 'retry')
        self.contains_review('The original residency claim was rejected.')
        self.contains_review('Claim status: pending')
        self.contains_review('Original reason: Original reviewed rejection')
        self.assert_counts(5, 2, [3, 4])
        self.evidence('historical-rejection-keeps-resubmitted-claim')
        self.fixture('change', 'POST', {'kind': 'revoke'})
        self.background_and_return()
        self.wait(PREFIX + 'error')
        self.no_controls(PREFIX + 'claimStatus', PREFIX + 'retry', PREFIX + 'acknowledge',
                         'Original reason: Original reviewed rejection')
        self.evidence('revoked-reviewer-access-hides-private-decision')
        self.fixture('change', 'POST', {'kind': 'restore'})
        self.press(PREFIX + 'reload')
        self.press(PREFIX + 'acknowledge')
        self.wait(PREFIX + 'empty')

    def retire_preflight_and_old_read(self):
        self.press(PREFIX + 'close')
        self.open_claim(4)
        self.confirm()
        self.fixture('hold-read', 'POST', {})
        self.press(PREFIX + 'submit')
        self.await_database(lambda s: s['held'])
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        self.wait('Google app')
        self.fixture('release-read', 'POST', {})
        self.launch()
        self.press(PREFIX + 'reload')
        self.contains_review(PREFIX + 'retry')
        self.assert_counts(5, 2)
        self.evidence('retired-preflight-keeps-original-with-zero-new-posts')
        self.press(PREFIX + 'retry')
        self.contains_review('The original residency claim was approved.')
        self.assert_counts(6, 3)
        self.press(PREFIX + 'acknowledge')
        self.press(PREFIX + 'close')
        self.open_claim(5)
        self.fixture('hold-read', 'POST', {})
        self.press(PREFIX + 'reload')
        self.await_database(lambda s: s['held'])
        self.fixture('change', 'POST', {'kind': 'revoke'})
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        self.wait('Google app')
        self.fixture('release-read', 'POST', {})
        self.launch()
        self.press(PREFIX + 'reload')
        self.wait(PREFIX + 'error')
        self.no_controls(PREFIX + 'claimStatus', PREFIX + 'submit')
        self.evidence('retired-authorized-read-cannot-restore-revoked-access')
        self.fixture('change', 'POST', {'kind': 'restore'})
        self.press(PREFIX + 'reload')
        self.assert_unconfirmed()
        self.press(PREFIX + 'close')
        self.press('homeClaimReview.residencyRecovery')
        self.wait(PREFIX + 'empty')
        state = self.assert_counts(6, 3)
        assert not state['held'] and state['authority']
        xml = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/private_home_residency_review_v1.xml')
        entries = [node for node in ET.fromstring(xml) if not node.get('name', '').startswith('__androidx_security_crypto_')]
        assert not entries, 'Every protected original must be acknowledged through the native UI'
        self.evidence('native-acknowledgement-leaves-no-original')

    def run(self):
        if self.args.login: self.first_login()
        phases = ['preparation_and_approval', 'rejection_and_revoked_access', 'retire_preflight_and_old_read']
        passed = []
        for phase in phases:
            getattr(self, phase)()
            passed.append(phase)
            (self.output / 'result.json').write_text(json.dumps({'passed': passed, 'complete': passed == phases}, indent=2))
            print('PASS installed Android residency review: ' + phase, flush=True)
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--login', action='store_true')
    journey = Journey(parser.parse_args())
    try:
        journey.run()
    except Exception:
        try: journey.evidence('failure-current-screen')
        except Exception: pass
        try: journey.adb('shell', 'am', 'force-stop', base.PACKAGE)
        except Exception: pass
        raise
