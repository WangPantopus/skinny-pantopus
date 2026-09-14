#!/usr/bin/env python3
"""Owned Android sender UI through real loopback HTTP/SDK/SQL, with protected originals.

Uses the dedicated recurrence AVD and sender-recovery fixture on 18084. Never
clears app data, injects authentication, edits protected originals or disables
screen protection. All capabilities/evidence remain private outside the checkout.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import time
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location('recipient', Path(__file__).with_name('home-invitation-decisions-journey.py'))
recipient = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recipient)
base = recipient.base


class Journey(recipient.Journey):
    def __init__(self, args):
        super().__init__(args)
        self.home = self.fixture('capabilities')['home']
        assert len(self.capabilities) >= 2

    def match(self, nodes, label):
        # The installed Members/sender surfaces expose visible accessibility
        # labels, not their Compose-only test tags. Use observed controls and
        # their actual enabled clickable parent; headings are not buttons.
        aliases = {
            'membersList': ('Invite member',), 'tab.pending': ('Pending',), 'inviteMemberWizard': ('Close',),
            'homeSenderPrepare': ('Review invitation',), 'homeSenderPreparedSummary': ('Review the current invitation',),
            'homeSenderSubmit': ('Save invitation', 'Resend invitation', 'Withdraw invitation'),
            'homeSenderConfirm': ('Confirm action', 'Cancel original attempt'), 'homeSenderClose': ('Close',),
            'homeSenderTerminal': ('Acknowledge result',), 'homeSenderAcknowledge': ('Acknowledge result',),
            'homeSenderCheck': ('Check original result',), 'homeSenderRetry': ('Retry original action',),
            'homeSenderCancelAttempt': ('Cancel original attempt',), 'homeSenderCheckShare': ('Check link for sharing',),
            'homeSenderShare': ('Share invitation link',),
        }
        if label == 'homeSenderOriginalSummary':
            return next((n for n in nodes if n.get('text', '').startswith('Saved original action:')), None)
        if label == 'homeSenderError':
            prefixes = ('The protected original could not', 'The invitation action changed.', 'The result is not confirmed.',
                        'Current invitation details could not', 'Your session changed.', 'You no longer have permission',
                        'The invitation or your authority changed.', 'This invitation expired.',
                        'The invitation or household is no longer available', 'This action was not completed.')
            return next((n for n in nodes if n.get('text', '').startswith(prefixes)), None)
        if label not in aliases: return super().match(nodes, label)
        parents = {child: parent for parent in nodes for child in parent}
        for marker in nodes:
            if not any(marker.get(k) in aliases[label] for k in ('text', 'content-desc')): continue
            if label == 'homeSenderPreparedSummary': return marker
            candidate = marker
            while candidate is not None:
                if candidate.get('clickable') == 'true': return candidate
                candidate = parents.get(candidate)
        return None

    def login(self, index=0):
        self.launch()
        end = time.monotonic() + 35
        while time.monotonic() < end:
            nodes = self.nodes()
            if self.match(nodes, 'Email address') is not None: break
            if self.match(nodes, 'Sign in') is not None: self.tap('Sign in'); break
        self.fill_login('Email address', f'residency-http-{index + 1}@example.invalid')
        self.fill_login('Password', 'synthetic-loopback-only')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        request_boundary = len(self.fixture('state')['events'])
        self.tap('Log in')
        self.wait('Place', seconds=45)
        self.wait_state(lambda state: any(e.get('event') == 'request' and e.get('actor') == index
                                         for e in state['events'][request_boundary:]))

    def wait_any(self, labels, seconds=35):
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            nodes = self.nodes()
            for label in labels:
                if self.match(nodes, label) is not None: return label
        raise AssertionError('Expected normal navigation surface did not appear')

    def sign_out(self):
        self.launch()
        surface = self.wait_any(('Sign in', 'Email address', 'Profile', 'Place'))
        if surface in ('Sign in', 'Email address'): return
        if surface == 'Profile':
            self.tap('Profile')
        else:
            # This supported app link pushes Payments over the normal Settings
            # index. Wait for its actual screen, then Back once; never blindly
            # pop through the automatic Place landing or an asynchronous root.
            self.adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                     '-d', 'pantopus://settings/payments', base.PACKAGE)
            surface = self.wait_any(('Payments', 'Settings', 'Sign in', 'Email address'))
            if surface in ('Sign in', 'Email address'): return
            if surface == 'Payments':
                self.tap('Back')
                self.wait('Settings')
        self.tap('Log out', scroll=True)
        surface = self.wait_any(('Sign out', 'Sign in', 'Email address'))
        if surface == 'Sign out': self.tap('Sign out')
        self.wait_any(('Sign in', 'Email address'))

    def open_members(self, cold=False):
        if cold:
            self.adb('shell', 'am', 'force-stop', base.PACKAGE)
            self.launch()
            self.wait('Place', seconds=45)
        self.adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                 '-d', f'pantopus://homes/{self.home}/members?tab=requests', base.PACKAGE)
        self.wait('membersList', seconds=45)

    def open_sender(self, cold=False):
        self.open_members(cold)
        self.press('Invite member')
        self.wait('inviteMemberWizard')

    def prepare_create(self, email, username=False):
        self.wait('homeSenderPrepare', scroll=True)
        if username: self.press('Username')
        self.field('Username' if username else 'Email', email)
        self.field('Personal note (optional)', 'Private Android sender note')
        self.press('homeSenderPrepare')
        self.wait('homeSenderPreparedSummary', scroll=True)

    def submit(self):
        self.press('homeSenderSubmit')
        self.press('homeSenderConfirm')

    def acknowledge(self):
        self.press('homeSenderAcknowledge')
        self.wait('membersList')
        end = time.monotonic() + 20
        while time.monotonic() < end:
            xml = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/private_home_invitation_sender_v1.xml')
            if all(n.get('name', '').startswith('__androidx_security_crypto_encrypted_prefs_') for n in ET.fromstring(xml)):
                return
            time.sleep(0.2)
        raise AssertionError('Sender original was not durably acknowledged')

    def protect(self, name):
        xml = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/private_home_invitation_sender_v1.xml')
        for command in self.fixture('state')['sender_commands']:
            assert command['request_id'].encode() not in xml
        for capability in self.fixture('capabilities')['capabilities']:
            assert capability['token'].encode() not in xml
        assert b'Private Android sender note' not in xml and b'example.invalid' not in xml
        (self.output / (name + '-encrypted.xml')).write_bytes(xml)

    def sender_commands(self):
        return self.fixture('state')['sender_commands']

    def row_action(self, email, action, prepared=True):
        self.press('tab.pending')
        index = re.fullmatch(r'residency-http-(\d+)@example\.invalid', email)
        profile = f'@residency_http_{int(index.group(1)):02}' if index else None
        end = time.monotonic() + 40
        while time.monotonic() < end:
            containers = [n for n in self.nodes() if any(c.get('text') == email or (profile and c.get('text', '').endswith(profile)) for c in n.iter())
                          and any(c.get('text') == action for c in n.iter())]
            if containers:
                parent = min(containers, key=lambda n: len(list(n.iter())))
                target = next(n for n in parent.iter() if n.get('text') == action)
                x1, y1, x2, y2 = self.bounds(target)
                if y2 > y1 and x2 > x1:
                    self.adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))
                    self.wait('homeSenderPreparedSummary' if prepared else 'homeSenderError', scroll=True)
                    return
            self.adb('shell', 'input', 'swipe', '530', '1550', '530', '740', '250')
        raise AssertionError('Pending invitation action did not appear')

    def sharing_checks(self):
        original = self.sender_commands()[0]
        writes = len(self.sender_commands())
        first_event = len(self.fixture('state')['events'])
        self.no_controls('homeSenderShare')
        self.press('homeSenderCheckShare')
        self.wait('homeSenderShare', scroll=True)
        self.evidence('current-read-only-sharing-check')
        self.fixture('fault', 'POST', {'action': 'sender_context', 'kind': 'before', 'persistent': True})
        self.press('homeSenderCheckShare')
        self.wait('homeSenderError', scroll=True)
        self.no_controls('homeSenderShare')
        self.fixture('fault', 'POST', {'action': 'sender_context', 'kind': 'clear'})
        self.press('homeSenderCheckShare')
        self.wait('homeSenderShare', scroll=True)
        self.press('homeSenderShare')
        end = time.monotonic() + 30
        while time.monotonic() < end:
            nodes = self.nodes()
            if any('127.0.0.1:18080/invite/' in (n.get('text', '') + n.get('content-desc', '')) for n in nodes): break
        else: raise AssertionError('Android share chooser did not expose the correct loopback invitation origin')
        self.evidence('actual-share-chooser-correct-origin')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.wait('homeSenderTerminal', scroll=True)
        self.no_controls('homeSenderShare')
        self.fixture('sender-scenario', 'POST', {'mode': 'expire', 'invitation_id': original['invitation_id']})
        self.press('homeSenderCheckShare')
        self.wait('homeSenderError', scroll=True)
        self.no_controls('homeSenderShare')
        assert len(self.sender_commands()) == writes
        requests = self.fixture('state')['events'][first_event:]
        assert not any(e.get('method') == 'POST' and e.get('path', '').startswith('/api/homes/invitations/sender/commands') for e in requests)
        assert sum(e.get('method') == 'POST' and e.get('path') == '/api/homes/invitations/sender/context' for e in requests) >= 5
        self.evidence('expired-historical-success-cannot-expose-sharing')

    def creation(self):
        assert not self.sender_commands()
        self.sign_out()
        self.login(0)
        self.open_sender()
        self.prepare_create('residency-http-4@example.invalid')
        self.fixture('fault', 'POST', {'action': 'create', 'kind': 'after'})
        self.submit()
        self.wait('homeSenderError', scroll=True)
        state = self.wait_state(lambda s: len(s['sender_commands']) == 1)
        assert state['sender_commands'][0]['state'] == 'completed'
        original_id = state['sender_commands'][0]['request_id']
        before_delivery = (state['controlled_notifications'], state['controlled_email_attempts'])
        self.protect('saved-create-lost-reply')
        self.evidence('saved-create-lost-reply')
        self.fixture('fault', 'POST', {'action': 'sender_read', 'kind': 'before', 'persistent': True})
        self.open_sender(cold=True)
        self.wait('homeSenderCheck', scroll=True)
        self.evidence('cold-read-failure-keeps-original')
        self.fixture('fault', 'POST', {'action': 'sender_read', 'kind': 'clear'})
        self.press('homeSenderRetry')
        self.wait('homeSenderTerminal', scroll=True)
        self.contains_review('Invitation saved. The recipient must accept to join the household.')
        self.contains_review('Email delivery is unconfirmed.\nIn-app notification delivery is unconfirmed.')
        recovered = self.fixture('state')
        assert len(recovered['sender_commands']) == 1
        attempts = [e for e in recovered['events'] if e.get('method') == 'POST'
                    and e.get('path') == '/api/homes/invitations/sender/commands' and e.get('request_id') == original_id]
        assert len(attempts) == 2 and attempts[0]['request_hash'] == attempts[1]['request_hash']
        assert (recovered['controlled_notifications'], recovered['controlled_email_attempts']) == before_delivery
        (self.output / 'explicit-create-retry-proof.json').write_text(json.dumps({
            'request_id': original_id, 'submission_count': len(attempts), 'request_hashes_equal': True,
            'command_rows': 1, 'delivery_attempts_unchanged': True,
        }, indent=2))
        self.evidence('create-retry-recovers-saved-with-unconfirmed-delivery')
        self.sharing_checks()
        self.fixture('fault', 'POST', {'action': 'sender_list', 'kind': 'before', 'persistent': True})
        self.acknowledge()
        self.press('tab.pending')
        self.wait('Current invitations could not be loaded. Retry to manage invitations.')
        self.evidence('acknowledged-save-then-unavailable-member-refresh')
        self.fixture('fault', 'POST', {'action': 'sender_list', 'kind': 'clear'})
        self.open_members(cold=True)

    def resend(self):
        self.fixture('delivery', 'POST', {'email': 'accepted', 'in_app': True})
        self.row_action('residency-http-2@example.invalid', 'Resend')
        before = len(self.fixture('state')['invitations'])
        self.submit()
        self.wait('homeSenderTerminal', scroll=True)
        self.contains_review('Email provider accepted the message. Inbox delivery is not confirmed.\nIn-app notification saved. Push or device delivery is not confirmed.')
        assert len(self.fixture('state')['invitations']) == before
        self.protect('explicit-resend')
        self.evidence('explicit-resend-provider-accepted-without-delivery-claim')
        self.acknowledge()

    def expired_invitation(self):
        before = self.fixture('state')
        self.row_action('residency-http-4@example.invalid', 'Resend', prepared=False)
        self.no_controls('homeSenderSubmit', 'homeSenderOriginalSummary')
        assert self.sender_commands() == before['sender_commands']
        self.evidence('expired-row-resend-refused-at-current-review')
        self.press('homeSenderClose')
        self.row_action('residency-http-4@example.invalid', 'Withdraw')
        self.submit()
        self.wait('homeSenderTerminal', scroll=True)
        after = self.fixture('state')
        assert after['sender_commands'][-1]['action'] == 'withdraw' and after['sender_commands'][-1]['state'] == 'completed'
        assert after['memberships'] == before['memberships']
        self.evidence('expired-invitation-explicitly-withdrawn-with-membership-preserved')
        self.acknowledge()

    def membership_safety(self):
        self.row_action('residency-http-3@example.invalid', 'Withdraw')
        invitation = self.capability(2)['invitation_id']
        self.fixture('sender-scenario', 'POST', {'mode': 'accept', 'invitation_id': invitation})
        before = self.fixture('state')['memberships']
        self.submit()
        self.wait('homeSenderTerminal', scroll=True)
        assert self.sender_commands()[-1]['state'] == 'rejected'
        assert self.fixture('state')['memberships'] == before
        self.evidence('accepted-during-withdraw-review-preserves-membership')
        self.acknowledge()

    def withdrawal(self):
        self.row_action('residency-http-2@example.invalid', 'Withdraw')
        before = self.fixture('state')['memberships']
        self.fixture('fault', 'POST', {'action': 'withdraw', 'kind': 'after'})
        self.submit()
        self.wait('homeSenderError', scroll=True)
        self.protect('withdraw-lost-reply')
        self.open_sender(cold=True)
        self.wait('homeSenderTerminal', scroll=True)
        self.contains_review('Invitation withdrawn. Existing household membership was preserved.')
        assert self.fixture('state')['memberships'] == before
        self.evidence('withdrawal-cold-recovery-preserves-membership')
        self.acknowledge()

    def cancellation_accounts(self):
        self.open_sender()
        self.prepare_create('unresolved-android@example.invalid')
        self.fixture('fault', 'POST', {'action': 'create', 'kind': 'before', 'persistent': True})
        self.submit()
        self.wait('homeSenderCheck', scroll=True)
        before = len(self.sender_commands())
        self.press('homeSenderClose')
        held_before = sum(e.get('event') == 'logout_reply_held' for e in self.fixture('state')['events'])
        self.fixture('fault', 'POST', {'action': 'logout', 'kind': 'hold'})
        self.sign_out()
        self.wait_state(lambda s: sum(e.get('event') == 'logout_reply_held' for e in s['events']) == held_before + 1)
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.fixture('release', 'POST', {})
        self.fixture('fault', 'POST', {'action': 'logout', 'kind': 'clear'})
        self.login(2)
        self.open_sender()
        self.wait('homeSenderPrepare', scroll=True)
        self.no_controls('homeSenderOriginalSummary')
        self.evidence('different-account-cannot-recover-original')
        self.press('homeSenderClose')
        self.sign_out()
        self.login(0)
        self.open_sender()
        self.wait('homeSenderCancelAttempt', scroll=True)
        self.press('homeSenderCancelAttempt')
        self.press('homeSenderConfirm')
        self.wait('homeSenderTerminal', scroll=True)
        assert len(self.sender_commands()) == before + 1
        assert self.sender_commands()[-1]['state'] == 'cancelled'
        self.evidence('cold-account-return-cancels-unseen-original')
        self.acknowledge()
        self.fixture('fault', 'POST', {'action': 'create', 'kind': 'clear'})

    def authority(self):
        self.open_sender()
        self.prepare_create('authority-android@example.invalid')
        self.fixture('sender-scenario', 'POST', {'mode': 'deny_manage'})
        self.submit()
        self.wait('homeSenderTerminal', scroll=True)
        assert self.sender_commands()[-1]['state'] == 'rejected'
        self.evidence('authority-removed-after-preparation-refuses-action')
        self.acknowledge()
        self.fixture('sender-scenario', 'POST', {'mode': 'restore_manage'})

    def username_held(self):
        self.fixture('delivery', 'POST', {'email': 'unconfirmed', 'in_app': False})
        self.open_sender()
        self.prepare_create('residency_http_05', username=True)
        self.fixture('fault', 'POST', {'action': 'create', 'kind': 'hold'})
        before = len(self.sender_commands())
        held_before = sum(e.get('event') == 'reply_held' and e.get('action') == 'create' for e in self.fixture('state')['events'])
        self.submit()
        self.wait_state(lambda s: len(s['sender_commands']) == before + 1 and
                        sum(e.get('event') == 'reply_held' and e.get('action') == 'create' for e in s['events']) == held_before + 1)
        self.open_sender(cold=True)
        self.wait('homeSenderTerminal', scroll=True)
        self.contains_review('Invitation saved. The recipient must accept to join the household.')
        self.fixture('release', 'POST', {})
        self.protect('username-held-reply')
        self.evidence('username-held-reply-cold-original-with-unconfirmed-delivery')
        self.acknowledge()

    def run(self):
        phases = ['creation', 'expired_invitation', 'resend', 'membership_safety', 'withdrawal', 'cancellation_accounts', 'authority', 'username_held']
        start = phases.index(self.args.phase) if self.args.phase != 'full' else 0
        for phase in phases[start:]:
            print('START: installed sender ' + phase, flush=True)
            getattr(self, phase)()
            (self.output / ('phase-' + phase + '.json')).write_text(json.dumps({'completed': phase, 'commands': len(self.sender_commands())}))
            print('PASS: installed sender ' + phase, flush=True)
        state = self.fixture('state')
        assert not any(e.get('method') == 'DELETE' and '/members/' in e.get('path', '') for e in state['events'])
        requests = [e for e in state['events'] if e.get('path') == '/api/homes/invitations/sender/commands' and e.get('method') == 'POST']
        identities = {}
        for request in requests:
            previous = identities.setdefault(request['request_id'], request['request_hash'])
            assert previous == request['request_hash'], 'Original sender bytes changed during retry'
        self.protect('final-originals-acknowledged')
        self.evidence('sender-journey-complete')
        (self.output / 'result.json').write_text(json.dumps({'complete': True, 'sender_commands': len(state['sender_commands']),
            'membership_removal_requests': 0, 'exact_replay_hashes': True, 'all_originals_acknowledged': True}, indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print('PASS: installed sender recovery, delivery truth, explicit resend/withdraw and membership preservation', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--phase', default='full', choices=['full', 'creation', 'expired_invitation', 'resend', 'membership_safety', 'withdrawal', 'cancellation_accounts', 'authority', 'username_held'])
    journey = Journey(parser.parse_args())
    try: journey.run()
    except Exception:
        try: journey.evidence('failure-current-screen')
        except Exception: pass
        raise
