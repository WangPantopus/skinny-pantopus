//
//  ClockMinuteSchedule.swift
//  Pantopus
//
//  A timeline that ticks on every minute boundary, counted in seconds. The
//  system `.everyMinute` schedule handed Today a frozen 1:59 AM through the
//  hour the clocks went back on November 1, 2026 (the sun card counted down
//  from it and the sky stood still); plain seconds have no repeated hour.
//

import SwiftUI

struct ClockMinuteSchedule: TimelineSchedule {
    func entries(from startDate: Date, mode: TimelineScheduleMode) -> PeriodicTimelineSchedule.Entries {
        let minute = (startDate.timeIntervalSinceReferenceDate / 60).rounded(.down) * 60
        return PeriodicTimelineSchedule(from: Date(timeIntervalSinceReferenceDate: minute), by: 60)
            .entries(from: startDate, mode: mode)
    }
}

extension TimelineSchedule where Self == ClockMinuteSchedule {
    /// Every minute on the minute, the night the clocks change included.
    static var everyClockMinute: ClockMinuteSchedule {
        ClockMinuteSchedule()
    }
}
