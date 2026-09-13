#!/usr/bin/env python3
"""Installed native recurrence HTTP fixture. No hosted auth, worker or provider.

Uses the existing synthetic login/task routes, with immutable recurrence receipts
and deliberate lost committed replies. Real generation has separate SQL/service
and browser acceptance. Never log credentials, headers or operator data.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
import os
import uuid
from http.server import ThreadingHTTPServer
from pathlib import Path

spec = importlib.util.spec_from_file_location('task_fixture', Path(__file__).with_name('home-task-ui-fixture.py'))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
PATH = f'{base.TASK_PATH}/{base.TASK}/recurrence'


class Recurrence:
    def reset(self):
        base.STATE.reset()
        base.STATE.task = dict(id=base.TASK, home_id=base.HOME, created_by=base.ACTOR,
                              title='Recurring copper task', task_type='chore', status='open', priority='medium',
                              due_at=base.STAMP, updated_at=base.STAMP, recurrence_rule=None, capabilities=base.CAPS)
        self.config = None
        self.receipts = {}
        self.commands = {}
        self.fail_response = True

    def state(self):
        return dict(ok=True, home_id=base.HOME, task_id=base.TASK, can_manage=True,
                    task_updated_at=base.STATE.task['updated_at'], revision=self.config['revision'] if self.config else 0,
                    configuration=self.config, task_session=base.STATE.task_session())

    def snapshot(self):
        return dict(**base.STATE.snapshot(), recurrence=self.state(), commands=list(self.commands.values()),
                    receipts=list(self.receipts.values()))

    def change(self, command):
        request_id = command['request_id']
        if str(uuid.UUID(request_id)) != request_id:
            raise ValueError('Original lowercase request UUID required')
        if request_id in self.commands:
            if command != self.commands[request_id]:
                return dict(code='HOME_TASK_RECURRENCE_CONFLICT', error='Original command changed'), 409
            base.STATE.event('recurrence_replayed', request_id=request_id, action=command['action'])
            return dict(**self.state(), receipt=self.receipts[request_id], replayed=True), 200
        revision = self.config['revision'] if self.config else 0
        if command.get('expected_revision') != revision:
            return dict(code='HOME_TASK_RECURRENCE_STALE', error='Reload the current schedule'), 409
        action = command['action']
        if action == 'start':
            if set(command) != {'request_id', 'action', 'expected_revision', 'expected_task_updated_at', 'frequency', 'interval', 'timezone'}:
                raise ValueError('Wrong start fields')
            if command['expected_task_updated_at'] != base.STATE.task['updated_at']:
                return dict(code='HOME_TASK_RECURRENCE_STALE', error='Task changed'), 409
            if command['frequency'] not in ['DAILY', 'WEEKLY', 'MONTHLY'] or not 1 <= command['interval'] <= 365:
                raise ValueError('Wrong cadence')
            self.config = dict(id='53000000-0000-4000-8000-000000000700', revision=revision+1, state='active', reason=None,
                               frequency=command['frequency'], interval=command['interval'], timezone=command['timezone'],
                               anchor_at=base.STAMP, next_due_at='2026-09-24T12:00:00Z',
                               last_due_at=None, last_task_id=None, generated_count=0)
        elif action == 'pause':
            if set(command) != {'request_id', 'action', 'expected_revision'}:
                raise ValueError('Pause contains unrelated fields')
            if self.config:
                self.config.update(revision=revision+1, state='paused', next_due_at=None)
        else:
            raise ValueError('Unknown command')
        self.commands[request_id] = copy.deepcopy(command)
        self.receipts[request_id] = dict(request_id=request_id, actor_id=base.ACTOR, home_id=base.HOME, task_id=base.TASK,
                                        action=action, revision=self.config['revision'] if self.config else 0,
                                        request_hash=hashlib.sha256(json.dumps(command, sort_keys=True).encode()).hexdigest(), created_at=base.STAMP)
        base.STATE.event('recurrence_committed', request_id=request_id, action=action)
        return dict(**self.state(), receipt=self.receipts[request_id], replayed=False), 200


RECURRENCE = Recurrence()
RECURRENCE.reset()


class Handler(base.Handler):
    def route(self, method, path):
        if path == '/fixture/reset' and method == 'POST':
            self.body()
            RECURRENCE.reset()
            return self.respond(dict(ok=True))
        if path == '/fixture/state' and method == 'GET':
            return self.respond(RECURRENCE.snapshot())
        if path == '/fixture/pause-elsewhere' and method == 'POST':
            self.body()
            state = RECURRENCE.state()
            result, status = RECURRENCE.change(dict(request_id=str(uuid.uuid4()), action='pause', expected_revision=state['revision']))
            return self.respond(result, status)
        if path == '/fixture/fail-next-reply' and method == 'POST':
            self.body()
            RECURRENCE.fail_response = True
            return self.respond(dict(ok=True))
        if path == PATH:
            if self.headers.get('Authorization') != 'Bearer '+base.TOKEN:
                return self.respond(dict(error='Synthetic sign-in required'), 401)
            if base.STATE.revoked:
                base.STATE.event('denied_recurrence', method=method)
                return self.respond(dict(error='Current task access ended', code='HOME_RECORD_DENIED'), 403)
            supplied = self.headers.get('X-Pantopus-Session-Scope')
            if supplied != base.SESSION:
                raise ValueError('Exact current session proof required')
            if method == 'GET':
                return self.respond(RECURRENCE.state())
            if method == 'POST':
                result, status = RECURRENCE.change(self.json_body())
                if status == 200 and RECURRENCE.fail_response:
                    RECURRENCE.fail_response = False
                    base.STATE.event('recurrence_reply_lost')
                    return self.respond(dict(error='Synthetic interrupted committed reply'), 503)
                return self.respond(result, status)
            raise ValueError('Unexpected recurrence method')
        if base.STATE.task:
            config = RECURRENCE.config
            base.STATE.task['automatic_recurrence'] = {key: config[key] for key in ['state', 'frequency', 'interval', 'timezone', 'next_due_at']} if config else None
        return super().route(method, path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=18083)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    assert args.output.is_absolute() and not args.output.is_relative_to(Path(__file__).resolve().parents[2])
    os.umask(0o077)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        args.output.write_text(json.dumps(RECURRENCE.snapshot(), indent=2))
        server.server_close()
