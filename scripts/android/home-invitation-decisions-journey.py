#!/usr/bin/env python3
"""Owned Android invitation decisions through normal UI and real loopback HTTP/SDK/SQL.

Retains device/app data. The old-arrival phase uses the previously installed app
before an in-place update, providing actual encrypted handoff migration evidence.
Never replaces authentication or protected originals and never disables FLAG_SECURE.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import time
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location('review', Path(__file__).with_name('home-residency-review-journey.py'))
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)
base = review.base


class Journey(review.Journey):
    def __init__(self, args):
        super().__init__(args)
        self.capabilities = self.fixture('capabilities')['capabilities']

    def capability(self, index):
        return next(c for c in self.capabilities if c['index'] == index)

    def open_invitation(self, index):
        self.adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                 '-d', 'pantopus://invite/' + self.capability(index)['token'], base.PACKAGE)

    def fill_login(self, label, value):
        self.tap(label)
        end = time.monotonic() + 15
        while time.monotonic() < end:
            focused = next((n for n in self.nodes() if n.get('class') == 'android.widget.EditText' and n.get('focused') == 'true'), None)
            if focused is not None: break
        else: raise AssertionError('Login field did not focus: ' + label)
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
        if focused.get('text'):
            self.adb('shell', 'input', 'keyevent', *(['KEYCODE_DEL'] * (len(focused.get('text')) + 2)))
        self.adb('shell', 'input', 'text', value)

    def login(self, index=1):
        self.launch()
        end = time.monotonic() + 35
        while time.monotonic() < end:
            nodes = self.nodes()
            if self.match(nodes, 'Email address') is not None: break
            if self.match(nodes, 'Sign in') is not None: self.tap('Sign in'); break
        self.fill_login('Email address', self.capability(index)['email'])
        self.fill_login('Password', 'synthetic-loopback-only')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Log in')

    def sign_out(self):
        self.launch()
        nodes = self.nodes()
        if self.match(nodes, 'Profile') is None and self.match(nodes, 'Place') is not None:
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        nodes = self.nodes()
        if self.match(nodes, 'Profile') is not None:
            self.tap('Profile')
            self.tap('Log out', scroll=True)
            self.tap('Sign out')
        end = time.monotonic() + 35
        while time.monotonic() < end:
            nodes = self.nodes()
            if self.match(nodes, 'Sign in') is not None or self.match(nodes, 'Email address') is not None: return
        raise AssertionError('Signed-out front door did not appear')

    def encrypted_preferences(self, name):
        result = self.adb('shell', 'run-as', base.PACKAGE, 'ls', 'shared_prefs').decode().splitlines()
        for filename in ['private_home_invitation_decision_v1.xml', 'private_pending_deep_link_v1.xml', 'pantopus_pending_deep_link.xml']:
            if filename not in result: continue
            data = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/' + filename)
            assert all(c['token'].encode() not in data for c in self.capabilities), 'Invitation capability found outside encryption'
            if filename == 'pantopus_pending_deep_link.xml':
                assert not list(ET.fromstring(data)), 'Legacy plaintext handoff must be empty after migration'
            (self.output / (name + '-' + filename)).write_bytes(data)
        return {'invitation_capability_count': 0, 'legacy_handoff_empty': True}

    def prepare_old_arrival(self):
        assert not self.fixture('state')['commands']
        self.sign_out()
        self.open_invitation(1)
        self.wait('Email address')
        self.evidence('older-installed-app-staged-login-arrival')
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        raw = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/pantopus_pending_deep_link.xml')
        assert self.capability(1)['token'].encode() in raw
        (self.output / 'owned-legacy-handoff.xml').write_bytes(raw)
        installed = self.adb('shell', 'pm', 'path', base.PACKAGE).decode().strip().removeprefix('package:')
        self.adb('pull', installed, str(self.output / 'older-installed.apk'))
        (self.output / 'result.json').write_text(json.dumps({'old_arrival_staged': True, 'decision_commands': 0}, indent=2))
        print('PASS: older installed app retained the invitation for a real in-place secure-storage migration', flush=True)

    def fault(self, action, kind, persistent=True):
        return self.fixture('fault', 'POST', {'action': action, 'kind': kind, 'persistent': persistent})

    def command(self, action):
        self.press('homeInvitation' + action.title())
        self.press('Confirm acceptance' if action == 'accept' else 'Confirm decline')

    def cold_invitation(self, index):
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.launch()
        self.open_invitation(index)

    def wait_state(self, predicate):
        end = time.monotonic() + 25
        while time.monotonic() < end:
            state = self.fixture('state')
            if predicate(state): return state
            time.sleep(0.1)
        raise AssertionError('Expected owned invitation server state did not appear')

    def switch_account(self, index):
        before = sum(e['event'] == 'logout_reply_held' for e in self.fixture('state')['events'])
        self.fault('logout', 'hold')
        self.press('homeInvitationSwitchAccount')
        self.press('Sign out and continue')
        self.wait('Email address')
        self.wait_state(lambda state: sum(e['event'] == 'logout_reply_held' for e in state['events']) == before + 1)
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        check = self.encrypted_preferences('account-switch-' + str(before + 1))
        (self.output / ('account-switch-' + str(before + 1) + '.json')).write_text(json.dumps(check, indent=2))
        self.fixture('release', 'POST', {})
        self.fault('logout', 'clear')
        self.login(index)

    def wait_acknowledged(self):
        end = time.monotonic() + 35
        while time.monotonic() < end:
            raw = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/private_home_invitation_decision_v1.xml')
            empty = all(n.get('name', '').startswith('__androidx_security_crypto_encrypted_prefs_') for n in ET.fromstring(raw))
            if empty and self.match(self.nodes(), 'homeInvitationOriginalHome') is None: return
            time.sleep(0.1)
        raise AssertionError('Native acknowledgement did not finish clearing the protected original')

    def migrated_arrival(self):
        self.login(1)
        self.wait('homeInvitationAccept', seconds=45, scroll=True)
        self.encrypted_preferences('migrated-pre-auth-arrival')
        assert not self.fixture('state')['commands']
        self.evidence('new-installed-app-recovers-migrated-invitation')

    def read_failures(self):
        self.press('tokenAcceptClose')
        self.fault('preview', 'before')
        self.open_invitation(1)
        self.wait('tokenAcceptError')
        self.no_controls('tokenAcceptExpiredFrame')
        self.evidence('unavailable-preview-has-retry')
        self.fault('preview', 'clear')
        self.press('tokenAcceptRetry')
        self.wait('homeInvitationAccept', scroll=True)
        self.press('tokenAcceptClose')
        self.fault('context', 'malformed')
        self.open_invitation(1)
        self.wait('homeInvitationError')
        self.no_controls('homeInvitationAccept')
        self.fault('context', 'clear')
        self.press('homeInvitationReopen')
        self.press('homeInvitationAccept')
        self.wait('Confirm acceptance')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        self.wait('Google app')
        self.launch()
        self.wait('homeInvitationAccept', scroll=True)
        self.no_controls('Confirm acceptance')
        assert not self.fixture('state')['commands']
        self.evidence('retired-confirmation-cannot-submit')

    def cancel_original(self):
        self.fault('accept', 'before')
        self.command('accept')
        self.wait('homeInvitationError', scroll=True)
        self.contains_review('Original decision: Accept invitation')
        self.encrypted_preferences('first-original')
        self.cold_invitation(1)
        self.wait('homeInvitationOriginalHome')
        self.press('homeInvitationRetry')
        self.wait('homeInvitationError')
        state = self.fixture('state')
        posts = [e for e in state['events'] if e.get('path') == '/api/homes/invitations/decisions' and e.get('method') == 'POST']
        assert len(posts) == 2 and posts[0]['request_id'] == posts[1]['request_id'] and posts[0]['request_hash'] == posts[1]['request_hash']
        assert not state['commands']
        self.press('homeInvitationCancel')
        self.press('Confirm cancellation')
        self.wait('Decision attempt cancelled')
        assert len(self.fixture('state')['commands']) == 1
        self.fault('accept', 'clear')
        self.evidence('unseen-original-cancelled-after-restart')
        self.press('homeInvitationAcknowledge')
        self.wait('homeInvitationAccept', scroll=True)

    def accept_across_accounts(self):
        self.fault('accept', 'after')
        self.command('accept')
        self.wait('homeInvitationError')
        self.fault('decision_read', 'before')
        self.cold_invitation(1)
        self.wait('homeInvitationError')
        self.contains_review('Original decision: Accept invitation')
        self.evidence('lost-acceptance-cold-read-failure')
        self.fault('decision_read', 'clear')
        self.press('homeInvitationCheck')
        self.wait('Acceptance saved')
        self.switch_account(2)
        self.wait('homeInvitationError')
        self.no_controls('homeInvitationOriginalHome')
        self.evidence('other-account-cannot-read-original')
        self.switch_account(1)
        self.wait('Acceptance saved')
        self.fixture('scenario', 'POST', {'index': 1, 'mode': 'deny_view'})
        self.press('homeInvitationAccess')
        self.wait('homeInvitationCurrentAccess', scroll=True)
        self.no_controls('homeInvitationOpenHome')
        self.fixture('scenario', 'POST', {'index': 1, 'mode': 'remove'})
        self.press('homeInvitationAccess')
        self.wait('homeInvitationCurrentAccess', scroll=True)
        self.no_controls('homeInvitationOpenHome')
        self.evidence('saved-acceptance-does-not-restore-removed-access')
        self.press('homeInvitationAcknowledge')
        self.wait_acknowledged()

    def decline_and_expiry(self):
        self.open_invitation(2)
        self.wait('homeInvitationError')
        self.switch_account(2)
        self.wait('homeInvitationDecline', scroll=True)
        self.fault('decline', 'after')
        self.command('decline')
        self.wait('homeInvitationError')
        self.cold_invitation(2)
        self.wait('Decline saved')
        self.evidence('lost-decline-recovered-after-restart')
        self.fault('decline', 'clear')
        self.press('homeInvitationAcknowledge')
        self.wait_acknowledged()
        self.open_invitation(3)
        self.wait('homeInvitationError')
        self.expire_current_invitation()

    def expire_current_invitation(self):
        self.switch_account(3)
        self.press('homeInvitationAccept')
        self.fixture('scenario', 'POST', {'index': 3, 'mode': 'expire'})
        self.press('Confirm acceptance')
        self.wait('Decision needs review')
        self.evidence('changed-invitation-rejection-keeps-original')
        self.press('homeInvitationAcknowledge')
        self.wait('homeInvitationError')

    def retire_held_reply(self):
        self.press('tokenAcceptClose')
        self.open_invitation(4)
        self.wait('homeInvitationError')
        self.switch_account(4)
        self.fault('accept', 'hold', persistent=False)
        self.command('accept')
        self.wait_state(lambda state: any(e['event'] == 'reply_held' for e in state['events']))
        self.open_invitation(1)
        self.wait('Acceptance saved')
        self.contains_review('This is an earlier invitation. Finish its recovery before deciding on the link you just opened.')
        self.fixture('release', 'POST', {})
        self.wait('homeInvitationDecision')
        self.evidence('earlier-original-wins-over-new-link-and-late-reply')
        self.press('homeInvitationAccess')
        self.press('homeInvitationOpenHome')
        self.finish_home_entry()

    def finish_home_entry(self):
        self.wait('Overview')
        self.wait('Property details', scroll=True)
        self.wait_state(lambda state: all(any(e.get('method') == 'GET' and e.get('actor') == 4
            and e.get('path') == '/api/homes/' + review.HOME + suffix for e in state['events'])
            for suffix in ['/dashboard', '/dashboard-access']))
        self.evidence('explicit-current-member-home-entry')
        self.open_invitation(4)
        self.wait('homeInvitationError')
        self.no_controls('homeInvitationOriginalHome')
        self.encrypted_preferences('all-originals-acknowledged')
        encrypted = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/private_home_invitation_decision_v1.xml')
        assert all(n.get('name', '').startswith('__androidx_security_crypto_encrypted_prefs_') for n in ET.fromstring(encrypted))

    def run(self):
        if self.args.phase == 'prepare-old-arrival': return self.prepare_old_arrival()
        if self.args.phase == 'finish-home-entry':
            assert len(self.fixture('state')['commands']) == 5
            self.finish_home_entry()
        elif self.args.phase == 'continue-after-accept':
            assert len(self.fixture('state')['commands']) == 2
            self.contains_review('This is an earlier invitation. Finish its recovery before deciding on the link you just opened.')
            self.evidence('new-link-during-acknowledgement-keeps-original')
            self.press('homeInvitationAcknowledge')
            self.wait('homeInvitationError')
            self.decline_and_expiry()
        elif self.args.phase == 'continue-after-decline':
            assert len(self.fixture('state')['commands']) == 3
            self.contains_review('This is an earlier invitation. Finish its recovery before deciding on the link you just opened.')
            self.press('homeInvitationAcknowledge')
            self.wait('homeInvitationError')
            self.expire_current_invitation()
        else:
            if self.args.phase == 'continue-decisions':
                assert not self.fixture('state')['commands']
                self.cold_invitation(1)
                self.wait('homeInvitationAccept', scroll=True)
            else:
                self.migrated_arrival()
            self.read_failures()
            self.cancel_original()
            self.accept_across_accounts()
            self.decline_and_expiry()
        if self.args.phase != 'finish-home-entry': self.retire_held_reply()
        state = self.fixture('state')
        commands = state['commands']
        assert len(commands) == 5
        assert sum(c['state'] == 'completed' and c['action'] == 'accept' for c in commands) == 2
        assert sum(c['state'] == 'completed' and c['action'] == 'decline' for c in commands) == 1
        assert sum(c['state'] == 'cancelled' for c in commands) == 1
        assert sum(c['state'] == 'rejected' for c in commands) == 1
        assert sum(e['event'] == 'logout_reply_held' for e in state['events']) == 5
        assert sum(e['event'] == 'logout_reply_released' for e in state['events']) == 5
        self.evidence('invitation-journey-complete')
        (self.output / 'result.json').write_text(json.dumps({'complete': True, 'decision_commands': 5, 'cold_account_handoffs': 5,
            'encrypted_originals_acknowledged': True, 'actual_legacy_handoff_migration': True}, indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print('PASS: installed invitation migration, protected original recovery, account changes, current access and retired replies', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--phase', required=True, choices=['prepare-old-arrival', 'full', 'continue-decisions', 'continue-after-decline', 'continue-after-accept', 'finish-home-entry'])
    journey = Journey(parser.parse_args())
    try: journey.run()
    except Exception:
        try: journey.evidence('failure-current-screen')
        except Exception: pass
        raise
