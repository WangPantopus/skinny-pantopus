#!/bin/zsh
# One heavy native build (xcodebuild / gradle assemble|install / simulator app install from a fresh build) at a time
# across all Pantopus streams on this Mac.
#   heavy-slot.sh acquire "<stream>: <purpose>"   -> waits (checks every 30 s) until the lock is free, then takes it
#   heavy-slot.sh release                        -> releases (only release a lock you acquired)
#   heavy-slot.sh status                         -> prints the holder, if any
L=/private/tmp/pantopus-heavy-slot.lock
# Back-pressure: no new heavy build while the kernel reports critical memory pressure, or warning pressure with a
# 1-minute load above 150 (the Mac thrashed at load 450 with swap full on 2026-09-23).
pressure_ok(){ local lvl load; lvl=$(sysctl -n kern.memorystatus_vm_pressure_level 2>/dev/null || echo 1); load=$(sysctl -n vm.loadavg | awk '{print int($2)}'); [ "$lvl" -ge 4 ] && return 1; [ "$lvl" -ge 2 ] && [ "$load" -gt 150 ] && return 1; return 0; }
case "$1" in
  acquire) while true; do
             if ! pressure_ok; then echo "system under memory pressure (level $(sysctl -n kern.memorystatus_vm_pressure_level), load $(sysctl -n vm.loadavg | awk '{print $2}')), waiting"
             elif mkdir "$L" 2>/dev/null; then break
             else echo "heavy slot busy: $(cat $L/owner 2>/dev/null)"; fi
             sleep 30
           done
           echo "$2 | since $(date -u +%FT%TZ) | pid $$" > "$L/owner"; echo "acquired: $(cat $L/owner)";;
  release) rm -rf "$L"; echo "released";;
  status)  [ -d "$L" ] && echo "held: $(cat $L/owner 2>/dev/null)" || echo "free";;
  *) echo "usage: heavy-slot.sh acquire '<stream>: <purpose>' | release | status"; exit 2;;
esac
