//
//  ChatPerformance.swift
//  Pantopus
//
//  Timing marks on the chat paths people feel: the inbox and a thread
//  showing content, a send reaching the screen and the server, an incoming
//  message reaching the screen, and catching up after a reconnect. Read
//  them in Instruments (os_signpost) or with `log show --signpost`.
//
//  The marks carry no message text, identifiers or account data — only
//  what happened and how many rows were involved — so a device log never
//  reveals a conversation.
//

import os
import QuartzCore

enum ChatPerformance {
    static let signposter = OSSignposter(subsystem: "app.pantopus.ios", category: "ChatPerformance")

    /// A point in time, with how many rows were on hand.
    static func mark(_ name: StaticString, rows: Int) {
        signposter.emitEvent(name, "rows=\(rows)")
    }

    /// Ends an interval, with how many rows it covered.
    static func end(_ name: StaticString, _ interval: OSSignpostIntervalState, rows: Int) {
        signposter.endInterval(name, interval, "rows=\(rows)")
    }
}

/// Notes frames the main thread missed while a thread is on screen: the
/// hitches scrolling and live updates can cause. Debug builds only; in
/// other builds starting it does nothing.
@MainActor
final class ChatFrameGapMonitor: NSObject {
    private var link: CADisplayLink?
    private var lastTimestamp: CFTimeInterval = 0

    func start() {
        #if DEBUG
        guard link == nil else { return }
        lastTimestamp = 0
        let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        link.add(to: .main, forMode: .common)
        self.link = link
        #endif
    }

    func stop() {
        link?.invalidate()
        link = nil
    }

    @objc private func tick(_ link: CADisplayLink) {
        defer { lastTimestamp = link.timestamp }
        guard lastTimestamp > 0 else { return }
        let frame = link.targetTimestamp - link.timestamp
        let gap = link.timestamp - lastTimestamp
        guard frame > 0, gap > frame * 1.5 else { return }
        let gapMs = Int((gap * 1000).rounded())
        let frameMs = Int((frame * 1000).rounded())
        ChatPerformance.signposter.emitEvent("FrameGap", "ms=\(gapMs) frameMs=\(frameMs)")
    }
}
