#!/usr/bin/env python3
"""Reachability check for the Android routes this branch adds.

A route is only reachable if RootTabScreen.kt both *registers* it with a
`composable(...)` and *navigates* to it from production code. Both are written
several ways, which earlier regex-only versions of this check got wrong:

    composable(ChildRoutes.X) { }              single-line positional
    composable(\n    ChildRoutes.X,           multi-line positional
    composable(\n    route = ChildRoutes.X,   named

and a parameterised route is navigated through a builder whose name does not
always match the constant (NOTIFICATIONS_ROUTE -> ChildRoutes.notificationsZone).
Matching a builder to a route by path *prefix* is also wrong — dozens of routes
share a "homes/" stem — so a builder counts only when the string it produces
actually satisfies that route's full pattern.

Usage: android-routes.py <repo-root> <android-source-root>
"""

import pathlib
import re
import subprocess
import sys

root, and_dir = sys.argv[1], sys.argv[2]
nav_file = pathlib.Path(and_dir) / "ui/screens/root/RootTabScreen.kt"
src = nav_file.read_text()

# Only the routes this branch adds, read off the diff against master.
diff = subprocess.run(
    ["git", "diff", "master...HEAD", "--", str(nav_file.relative_to(root))],
    cwd=root, capture_output=True, text=True,
).stdout
routes = sorted({
    m.group(1) for m in re.finditer(r"^\+\s+const val ([A-Z_]+)", diff, re.M)
    if not m.group(1).endswith("_KEY")
})
if not routes:
    print("(no new routes on this branch)")
    sys.exit(0)

# Flatten every composable(...) argument list so multi-line forms match too.
registered = set(re.findall(
    r"ChildRoutes\.([A-Z_]+)",
    " ".join(re.findall(r"composable\s*\(([^{]*?)\)\s*\{", src, re.S)),
))

consts = dict(re.findall(r'const val ([A-Z_]+)\s*=\s*"([^"]*)"', src))
builders = dict(re.findall(
    r"fun ([a-zA-Z0-9_]+)\s*\([^)]*\)\s*:?\s*String\s*=\s*([^\n]+)", src,
))


def route_matcher(pattern):
    """`homes/{homeId}/issues` -> a regex matching `homes/<anything>/issues`."""
    literal = re.escape(pattern)
    # re.escape leaves braces alone on 3.7+, but be explicit either way.
    literal = re.sub(r"\\?\{[^}]*\\?\}", "[^/?&]+", literal)
    return re.compile("^" + literal + "$")


def builder_output(body):
    """`"notifications?context=$context"` -> `notifications?context=X`."""
    literals = re.findall(r'"([^"]*)"', body)
    if not literals:
        return None
    return re.sub(r"\$\{[^}]*\}|\$[A-Za-z0-9_]+", "X", "".join(literals))


def camel(constant):
    """UNBOXING -> unboxing, PACKAGE_GIG -> packageGig."""
    head, *rest = constant.lower().split("_")
    return head + "".join(part.capitalize() for part in rest)


# Two signals, unioned. The naming convention carries most of the file — a
# parameterised route FOO_BAR is navigated through ChildRoutes.fooBar(...) — and
# it is the only one that survives builders with block bodies, string
# concatenation or Uri.encode, which no literal match can evaluate. The literal
# match then catches the exceptions, where the builder is named for the surface
# rather than the constant (NOTIFICATIONS_ROUTE -> notificationsZone).
builder_for = {}
builder_names = set(builders) | set(re.findall(r"fun ([a-zA-Z0-9_]+)\s*\(", src))
for route in set(consts) | set(routes):
    if camel(route) in builder_names:
        builder_for.setdefault(route, set()).add(camel(route))
    if route not in consts:
        continue
    matcher = route_matcher(consts[route])
    for name, body in builders.items():
        produced = builder_output(body)
        if produced and matcher.match(produced):
            builder_for.setdefault(route, set()).add(name)

tree = subprocess.run(
    ["grep", "-rn", "--include=*.kt", "-E", r"ChildRoutes\.", and_dir],
    capture_output=True, text=True,
).stdout.splitlines()

print(f"{'ROUTE':<32} {'COMPOSABLE':<10} {'NAV_SITES':<10} VERDICT")
exit_code = 0
for route in routes:
    registered_count = 1 if route in registered else 0
    names = {route} | builder_for.get(route, set())
    alternation = "|".join(re.escape(n) for n in sorted(names))
    referenced = re.compile(r"ChildRoutes\.(" + alternation + r")\b")
    declaration = re.compile(r"(const val (" + alternation + r")\b|fun (" + alternation + r")\s*\()")
    nav = sum(
        1 for line in tree
        if referenced.search(line)
        and not declaration.search(line)
        and "composable(" not in line
        and "route = ChildRoutes." not in line
    )
    if registered_count and nav:
        verdict = "ok"
    elif not registered_count:
        verdict, exit_code = "NO-COMPOSABLE", 1
    else:
        verdict, exit_code = "NO-NAV-SITE", 1
    print(f"{route:<32} {registered_count:<10} {nav:<10} {verdict}")

sys.exit(exit_code)
