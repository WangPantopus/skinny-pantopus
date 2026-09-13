#!/usr/bin/env python3
"""Reject a simulator test host that cannot own protected Keychain records."""

import plistlib
import re
import subprocess
import sys
from pathlib import Path

app = Path(sys.argv[1])
info = plistlib.loads((app / "Info.plist").read_bytes())
if info.get("DTPlatformName") != "iphonesimulator":
    raise SystemExit("Expected a simulator app; device signing is a separate gate")
subprocess.run(["codesign", "--verify", "--deep", "--strict", str(app)], check=True)
executable = app / info["CFBundleExecutable"]
architectures = subprocess.run(
    ["xcrun", "lipo", "-archs", str(executable)],
    check=True, capture_output=True, text=True,
).stdout.split()
if len(architectures) != 1:
    raise SystemExit("Verify the single runner architecture used by the CI build")
# Xcode embeds simulator entitlements in Mach-O, separately from the macOS
# code-signature entitlements (which can correctly be empty).
load_commands = subprocess.run(
    ["xcrun", "otool", "-l", str(executable)],
    check=True, capture_output=True, text=True,
).stdout
section = re.search(
    r"sectname __entitlements\s+segname __TEXT\s+addr 0x[0-9a-f]+"
    r"\s+size (0x[0-9a-f]+)\s+offset (\d+)",
    load_commands,
)
if section is None:
    raise SystemExit("Simulator host lacks embedded simulator entitlements")
size, offset = int(section[1], 16), int(section[2])
with executable.open("rb") as binary:
    binary.seek(offset)
    entitlements = plistlib.loads(binary.read(size).rstrip(b"\0"))
application_id = entitlements.get("application-identifier", "")
bundle_id = info["CFBundleIdentifier"]
if not application_id or not (
    application_id == bundle_id or application_id.endswith("." + bundle_id)
):
    raise SystemExit("Simulator host lacks its exact application-identifier entitlement")
print("Verified signed simulator host with its own Keychain application identifier")
