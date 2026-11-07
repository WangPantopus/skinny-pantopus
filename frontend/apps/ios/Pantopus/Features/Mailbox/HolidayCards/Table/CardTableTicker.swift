//
//  CardTableTicker.swift
//  Pantopus
//
//  The table's clock and the taps you can feel (launch key `card_table`).
//

import QuartzCore
import UIKit

/// Runs the springs once per screen refresh, and only while something's moving.
@MainActor
final class CardTableTicker: NSObject {
    var onTick: ((CFTimeInterval) -> Void)?
    private var link: CADisplayLink?

    var isRunning: Bool {
        link != nil
    }

    func start() {
        guard link == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(fire))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
        link.add(to: .main, forMode: .common)
        self.link = link
    }

    func stop() {
        link?.invalidate()
        link = nil
    }

    @objc private func fire(_ link: CADisplayLink) {
        onTick?(link.targetTimestamp)
    }
}

/// The taps you can feel.
@MainActor
final class CardTableHaptics {
    enum Tap {
        case soft, light, medium, firm, refuse
    }

    private let soft = UIImpactFeedbackGenerator(style: .soft)
    private let light = UIImpactFeedbackGenerator(style: .light)
    private let medium = UIImpactFeedbackGenerator(style: .medium)
    private let rigid = UIImpactFeedbackGenerator(style: .rigid)
    private let heavy = UIImpactFeedbackGenerator(style: .heavy)

    func tap(_ tap: Tap) {
        switch tap {
        case .soft: soft.impactOccurred(intensity: 0.5)
        case .light: light.impactOccurred()
        case .medium: medium.impactOccurred()
        case .firm: rigid.impactOccurred()
        case .refuse: heavy.impactOccurred(intensity: 0.8)
        }
    }
}
