#!/usr/bin/env python3
"""Installed owned Android: real geo/validation/lookup routes and canonical SQL."""
import argparse
import importlib.util
import json
from pathlib import Path
import time
import subprocess
import re
import xml.etree.ElementTree as ET
spec = importlib.util.spec_from_file_location('firstuse', Path(__file__).with_name('home-list-first-use-journey.py'))
firstuse = importlib.util.module_from_spec(spec)
spec.loader.exec_module(firstuse)
base = firstuse.base
LINE = '9131 Address Entry Fixture Way'

class Journey(firstuse.Journey):
    def launch(self):
        try:
            super().launch()
        except subprocess.TimeoutExpired:
            # Clearing the owned debug app can leave an old Android task removal
            # in flight. Its timeout kills the next process; retry one launch.
            self.adb('shell', 'am', 'force-stop', base.PACKAGE)
            super().launch()

    def login(self):
        self.launch()
        self.tap('Sign in')
        self.fill('Email address', 'entry-ui@example.invalid')
        self.fill('Password', 'synthetic-loopback-only')
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('Log in')
        self.wait('Place', seconds=45)

    def open_list(self):
        self.tap("Profile")
        self.tap("My homes", scroll=True)

    @staticmethod
    def bounds(node):
        return tuple(map(int, re.findall(r'\d+', node.get('bounds'))))

    def field_node(self, nodes, label):
        # Labels can be siblings of their editable controls. Do not climb to
        # the enclosing keyboard-dismiss panel as the button helper does.
        marker = next((n for key in ('content-desc', 'resource-id', 'text')
                       for n in nodes if n.get(key) == label), None)
        if marker is None: return None
        left, top, right, bottom = self.bounds(marker)
        for node in nodes:
            if node.get('class') != 'android.widget.EditText': continue
            x1, y1, x2, y2 = self.bounds(node)
            if left <= (x1 + x2) // 2 <= right and top <= (y1 + y2) // 2 <= bottom: return node
        return None

    def field(self, label, value):
        print('Editing visible field: ' + label, flush=True)
        for attempt in range(6):
            self.wait(label, scroll=True)
            nodes = self.nodes()
            target = self.field_node(nodes, label)
            if target is None:
                self.adb('shell', 'input', 'swipe', '530', '1660', '530', '1000', '250')
                continue
            if target is not None:
                left, top, right, bottom = self.bounds(target)
                if bottom - top < 80:
                    # ZIP can be exported as a narrow sliver behind the CTA.
                    self.adb('shell', 'input', 'swipe', '530', '1660', '530', '1000', '250')
                    continue
                self.adb('shell', 'input', 'tap', str((left + right) // 2), str((top + bottom) // 2))
                active = self.field_node(self.nodes(), label)
                if active is not None and active.get('focused') == 'true':
                    break
        else:
            raise RuntimeError('Address field did not receive focus: ' + label)
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
        if active.get('text'):
            self.adb('shell', 'input', 'keyevent', *(['KEYCODE_DEL'] * (len(active.get('text')) + 2)))
        self.adb('shell', 'input', 'text', value.replace(' ', '%s'))
        assert any(n.get('class') == 'android.widget.EditText' and n.get('focused') == 'true' and
                   n.get('text') == value for n in self.nodes()), 'Address text was not replaced exactly: ' + label
        ime = self.adb('shell', 'dumpsys', 'input_method').decode()
        if 'mInputShown=true' in ime:
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')

    def back_to_discard(self):
        # The first system Back can belong to the input method or focused field.
        for _ in range(2):
            self.adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
            nodes = self.nodes()
            if self.match(nodes, 'Discard your progress?') is not None: return
            if self.match(nodes, 'Find your home') is None:
                raise AssertionError('System Back left a dirty wizard without confirmation')
        self.wait('Discard your progress?')

    def disabled(self):
        self.wait('Continue')
        root = ET.parse(self.output / 'current.xml').getroot()
        parents = {child: parent for parent in root.iter() for child in parent}
        node = next(n for n in root.iter('node') if n.get('content-desc') == 'Continue')
        while node is not None:
            if node.get('enabled') == 'false': return
            node = parents.get(node)
        raise AssertionError('Continue must be disabled in the actual accessibility hierarchy')

    def run(self):
        if self.args.unit_recovery:
            self.fixture('mode', 'POST', {'mode': 'missing_unit'})
            self.launch()
            nodes = self.nodes()
            if self.match(nodes, 'Find your home') is None:
                if self.match(nodes, 'Back') is not None and self.match(nodes, 'Add home') is not None:
                    for _ in range(3):
                        self.tap('Back')
                        if self.match(self.nodes(), 'Find your home') is not None: break
                else:
                    self.wait('Place', seconds=45)
                    self.open_list()
                    self.tap('Add a home')
            self.wait('Find your home')
            self.tap('Add address manually', scroll=True)
            for label, value in [('Street address', LINE), ('City', 'Test'), ('State', 'WA'), ('ZIP code', '98607')]: self.field(label, value)
            self.tap('Continue')
            self.contains('Enter your unit', scroll=True)
            self.disabled()
            self.tap('Edit address', scroll=True)
            self.field('Unit or apartment (optional)', '3B')
            self.fixture('mode', 'POST', {'mode': 'current'})
            self.tap('Continue')
            self.contains('Address recognized', scroll=True)
            self.evidence('edited-unit-validates-before-continuing')
            self.tap('Continue')
            self.wait("What's your role?")
            state = self.fixture('state')
            assert any(e['event'] == 'google_boundary' and e.get('unit') == '3B' for e in state['events'])
            assert not any(e['event'] == 'fixture_error' for e in state['events'])
            (self.output / 'result.json').write_text(json.dumps({'passed': True, 'scope': 'missing unit edit and validation'}, indent=2))
            self.adb('shell', 'am', 'force-stop', base.PACKAGE)
            print('PASS installed Android missing unit, edit and canonical validation recovery')
            return
        if self.args.resume_validation:
            self.fixture('mode', 'POST', {'mode': 'current'})
            self.launch()
            nodes = self.nodes()
            if self.match(nodes, 'Find your home') is None:
                if self.match(nodes, 'Add home') is not None:
                    self.tap('Back')
                else:
                    self.wait('Place', seconds=45)
                    self.open_list()
                    self.tap('Add a home')
            self.wait('Find your home')
            self.tap('Add address manually', scroll=True)
            self.validate_journey()
            return
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        self.adb('shell', 'pm', 'clear', base.PACKAGE)
        self.fixture('reset', 'POST')
        self.login()
        self.open_list()
        self.tap('Add a home')
        self.wait('Find your home')
        self.absent('412 Elm St', 'Nearby homes', 'Available', 'Claimed')
        self.tap('Add address manually')
        self.field('City', 'Test')
        self.back_to_discard()
        self.evidence('system-back-protects-partial-manual-draft')
        self.tap('Keep going')
        self.wait('Test')
        self.back_to_discard()
        self.tap('Discard')
        self.wait('My homes')
        self.tap('Add a home')
        self.wait('Find your home')
        self.absent('City', 'Test')
        self.evidence('discard-does-not-restore-partial-address')
        self.fixture('mode', 'POST', {'mode': 'search_error'})
        self.field('Search by address or nearby', '9131')
        self.contains('Address search is unavailable')
        self.evidence('real-search-outage')
        self.fixture('mode', 'POST', {'mode': 'current'})
        self.tap('Try search again')
        self.contains(LINE)
        self.tap(LINE)
        self.wait('Street address', scroll=True)
        self.evidence('real-search-resolve-editable-address')
        self.tap('Add address manually', scroll=True)
        self.validate_journey()

    def validate_journey(self):
        for label, value in [('Street address', LINE), ('City', 'Test'), ('State', 'WA'), ('ZIP code', '98606')]: self.field(label, value)
        self.evidence('manual-real-address-ready')
        self.fixture('mode', 'POST', {'mode': 'provider_outage'})
        self.tap('Continue')
        self.contains('Address verification is unavailable', scroll=True)
        self.disabled()
        self.evidence('validation-outage-no-false-ready')
        self.fixture('mode', 'POST', {'mode': 'current'})
        self.tap('Try again', scroll=True)
        self.wait('Apply ZIP correction to 98607', scroll=True)
        self.disabled()
        self.evidence('canonical-zip-needs-confirmation')
        self.tap('Apply ZIP correction to 98607')
        self.tap('Continue')
        self.wait("What's your role?")
        self.evidence('validated-address-reaches-role')
        self.tap('Back')
        self.tap('Back')
        self.wait('Find your home')
        for mode, message in [('missing_unit', 'Enter your unit'), ('malformed_validation', 'Could not check this address'), ('lookup_error', 'Could not check this address')]:
            self.fixture('mode', 'POST', {'mode': mode})
            self.tap('Continue')
            self.contains(message, scroll=True)
            self.disabled()
            self.evidence(mode + '-safe-refusal')
            self.fixture('mode', 'POST', {'mode': 'current'})
            self.tap('Try again', scroll=True)
            self.contains('Address recognized', scroll=True)
            self.tap('Continue')
            self.wait("What's your role?")
            self.tap('Back')
            self.tap('Back')
        self.fixture('hold', 'POST', {'suffix': '/validate'})
        self.tap('Continue')
        deadline = time.monotonic() + 20
        while not self.fixture('state')['held']:
            if time.monotonic() > deadline: raise RuntimeError('No produced validation reply held')
            time.sleep(.2)
        self.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        deadline = time.monotonic() + 10
        while True:
            activities = self.adb('shell', 'dumpsys', 'activity', 'activities').decode()
            if not any(base.PACKAGE in line for line in activities.splitlines() if 'mResumedActivity' in line): break
            if time.monotonic() > deadline: raise RuntimeError('Owned app did not leave the foreground')
            time.sleep(.1)
        self.fixture('release', 'POST')
        self.launch()
        self.wait('Find your home')
        self.absent('Address recognized', "What's your role?")
        self.evidence('background-retires-produced-validation')
        self.tap('Continue')
        self.contains('Address recognized', scroll=True)
        self.evidence('foreground-revalidation-recovers')
        state = self.fixture('state')
        assert not [e for e in state['events'] if e['event'] == 'fixture_error' or e['event'] == 'backend_error' and e.get('mode') not in ('lookup_error', 'search_error')]
        assert any(e['event'] == 'sdk_insert' and e['table'] == 'HomeAddress' for e in state['events'])
        assert not any(e['event'] == 'request' and e['path'] == '/api/homes' and e['method'] == 'POST' for e in state['events'])
        (self.output / 'result.json').write_text(json.dumps({'passed': True,
            'scope': 'address validation continuation' if self.args.resume_validation else 'address entry; no create/admission acceptance',
            'events': len(state['events'])}, indent=2))
        self.adb('shell', 'am', 'force-stop', base.PACKAGE)
        print('PASS installed Android real address entry, validation, correction, failures and lifecycle recovery')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', required=True)
    parser.add_argument('--serial', required=True)
    parser.add_argument('--output', required=True, type=Path)
    continuation = parser.add_mutually_exclusive_group()
    continuation.add_argument('--resume-validation', action='store_true', help='Continue an already signed-in, open owned address form; preserves prior entry evidence.')
    continuation.add_argument('--unit-recovery', action='store_true', help='Verify missing-unit edit/revalidation through the signed-in owned app.')
    journey = Journey(parser.parse_args())
    try: journey.run()
    except Exception:
        try: journey.evidence('failure-current-screen')
        except Exception: pass
        raise
