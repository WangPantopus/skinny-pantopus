#!/usr/bin/env python3
"""Owned Android sender-list ordering through installed UI and real HTTP/SQL.

Requires the sender-recovery fixture and dedicated acceptance AVD. Preserves
app data and protected originals. This journey issues no sender command.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import time
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location('sender', Path(__file__).with_name('home-invitation-sender-journey.py'))
sender = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sender)


class Journey(sender.Journey):
    def originals_empty(self):
        raw = self.adb('shell', 'run-as', sender.base.PACKAGE, 'cat', 'shared_prefs/private_home_invitation_sender_v1.xml')
        assert all(n.get('name', '').startswith('__androidx_security_crypto_encrypted_prefs_') for n in ET.fromstring(raw))

    def pending_identities(self):
        return [n.get('text') for n in self.nodes() if n.get('text', '').startswith('Residency fixture @residency_http_')]

    def expect_pending(self, count, absent=None):
        end = time.monotonic() + 40
        while time.monotonic() < end:
            identities = self.pending_identities()
            if len(identities) == count and (absent is None or all(absent not in value for value in identities)): return
        raise AssertionError('Current pending identities did not match the newer snapshot')

    def pull(self):
        self.adb('shell', 'input', 'swipe', '530', '650', '530', '1620', '600')

    def held_refresh(self):
        before = sum(e.get('event') == 'reply_held' and e.get('action') == 'sender_list' for e in self.fixture('state')['events'])
        self.fixture('fault', 'POST', {'action': 'sender_list', 'kind': 'hold', 'persistent': False})
        self.pull()
        self.wait_state(lambda state: sum(e.get('event') == 'reply_held' and e.get('action') == 'sender_list'
                                         for e in state['events']) == before + 1)
        # Tabs remain usable during the in-flight fetch. Returning to Pending
        # publishes the cached view, so a second ordinary pull is reachable.
        self.press('Members')
        self.press('Pending')

    def release_older(self):
        boundary = len(self.fixture('state')['events'])
        self.fixture('release', 'POST', {})
        # The older fetch performs its later audit read after receiving the
        # released list. Awaiting it proves that the old client flow resumed.
        self.wait_state(lambda state: any(e.get('event') == 'request' and e.get('method') == 'GET' and
                                         e.get('path') == f'/api/homes/{self.home}/audit-log'
                                         for e in state['events'][boundary:]))

    def failure_retires(self):
        self.held_refresh()
        self.fixture('fault', 'POST', {'action': 'sender_list', 'kind': 'before', 'persistent': True})
        self.pull()
        message = 'Current invitations could not be loaded. Retry to manage invitations.'
        self.wait(message)
        self.no_controls('Resend', 'Withdraw', 'Review residency claims')
        self.evidence('newer-list-failure-retires-pending-and-manager-controls')
        self.release_older()
        for _ in range(2):
            self.press('Members')
            self.no_controls('Review residency claims')
            self.press('Pending')
            self.wait(message)
            self.no_controls('Resend', 'Withdraw')
        self.evidence('older-success-cannot-revive-failed-tabs')
        self.fixture('fault', 'POST', {'action': 'sender_list', 'kind': 'clear'})
        self.tap('Try again')
        self.expect_pending(2)

    def denial_retires(self):
        self.held_refresh()
        self.fixture('sender-scenario', 'POST', {'mode': 'deny_manage'})
        self.pull()
        self.wait('Current invitation management is unavailable. Recover a saved action from Invite member.')
        self.no_controls('Resend', 'Withdraw', 'Review residency claims')
        self.evidence('newer-denial-retires-pending-and-manager-controls')
        self.release_older()
        for _ in range(2):
            self.press('Members')
            self.no_controls('Review residency claims')
            self.press('Pending')
            self.wait('Current invitation management is unavailable. Recover a saved action from Invite member.')
            self.no_controls('Resend', 'Withdraw')
        self.evidence('older-success-cannot-revive-denied-tabs')
        self.press('Invite member')
        self.wait('homeSenderPrepare')
        self.no_controls('homeSenderOriginalSummary')
        self.evidence('recovery-entry-remains-available-after-current-denial')
        self.press('homeSenderClose')
        self.wait('Current invitation management is unavailable. Recover a saved action from Invite member.')
        self.fixture('sender-scenario', 'POST', {'mode': 'restore_manage'})
        self.tap('Try again')
        self.expect_pending(2)

    def newer_success_retires(self):
        self.held_refresh()
        invitation = self.capability(2)['invitation_id']
        self.fixture('sender-scenario', 'POST', {'mode': 'accept', 'invitation_id': invitation})
        self.pull()
        self.expect_pending(1, absent='@residency_http_03')
        self.evidence('newer-success-removes-resolved-recipient')
        self.release_older()
        for _ in range(2):
            self.press('Members')
            self.press('Pending')
            self.expect_pending(1, absent='@residency_http_03')
        self.evidence('older-success-cannot-revive-resolved-recipient')
        (self.output / 'current-pending-identities.png').write_bytes(self.adb('exec-out', 'screencap', '-p'))

    def run(self):
        self.originals_empty()
        assert not self.sender_commands()
        self.sign_out()
        self.login(0)
        self.open_members()
        self.press('Pending')
        self.expect_pending(2)
        self.failure_retires()
        print('PASS: newer list failure survives released older success and tab changes', flush=True)
        self.denial_retires()
        print('PASS: newer denial survives released older success and tab changes', flush=True)
        self.newer_success_retires()
        print('PASS: newer success survives released older success and tab changes', flush=True)
        self.press('Invite member')
        self.wait('homeSenderPrepare')
        self.no_controls('homeSenderOriginalSummary')
        self.press('homeSenderClose')
        self.originals_empty()
        state = self.fixture('state')
        assert not state['sender_commands']
        assert not any(e.get('method') == 'POST' and '/invitations/sender/commands' in e.get('path', '') for e in state['events'])
        (self.output / 'result.json').write_text(json.dumps({'complete': True, 'sender_commands': 0,
            'held_older_reads': 3, 'newer_list_failure_retired_rows_and_management': True, 'newer_denial_retired_rows_and_management': True,
            'newer_success_retired_resolved_recipient': True, 'tab_changes_cannot_restore_old_snapshot': True,
            'protected_originals_empty': True, 'recovery_entry_available': True}, indent=2))
        self.adb('shell', 'am', 'force-stop', sender.base.PACKAGE)
        print('PASS: installed sender list ordering with zero sender commands', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    journey = Journey(parser.parse_args())
    try: journey.run()
    except Exception:
        try: journey.evidence('failure-current-screen')
        except Exception: pass
        raise
