#!/bin/zsh
# At most 4 booted Pantopus test devices (emulators/simulators) at a time across all streams on this Mac,
# NOT counting the founder's live simulator EB5AD759 (never boot, stop, or touch it).
# Also refuses to hand out a slot while system memory is low (memory_pressure free% < 20).
#   device-slot.sh acquire "<stream>: <device>"  -> waits (every 30 s) for a free slot and enough memory, then takes it
#   device-slot.sh release "<stream>"            -> releases the slot(s) held by that stream label (after you shut the device down)
#   device-slot.sh status                        -> prints holders and memory
B=/private/tmp/pantopus-device-slot
pressure_ok(){ local lvl load; lvl=$(sysctl -n kern.memorystatus_vm_pressure_level 2>/dev/null || echo 1); load=$(sysctl -n vm.loadavg | awk '{print int($2)}'); [ "$lvl" -ge 4 ] && return 1; [ "$lvl" -ge 2 ] && [ "$load" -gt 150 ] && return 1; return 0; }
mem(){ memory_pressure 2>/dev/null | awk -F': ' '/free percentage/{gsub("%","",$2); print $2+0}'; }
case "$1" in
  acquire)
    while true; do
      f=$(mem); f=${f:-0}
      if ! pressure_ok; then echo "system under memory pressure (level $(sysctl -n kern.memorystatus_vm_pressure_level), load $(sysctl -n vm.loadavg | awk '{print $2}')), waiting"
      elif [ "$f" -ge 20 ]; then
        for i in 1 2 3 4; do
          if mkdir "$B.$i" 2>/dev/null; then echo "$2 | since $(date -u +%FT%TZ)" > "$B.$i/owner"; echo "acquired slot $i: $(cat $B.$i/owner) (memory free ${f}%)"; exit 0; fi
        done
        echo "device slots busy: $(cat $B.*/owner 2>/dev/null | tr '\n' ';')"
      else echo "memory free ${f}% < 20%, waiting"; fi
      sleep 30
    done;;
  release)
    n=0; for d in $B.*(N); do grep -q "^$2" "$d/owner" 2>/dev/null && { rm -rf "$d"; n=$((n+1)); }; done; echo "released $n slot(s) for '$2'";;
  status)
    for i in 1 2 3 4; do [ -d "$B.$i" ] && echo "slot $i: $(cat $B.$i/owner)" || echo "slot $i: free"; done; echo "memory free $(mem)%";;
  *) echo "usage: device-slot.sh acquire '<stream>: <device>' | release '<stream>' | status"; exit 2;;
esac
