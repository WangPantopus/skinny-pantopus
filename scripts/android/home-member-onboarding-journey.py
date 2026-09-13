#!/usr/bin/env python3
"""Ordinary Android member admission and first use through shipped native UI.

Requires the exclusively leased member-onboarding fixture on loopback 18084 and
the owned recurrence AVD. Retains app data, uses normal sign-in and real sender
and recipient commands, and never installs permission grants or changes auth or
protected originals. Raw capabilities stay in private memory/evidence only.
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
base = sender.base


class Journey(sender.Journey):
    def __init__(self, args):
        assert not args.output.exists(), 'Use a fresh private evidence directory for each installed run'
        # This purpose starts with zero seeded invitations. Do not apply the
        # sender-recovery predecessor's >=2 seeded-capability precondition.
        base.Journey.__init__(self, args)
        private = self.fixture('capabilities')
        self.task_policy = args.first_use or args.capture_form
        assert private['policy_mode'] == ('member-tasks' if self.task_policy else 'baseline'), 'Wrong owned fixture policy mode'
        self.home = private['home']
        self.home_label = args.home_label or private['home_name']
        self.home_address = private['home_address']
        self.capabilities = private['capabilities']
        self.actors = [{key: actor[key] for key in ('index', 'id', 'email')} for actor in private['actors']]
        self.recipient = next(actor for actor in self.actors if actor['index'] == args.recipient_index)
        assert self.recipient['index'] > 0, 'The recipient must be an ordinary fixture actor'

    def login(self, index=0):
        actor = next(actor for actor in self.actors if actor['index'] == index)
        self.launch()
        surface = self.wait_any(('Sign in', 'Email address'))
        if surface == 'Sign in': self.tap('Sign in')
        self.fill_login('Email address', actor['email'])
        self.fill_login('Password', 'synthetic-loopback-only')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        boundary = len(self.fixture('state')['events'])
        self.tap('Log in')
        self.wait('Place', seconds=45)
        self.wait_state(lambda state: any(event.get('event') == 'request' and event.get('actor') == index
                                         for event in state['events'][boundary:]))

    def protected_slots_empty(self):
        names = self.adb('shell', 'run-as', base.PACKAGE, 'ls', 'shared_prefs').decode().splitlines()
        for name in ('private_home_invitation_sender_v1.xml', 'private_home_invitation_decision_v1.xml',
                     'private_home_task_creation_v1.xml'):
            if name not in names: continue
            raw = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/' + name)
            assert all(node.get('name', '').startswith('__androidx_security_crypto_encrypted_prefs_')
                       for node in ET.fromstring(raw)), 'A protected original requires recovery before a new journey'

    def open_profile_homes(self):
        self.launch()
        if self.match(self.nodes(), 'Profile') is not None:
            self.tap('Profile')
        else:
            # Supported monthly-receipt arrival opens the normal Profile page.
            # My homes is then reached through its actual Activity row; no
            # invented /my-homes deep link or blind back-stack popping is used.
            self.adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                     '-d', 'pantopus://profile?tab=receipt', base.PACKAGE)
        boundary = len(self.fixture('state')['events'])
        self.tap('My homes', scroll=True)
        self.wait('My homes')
        self.wait_state(lambda state: any(event.get('event') == 'request' and event.get('actor') == self.recipient['index']
                                         and event.get('method') == 'GET' and event.get('path', '').endswith('/my-homes')
                                         for event in state['events'][boundary:]))

    def cold_homes(self):
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.launch()
        self.wait('Place', seconds=45)
        self.open_profile_homes()

    def capture_identity(self, name):
        self.wait(self.home_label, scroll=True)
        self.evidence(name)
        nodes = self.nodes()
        # Capture observed claims rather than assuming household admission has
        # the correct residency badge. The baseline intentionally records bugs.
        labels = ('Member', 'Household access', 'Owner role', 'Ownership verified', 'Residency verified', 'Private setup')
        result = {label: any(label in (node.get('text', '') + node.get('content-desc', '')) for node in nodes)
                  for label in labels}
        # The synthetic Home name itself contains "Member". Require the actual
        # role subtitle, so a wrong role cannot pass on the Home title alone.
        result['Member'] = any(node.get('text') == 'Member' or node.get('text', '').startswith('Member · ')
                               for node in nodes)
        (self.output / (name + '-identity.json')).write_text(json.dumps(result, indent=2))
        if self.args.first_use:
            assert result['Member'] and result['Household access']
            assert not any(result[label] for label in ('Owner role', 'Ownership verified', 'Residency verified'))
        return result

    def open_matching_home(self):
        boundary = len(self.fixture('state')['events'])
        self.tap(self.home_label, scroll=True)
        self.wait_state(lambda state: all(any(event.get('event') == 'request'
                                             and event.get('actor') == self.recipient['index']
                                             and event.get('method') == 'GET'
                                             and event.get('path') == f'/api/homes/{self.home}/{suffix}'
                                             for event in state['events'][boundary:])
                                         for suffix in ('dashboard-access', 'dashboard')))
        self.wait('Home')
        self.wait(self.home_address, seconds=45, scroll=True)

    def normal_admission(self):
        self.protected_slots_empty()
        initial = self.fixture('state')
        assert not initial['sender_commands'] and not initial['commands'] and not self.capabilities
        assert not any(row['user_id'] == self.recipient['id'] for row in initial['memberships'])
        self.sign_out()
        self.login(0)
        self.open_sender()
        self.wait('Review invitation', scroll=True)
        nodes = self.nodes()
        parents = {child: parent for parent in nodes for child in parent}
        for label, checked in (('Member', 'true'), ('Guest', 'false')):
            chip = next(node for node in nodes if node.get('text') == label)
            while chip is not None and chip.get('checkable') != 'true': chip = parents.get(chip)
            assert chip is not None and chip.get('checked') == checked, 'Unexpected shipped default: ' + label
        self.evidence('shipped-default-member-form')
        self.prepare_create(self.recipient['email'])
        assert any(self.recipient['email'] in node.get('text', '') and '\nmember\n' in node.get('text', '')
                   for node in self.nodes()), 'Prepared sender terms did not preserve ordinary member'
        self.evidence('ordinary-member-prepared-terms')
        self.submit()
        self.wait('homeSenderTerminal', scroll=True)
        state = self.wait_state(lambda value: len(value['sender_commands']) == 1)
        original = state['sender_commands'][0]
        assert original['action'] == 'create' and original['state'] == 'completed'
        self.capabilities = self.fixture('capabilities')['capabilities']
        matches = [capability for capability in self.capabilities
                   if capability.get('actor_id') == self.recipient['id']
                   and capability.get('sender_request_id') == original['request_id']]
        assert len(matches) == 1 and matches[0]['invitation_id'] == original['invitation_id']
        capability = matches[0]
        self.protect('ordinary-member-sender-original')
        self.acknowledge()
        self.sign_out()
        self.login(self.recipient['index'])
        self.adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                 '-d', 'pantopus://invite/' + capability['token'], base.PACKAGE)
        self.wait('homeInvitationAccept', seconds=45, scroll=True)
        self.evidence('ordinary-member-recipient-reviewed-terms')
        self.command('accept')
        self.wait('Acceptance saved', scroll=True)
        self.encrypted_preferences('ordinary-member-recipient-original')
        self.press('homeInvitationAccess')
        self.wait('homeInvitationOpenHome', scroll=True)
        self.evidence('ordinary-member-acceptance-and-current-access')
        state = self.fixture('state')
        assert len(state['commands']) == 1
        decision = state['commands'][0]
        assert decision['state'] == 'completed' and decision['action'] == 'accept'
        assert decision['actor_id'] == self.recipient['id'] and decision['invitation_id'] == capability['invitation_id']
        rows = [row for row in state['memberships'] if row['user_id'] == self.recipient['id']]
        assert len(rows) == 1 and rows[0]['role_base'] == 'member' and rows[0]['is_active'] is True
        assert state['claim_count'] == initial['claim_count'] == 0
        assert state['ownership_claim_count'] == initial['ownership_claim_count'] == 0
        assert state['ownership'] == initial['ownership']
        assert not any(row['subject_id'] == self.recipient['id'] for row in state['ownership'])
        self.press('homeInvitationAcknowledge')
        self.wait_acknowledged()
        self.protected_slots_empty()
        return {'sender_request_id': original['request_id'], 'recipient_request_id': decision['request_id'],
                'invitation_id': capability['invitation_id'], 'home_id': self.home, 'actor_id': self.recipient['id']}

    def task_detail(self, task_id, title):
        self.adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                 '-d', f'pantopus://homes/{self.home}/tasks/{task_id}', base.PACKAGE)
        self.wait(title, seconds=45, scroll=True)

    def field_node(self, nodes, label):
        target = super().field_node(nodes, label)
        if target is not None or label not in ('Title', 'Notes (optional)'): return target
        # Filled Task editors expose a plain label sibling above EditText.
        # Require its actual visible bounds before selecting the nearest editor.
        marker = next((node for node in nodes if node.get('text') == label), None)
        if marker is None: return None
        left, top, right, bottom = self.bounds(marker)
        if bottom <= top or right <= left: return None
        editors = [node for node in nodes if node.get('class') == 'android.widget.EditText'
                   and self.bounds(node)[1] >= bottom and self.bounds(node)[3] > self.bounds(node)[1]]
        return min(editors, key=lambda node: self.bounds(node)[1]) if editors else None

    def verify_field_value(self, label, value):
        # The form exports off-screen labels, so their presence alone does not
        # establish a visible editor. Review both directions from the current
        # scroll position and require the actual field bounds and value.
        for attempt in range(16):
            target = self.field_node(self.nodes(), label)
            if target is not None:
                left, top, right, bottom = self.bounds(target)
                if right > left and bottom - top >= 80 and top >= 260 and bottom <= 2165:
                    assert target.get('text') == value, 'Current field changed before submission: ' + label
                    self.evidence('reviewed-current-' + ('title' if label == 'Title' else 'notes') + '-' + str(time.monotonic_ns()))
                    return
            toward_top = (label == 'Title') == (attempt < 8)
            self.adb('shell', 'input', 'swipe', '530', '700' if toward_top else '1660',
                     '530', '1660' if toward_top else '700', '250')
        raise AssertionError('Current field was not visible for review: ' + label)

    def background_refresh(self, task_id, expected_status=200):
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        self.wait('Google app')
        boundary = len(self.fixture('state')['events'])
        self.launch()
        self.wait_state(lambda state: any(event.get('event') == 'response'
                                         and event.get('actor') == self.recipient['index']
                                         and event.get('method') == 'GET'
                                         and event.get('path') in (
                                             f'/api/homes/{self.home}/tasks/{task_id}', f'/{self.home}/tasks/{task_id}')
                                         and event.get('status') == expected_status
                                         for event in state['events'][boundary:]))

    def member_scenario(self, mode):
        assert mode in ('deny_home_view', 'deny_tasks_view', 'deny_tasks_edit', 'remove', 'restore')
        self.fixture('member-scenario', 'POST', {'index': self.recipient['index'], 'mode': mode})

    def action(self, label):
        # Task labels can also appear in a non-interactive hero count or a
        # heading. Use an enabled action ancestor from the current hierarchy.
        end = time.monotonic() + 35
        attempt = 0
        while time.monotonic() < end:
            nodes = self.nodes()
            parents = {child: parent for parent in nodes for child in parent}
            for marker in nodes:
                if label not in (marker.get('text'), marker.get('content-desc')): continue
                target = marker
                while target is not None and target.get('clickable') != 'true': target = parents.get(target)
                if target is None or target.get('enabled') != 'true': continue
                x1, y1, x2, y2 = self.bounds(target)
                if x2 > x1 and y2 > y1:
                    self.adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))
                    return
            up = attempt % 12 < 6
            self.adb('shell', 'input', 'swipe', '530', '1550' if up else '700', '530', '700' if up else '1550', '250')
            attempt += 1
        raise AssertionError('Current enabled native action did not appear: ' + label)

    def open_tasks_from_home(self):
        self.action('Tasks')
        self.wait('Add a task', seconds=45, scroll=True)

    def task_row(self, task_id):
        rows = [row for row in self.fixture('state')['tasks'] if row['id'] == task_id]
        assert len(rows) == 1 and rows[0]['home_id'] == self.home
        return rows[0]

    def capture_task_form(self):
        before = self.fixture('state')
        assert not before['tasks'] and not before['task_receipts']
        boundary = len(before['events'])
        self.open_tasks_from_home()
        self.action('Add a task')
        self.wait('Add task')
        self.wait('Unassigned (any member)', scroll=True)
        self.wait('No members found in this home.', scroll=True)
        self.evidence('retained-r11-task-form-roster-denial-and-unassigned-copy')
        state = self.fixture('state')
        assert any(event.get('event') == 'request' and event.get('actor') == self.recipient['index']
                   and event.get('method') == 'GET' and event.get('path') == f'/api/homes/{self.home}/occupants'
                   for event in state['events'][boundary:])
        assert any(event.get('event') == 'response' and event.get('actor') == self.recipient['index']
                   and event.get('method') == 'GET' and event.get('path') in (
                       f'/api/homes/{self.home}/occupants', f'/{self.home}/occupants')
                   and event.get('status') == 403 for event in state['events'][boundary:])
        access = next(row['access'] for row in state['member_access'] if row['actor_id'] == self.recipient['id'])
        assert 'members.view' not in access['permissions'] and {'tasks.view', 'tasks.edit'} <= set(access['permissions'])
        self.action('Close')
        self.wait('Discard changes?')
        self.action('Discard')
        self.wait('Add a task', scroll=True)
        state = self.fixture('state')
        assert not state['tasks'] and not state['task_receipts']
        assert not any(event.get('event') == 'request' and event.get('method') in ('POST', 'PUT', 'PATCH', 'DELETE')
                       and event.get('path', '').startswith(f'/api/homes/{self.home}/tasks') for event in state['events'])
        self.protected_slots_empty()
        return {'form_opened': True, 'observed_unassigned_label': 'Unassigned (any member)',
                'observed_empty_roster_label': 'No members found in this home.',
                'members_view_granted': False, 'actual_roster_http_status': 403,
                'task_commands': 0, 'form_closed_by_discard': True}

    def create_task_with_recovery(self, resume_filled_form=False):
        title = 'Restock household towels'
        notes = 'Keep spares in the hallway cupboard.'
        assert not self.fixture('state')['tasks']
        if not resume_filled_form:
            self.open_tasks_from_home()
            self.action('Add a task')
        self.wait('Add task')
        self.wait('Unassigned', scroll=True)
        self.wait('Member list unavailable. You can leave this task unassigned.', scroll=True)
        self.no_controls('Unassigned (any member)', 'No members found in this home.')
        if not resume_filled_form:
            self.field('Title', title)
            self.field('Notes (optional)', notes)
        self.verify_field_value('Title', title)
        self.verify_field_value('Notes (optional)', notes)
        self.evidence('ordinary-member-real-task-form')
        self.fixture('fault', 'POST', {'action': 'task_create', 'kind': 'after', 'persistent': False})
        self.action('Save')
        self.wait('Retry original request', scroll=True)
        self.wait_state(lambda value: len(value['tasks']) == 1 and len(value['task_receipts']) == 1)
        return self.recover_task_original(title, notes)

    def recover_task_original(self, title, notes):
        self.wait('Retry original request', scroll=True)
        state = self.fixture('state')
        assert len(state['tasks']) == len(state['task_receipts']) == 1
        task, receipt = state['tasks'][0], state['task_receipts'][0]
        assert task['title'] == title and task['created_by'] == self.recipient['id']
        assert task['description'] == notes
        assert task['visibility'] == 'members' and task['status'] == 'open'
        assert receipt['actor_id'] == self.recipient['id'] and receipt['task_id'] == task['id']
        raw = self.adb('shell', 'run-as', base.PACKAGE, 'cat', 'shared_prefs/private_home_task_creation_v1.xml')
        assert all(value.encode() not in raw for value in (title, notes, self.home, receipt['request_id']))
        (self.output / 'lost-task-create-encrypted.xml').write_bytes(raw)
        self.evidence('household-task-committed-reply-lost')
        self.cold_homes()
        self.capture_identity('cold-member-identity-before-task-recovery')
        self.open_matching_home()
        self.open_tasks_from_home()
        self.action('Add a task')
        self.wait('Saved task request')
        self.action('Retry original request')
        self.wait(title, seconds=45, scroll=True)
        recovered = self.fixture('state')
        assert recovered['tasks'] == state['tasks'] and recovered['task_receipts'] == state['task_receipts']
        posts = [event for event in recovered['events'] if event.get('event') == 'request' and event.get('method') == 'POST'
                 and event.get('path') == f'/api/homes/{self.home}/tasks']
        assert len(posts) == 2 and posts[0]['request_id'] == posts[1]['request_id'] == receipt['request_id']
        assert posts[0]['request_hash'] == posts[1]['request_hash']
        self.protected_slots_empty()
        self.evidence('same-task-request-recovered-after-cold-return')
        return task['id'], title

    def task_lifecycle(self, task_id, title):
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.launch()
        self.wait('Place', seconds=45)
        self.task_detail(task_id, title)
        self.wait('Visibility: members', scroll=True)
        self.action('Edit')
        self.wait('Edit task')
        title = 'Restock household towels on Sunday'
        self.field('Title', title)
        notes = 'Use the top shelf in the hallway cupboard.'
        self.field('Notes (optional)', notes)
        self.verify_field_value('Title', title)
        self.verify_field_value('Notes (optional)', notes)
        self.action('Save')
        self.wait(title, seconds=45, scroll=True)
        assert self.task_row(task_id)['title'] == title
        assert self.task_row(task_id)['description'] == notes
        self.evidence('ordinary-member-own-task-edited')
        for action, status in (('Complete', 'done'), ('Reopen', 'open'), ('Complete', 'done')):
            self.action(action)
            self.wait('Status: ' + status, scroll=True)
            row = self.task_row(task_id)
            assert row['status'] == status
            assert (row['completed_at'] is not None) == (status == 'done')
        self.evidence('ordinary-member-own-task-completed-reopened-completed')
        return title

    def task_denials_and_recovery(self, task_id, title):
        self.fixture('fault', 'POST', {'action': 'task_read', 'kind': 'before', 'persistent': True})
        self.background_refresh(task_id, 503)
        self.wait('Reload task', scroll=True)
        self.no_controls(title, 'Edit', 'Reopen')
        self.evidence('current-task-read-failure-retires-private-content')
        self.fixture('fault', 'POST', {'action': 'task_read', 'kind': 'clear'})
        self.action('Reload task')
        self.wait(title, scroll=True)
        self.member_scenario('deny_tasks_edit')
        self.background_refresh(task_id)
        self.wait(title, scroll=True)
        self.no_controls('Edit', 'Complete', 'Reopen', 'Review Gig publication')
        self.evidence('individual-task-edit-denial-keeps-readable-task')
        self.member_scenario('restore')
        self.background_refresh(task_id)
        self.wait('Edit', scroll=True)
        self.member_scenario('deny_tasks_view')
        self.background_refresh(task_id, 403)
        self.wait('Reload task', scroll=True)
        self.no_controls(title, 'Edit', 'Reopen')
        self.evidence('individual-task-view-denial-retires-task')
        self.member_scenario('restore')
        self.action('Reload task')
        self.wait(title, scroll=True)
        self.member_scenario('deny_home_view')
        self.cold_homes()
        self.wait('No saved Homes yet')
        self.no_controls(self.home_label, 'Ownership verified', 'Residency verified')
        self.evidence('home-view-denial-removes-current-my-homes-identity')
        # Task authority is independent of home.view. A Home-view denial must
        # not silently be counted as proof that task-specific access was denied.
        self.task_detail(task_id, title)
        self.evidence('independent-task-permission-during-home-view-denial')
        self.member_scenario('restore')
        self.member_scenario('remove')
        self.background_refresh(task_id, 403)
        self.wait('Reload task', scroll=True)
        self.no_controls(title, 'Edit', 'Reopen')
        self.evidence('retired-membership-removes-task-access')
        self.cold_homes()
        self.wait('No saved Homes yet')
        self.no_controls(self.home_label)
        self.evidence('retired-membership-removes-current-home-row')
        self.member_scenario('restore')
        self.cold_homes()
        self.capture_identity('restored-current-member-identity')
        self.open_matching_home()
        self.task_detail(task_id, title)
        self.wait('Status: done', scroll=True)
        self.evidence('restored-membership-reopens-same-completed-task')

    def run(self):
        admission = self.normal_admission()
        self.cold_homes()
        identity = self.capture_identity('fresh-my-homes-ordinary-member')
        self.open_matching_home()
        self.evidence('matching-home-baseline-task-availability')
        access = next(row['access'] for row in self.fixture('state')['member_access']
                      if row['actor_id'] == self.recipient['id'])
        assert access['effective_role_base'] == 'member' and access['is_owner'] is False
        permissions = access['permissions']
        assert 'home.view' in permissions
        if not self.task_policy:
            assert 'tasks.view' not in permissions and 'tasks.edit' not in permissions
            assert not self.fixture('state')['tasks'] and not self.fixture('state')['task_receipts']
        task = None
        form_capture = self.capture_task_form() if self.args.capture_form else None
        if self.args.first_use:
            task_id, title = self.create_task_with_recovery()
            title = self.task_lifecycle(task_id, title)
            self.task_denials_and_recovery(task_id, title)
            self.protected_slots_empty()
            task = self.task_row(task_id)
        state = self.fixture('state')
        (self.output / 'admission-checkpoint.json').write_text(json.dumps(admission, indent=2))
        (self.output / 'result.json').write_text(json.dumps({
            'admission_complete': True, 'sender_commands': 1, 'recipient_commands': 1,
            'policy_mode': 'member-tasks' if self.task_policy else 'baseline',
            'all_originals_acknowledged': True, 'identity_observed': identity,
            'member_permissions': permissions,
            'task_first_use_complete': task is not None, 'baseline_only': not self.task_policy,
            'form_capture_only': self.args.capture_form, 'form_capture': form_capture,
            'task': task,
        }, indent=2))
        (self.output / 'final-state.json').write_text(json.dumps(state, indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        message = ('PASS installed member first use.' if self.args.first_use else
                   'PASS retained-app form capture: actual admission, current Task form, no Task command.' if self.args.capture_form else
                   'PASS admission baseline: shipped member form, actual recipient acceptance, fresh My Homes and matching Home; Task first use remains unverified.')
        print(message, flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--recipient-index', type=int, default=1)
    parser.add_argument('--home-label', help='Use only an explicitly configured fixture Home label.')
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--first-use', action='store_true', help='Run Task lifecycle and denials after the deliberate policy repair is installed.')
    modes.add_argument('--capture-form', action='store_true', help='With the Task policy, capture the retained app form and close it without Task commands.')
    journey = Journey(parser.parse_args())
    try:
        journey.run()
    except Exception:
        try: journey.evidence('failure-current-screen')
        except Exception: pass
        raise
