//
//  BallotStory.swift
//  Pantopus
//
//  The peel story's timing (Board: The peel). Each government gets 1.2 s:
//  in by 0.18 s (ease-out), held to 1.02 s, out by 1.2 s, which is the
//  board's 12 s cycle at 1.5%, 8.5% and 10% per step. The finished frame
//  follows the last government and holds (the board loops only as a
//  prototype); the progress bar runs the whole story. Shared in shape
//  with the web keyframes and Android `BallotStory`.
//

import SwiftUI

struct BallotStory: Equatable {
    static let step: Double = 1.2
    static let fade: Double = 0.18
    static let holdEnd: Double = 1.02

    /// Governments in the story; the finished frame is step `steps`.
    let steps: Int

    /// The whole story, finished frame included.
    var duration: Double {
        Double(steps + 1) * Self.step
    }

    /// 0…1: how present step `k` is at `t` — its caption's and highlight's
    /// opacity, and the fraction of its layer's lift.
    func presence(_ k: Int, at t: Double) -> Double {
        let u = t - Double(k) * Self.step
        guard u > 0 else { return 0 }
        if u < Self.fade { return Self.ease(u / Self.fade) }
        if k == steps || u <= Self.holdEnd { return 1 }
        if u < Self.step { return 1 - Self.ease((u - Self.holdEnd) / Self.fade) }
        return 0
    }

    /// A caption rises from 8 below while arriving and leaves 4 above.
    func captionOffset(_ k: Int, at t: Double) -> CGFloat {
        let u = t - Double(k) * Self.step
        let rest = 1 - presence(k, at: t)
        if u < Self.fade { return 8 * rest }
        if k != steps, u > Self.holdEnd { return -4 * rest }
        return 0
    }

    /// A government's layer lifts 8 while it is being told.
    func lift(_ k: Int, at t: Double) -> CGFloat {
        k < steps ? -8 * presence(k, at: t) : 0
    }

    /// The progress bar, 0…1.
    func bar(at t: Double) -> Double {
        min(max(t / duration, 0), 1)
    }

    /// CSS `ease-out`, the board's timing function.
    static func ease(_ x: Double) -> Double {
        UnitCurve.easeOut.value(at: min(max(x, 0), 1))
    }
}
