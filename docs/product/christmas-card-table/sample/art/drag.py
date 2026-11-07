#!/opt/homebrew/Cellar/idb-cli/1.6.4/libexec/bin/python
"""One finger on a simulator through idb's HID stream (SIM_UDID in the environment).
usage: drag.py x1 y1 x2 y2 [--hold S] [--duration S] [--steps N] [--rest S] | drag.py tap x y"""
import asyncio, logging, sys
from idb.common.types import HIDDelay, HIDDirection, HIDPress, HIDTouch, Point
from idb.grpc.management import ClientManager
import os
UDID = os.environ['SIM_UDID']
a = sys.argv[1:]
def opt(n, d):
    return float(a[a.index(n) + 1]) if n in a else d
tap = a[0] == 'tap'
if tap:
    x1, y1 = float(a[1]), float(a[2]); x2, y2 = x1, y1
else:
    x1, y1, x2, y2 = map(float, a[:4])
hold, duration, steps = opt('--hold', 0.0), opt('--duration', 0.35), int(opt('--steps', 18))
def down(x, y):
    return HIDPress(action=HIDTouch(point=Point(x=x, y=y)), direction=HIDDirection.DOWN)
def up(x, y):
    return HIDPress(action=HIDTouch(point=Point(x=x, y=y)), direction=HIDDirection.UP)
async def events():
    yield down(x1, y1)
    if tap:
        yield HIDDelay(duration=0.06)
    else:
        if hold:
            yield HIDDelay(duration=hold)
        for i in range(1, steps + 1):
            t = i / steps
            yield HIDDelay(duration=duration / steps)
            yield down(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)
        if opt('--rest', 0.0):
            yield HIDDelay(duration=opt('--rest', 0.0))
    yield up(x2, y2)
async def main():
    logger = logging.getLogger('drag'); logger.setLevel(logging.ERROR)
    async with ClientManager(logger=logger).from_udid(udid=UDID) as client:
        await client.hid(events())
asyncio.run(main())
