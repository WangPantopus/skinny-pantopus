#!/usr/bin/env python3
"""Loopback-only, synthetic HTTP fixture for the installed iOS Home task journey.

This exercises real app HTTP, multipart and UI controls. It does not emulate SQL
concurrency or hosted storage; those have separate contracts. No real credentials
are accepted or written. State and private fixture files are local to this process.
"""
import argparse
import email.parser
import email.policy
import hashlib
import json
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOME = '53000000-0000-4000-8000-000000000001'
ACTOR = '53000000-0000-4000-8000-000000000002'
TASK = '53000000-0000-4000-8000-000000000003'
SESSION = 'b' * 64
EMAIL = 'bp-task-ui@example.com'
PASSWORD = 'synthetic-loopback-only'
TOKEN = 'pantopus-synthetic-task-ui-loopback-only'
TITLE = 'Copper lighthouse task'
FILE_NAME = 'home-task-acceptance.txt'
FILE_BYTES = b'Exact private task attachment: copper lighthouse.\nSynthetic local UI acceptance only.\n'
STAMP = '2026-09-10T12:00:00Z'
USER = dict(id=ACTOR, email=EMAIL, username='task_ui_fixture', name='Task UI Fixture',
            firstName='Task', lastName='Fixture', accountType='personal', role='user',
            verified=True, createdAt=STAMP, updatedAt=STAMP)
HOME_ROW = dict(id=HOME, name='Task UI Fixture', address='1 Synthetic Street', city='Testville',
                state='WA', zipcode='00000', home_type='house', isOwner=False, isOccupant=True)
TASK_PATH = f'/api/homes/{HOME}/tasks'
MEDIA_PATH = f'/api/upload/home-task-media/{HOME}/{TASK}'
CAPS = dict(can_edit=True, can_complete=True, can_delete=True, can_upload=True)


class State:
    def __init__(self):
        self.lock = threading.RLock()
        self.reset()

    def reset(self):
        self.task = None
        self.receipt = None
        self.create_payload = None
        self.media = None
        self.media_bytes = None
        self.revoked = False
        self.fail_create = True
        self.fail_upload = True
        self.fail_remove = 3
        self.events = []

    def task_session(self):
        return dict(home_id=HOME, actor_id=ACTOR, session_scope=SESSION)

    def event(self, name, **data):
        self.events.append(dict(event=name, **data))

    def snapshot(self):
        return dict(task=self.task, receipt=self.receipt, media=self.media,
                    revoked=self.revoked, events=self.events)


STATE = State()


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *_):
        pass  # Never log credentials, bearer headers or raw request bodies.

    def respond(self, value, status=200, mime='application/json', extra=None):
        data = json.dumps(value).encode() if mime == 'application/json' else value
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'private, no-store')
        for key, item in (extra or {}).items():
            self.send_header(key, item)
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        count = int(self.headers.get('Content-Length', '0'))
        if count > 26 * 1024 * 1024:
            raise ValueError('Fixture body limit')
        return self.rfile.read(count)

    def json_body(self):
        return json.loads(self.body() or b'{}')

    def do_GET(self):
        self.dispatch('GET')

    def do_POST(self):
        self.dispatch('POST')

    def do_DELETE(self):
        self.dispatch('DELETE')

    def do_PUT(self):
        self.dispatch('PUT')

    def dispatch(self, method):
        path = urlparse(self.path).path
        try:
            with STATE.lock:
                self.route(method, path)
        except (ValueError, KeyError, TypeError) as error:
            STATE.event('fixture_rejected', method=method, path=path, reason=str(error))
            self.respond(dict(error='Synthetic fixture rejected the request'), 400)

    def route(self, method, path):
        if path == '/fixture/state' and method == 'GET':
            return self.respond(STATE.snapshot())
        if path == '/fixture/reset' and method == 'POST':
            self.body()
            STATE.reset()
            return self.respond(dict(ok=True))
        if path == '/fixture/revoke' and method == 'POST':
            self.body()
            STATE.revoked = True
            STATE.event('revoked')
            return self.respond(dict(ok=True))
        if path == '/fixture/restore' and method == 'POST':
            self.body()
            STATE.revoked = False
            STATE.event('restored')
            return self.respond(dict(ok=True))
        if path == '/fixture/file' and method == 'GET':
            return self.respond(FILE_BYTES, mime='text/plain', extra={
                'Content-Disposition': f'attachment; filename="{FILE_NAME}"'})
        if path == '/fixture/links' and method == 'GET':
            return self.respond((f'<!doctype html><meta name="viewport" content="width=device-width">'
                                 f'<h1>Synthetic Home task fixture</h1>'
                                 f'<p><a href="pantopus://homes/{HOME}/dashboard">Open fixture Home</a></p>'
                                 f'<p><a href="pantopus://homes/{HOME}/tasks/{TASK}">Open exact fixture task</a></p>'
                                 '<p><a href="/fixture/file">Download fixture attachment</a></p>').encode(), mime='text/html')
        if path == '/api/users/login' and method == 'POST':
            body = self.json_body()
            if body.get('email') != EMAIL or body.get('password') != PASSWORD:
                return self.respond(dict(error='Only the synthetic fixture account is accepted'), 401)
            STATE.event('signed_in')
            return self.respond(dict(user=USER, accessToken=TOKEN, refreshToken=TOKEN+'-refresh',
                                     expiresIn=86400, sessionId=SESSION,
                                     session=dict(id=SESSION, context='interactive')))
        if path.startswith('/api/'):
            if self.headers.get('Authorization') != 'Bearer '+TOKEN:
                return self.respond(dict(error='Synthetic fixture sign-in required'), 401)
        if path in (TASK_PATH, f'{TASK_PATH}/{TASK}') or path.startswith(MEDIA_PATH):
            if STATE.revoked:
                STATE.event('denied_current_task', method=method, path=path)
                return self.respond(dict(error='Task access was revoked', code='HOME_RECORD_DENIED'), 403)
            supplied = self.headers.get('X-Pantopus-Session-Scope')
            if method != 'GET' or path.startswith(MEDIA_PATH):
                if supplied != SESSION:
                    raise ValueError('Missing exact current task session scope')
            elif supplied is not None and supplied != SESSION:
                raise ValueError('Mismatched task session scope')
        if path == TASK_PATH:
            if method == 'GET':
                return self.respond(dict(tasks=[STATE.task] if STATE.task else [],
                                         collection_capabilities=dict(can_create=True), task_session=STATE.task_session()))
            if method == 'POST':
                command = self.json_body()
                request_id = str(uuid.UUID(command['request_id']))
                if command['title'] != TITLE:
                    raise ValueError('Exact synthetic title required')
                if STATE.receipt:
                    if command != STATE.create_payload:
                        raise ValueError('Create replay changed original UUID or payload')
                    STATE.event('create_replayed', request_id=request_id, task_id=TASK)
                else:
                    STATE.create_payload = command
                    STATE.task = dict(command, id=TASK, home_id=HOME, status='open', created_by=ACTOR, capabilities=CAPS)
                    STATE.task.pop('request_id', None)
                    payload_hash = hashlib.sha256(json.dumps(command, sort_keys=True).encode()).hexdigest()
                    STATE.receipt = dict(home_id=HOME, actor_id=ACTOR, request_id=request_id, task_id=TASK,
                                         payload_hash=payload_hash, created_at=STAMP)
                    STATE.event('create_committed', request_id=request_id, task_id=TASK)
                if STATE.fail_create:
                    STATE.fail_create = False
                    return self.respond(dict(error='Synthetic interrupted create reply'), 503)
                return self.respond(dict(task=STATE.task, creation_receipt=STATE.receipt,
                                         replayed=True, task_session=STATE.task_session()), 201)
        if path == f'{TASK_PATH}/{TASK}' and method == 'GET':
            if not STATE.task:
                return self.respond(dict(error='No fixture task yet'), 404)
            STATE.event('exact_task_read', task_id=TASK)
            return self.respond(dict(task=STATE.task, task_session=STATE.task_session()))
        if path == MEDIA_PATH:
            if method == 'GET':
                return self.respond(dict(media=[STATE.media] if STATE.media else [], can_upload=True))
            if method == 'POST':
                raw = self.body()
                message = email.parser.BytesParser(policy=email.policy.default).parsebytes(
                    ('Content-Type: '+self.headers['Content-Type']+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+raw)
                fields = {part.get_param('name', header='content-disposition'): part for part in message.iter_parts()}
                upload_id = str(uuid.UUID(fields['upload_id'].get_payload(decode=True).decode()))
                part = fields['file']
                data = part.get_payload(decode=True)
                name = part.get_filename()
                if data != FILE_BYTES or part.get_content_type() != 'text/plain' or name != f'task-attachment-{upload_id}.txt':
                    raise ValueError('Multipart original bytes, MIME or generated filename changed')
                record = dict(id=upload_id, home_id=HOME, task_id=TASK, uploaded_by=ACTOR, file_name=name,
                              mime_type='text/plain', file_size=len(data), state='ready', available=True, cleanup_pending=False)
                if STATE.media:
                    if STATE.media != record or STATE.media_bytes != data:
                        raise ValueError('Upload replay changed original record or bytes')
                    STATE.event('upload_replayed', upload_id=upload_id)
                else:
                    STATE.media = record
                    STATE.media_bytes = data
                    STATE.event('upload_committed', upload_id=upload_id, byte_count=len(data), sha256=hashlib.sha256(data).hexdigest())
                if STATE.fail_upload:
                    STATE.fail_upload = False
                    return self.respond(dict(error='Synthetic interrupted upload reply'), 503)
                return self.respond(dict(media=[STATE.media]), 201)
        if STATE.media and path == f"{MEDIA_PATH}/{STATE.media['id']}/download" and method == 'GET':
            if not STATE.media['available']:
                return self.respond(dict(error='Attachment removed'), 404)
            STATE.event('private_bytes_read', upload_id=STATE.media['id'])
            return self.respond(STATE.media_bytes, mime='text/plain')
        if STATE.media and path == f"{MEDIA_PATH}/{STATE.media['id']}" and method == 'DELETE':
            STATE.media.update(state='retired', available=False, cleanup_pending=False)
            STATE.media_bytes = None
            STATE.event('remove_requested', upload_id=STATE.media['id'])
            if STATE.fail_remove:
                STATE.fail_remove -= 1
                return self.respond(dict(error='Synthetic interrupted removal reply'), 503)
            return self.respond(dict(media=STATE.media))
        if method == 'GET':
            if path in ('/api/users/me', '/api/users/profile'):
                return self.respond(dict(user=USER, **USER))
            if path == '/api/homes' or path.endswith('/my-homes'):
                return self.respond(dict(homes=[HOME_ROW]))
            if path == f'/api/homes/{HOME}':
                return self.respond(dict(home=HOME_ROW))
            if path == f'/api/homes/{HOME}/me':
                return self.respond(dict(hasAccess=True, is_owner=False, role_base='member', permissions=['home.view','tasks.view','tasks.manage']))
            if path == f'/api/homes/{HOME}/dashboard':
                return self.respond(dict(home=HOME_ROW, myAccess=dict(permissions=['tasks.view','tasks.manage'], isOwner=False)))
            if path.endswith('/members'):
                return self.respond(dict(members=[]))
            if path == '/api/notifications':
                return self.respond(dict(notifications=[], unreadCount=0, pagination=dict(page=1, totalPages=0, total=0)))
            if path.endswith('/unread-count'):
                return self.respond(dict(count=0, unread_count=0, unreadCount=0))
        # Ancillary calls are safely unavailable; no invented provider successes.
        STATE.event('ancillary_unavailable', method=method, path=path)
        if method != 'GET':
            self.body()
        return self.respond(dict(error='Not part of the synthetic task fixture'), 404)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=18081)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    if args.port == 8000 or not 1024 <= args.port <= 65535:
        parser.error('Use an unoccupied high loopback port; existing port8000 is reserved')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Synthetic task UI fixture listening on 127.0.0.1:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if args.report:
            args.report.write_text(json.dumps(STATE.snapshot(), indent=2)+'\n')


if __name__ == '__main__':
    main()
