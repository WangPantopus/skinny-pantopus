//
//  CardTableMotion.swift
//  Pantopus
//
//  The phone's real tilt for the table's light (launch key `card_table`): left
//  and right, and front and back from about 45 degrees held. It needs no
//  permission, and runs only while the screen is showing, never in Low Power
//  Mode or with Reduce Motion.
//

import CoreMotion
import Foundation

@MainActor
final class CardTableMotion {
    private let manager = CMMotionManager()

    /// Whether this phone can tell its tilt (a simulator can't).
    var isAvailable: Bool {
        manager.isDeviceMotionAvailable
    }

    var isRunning: Bool {
        manager.isDeviceMotionActive
    }

    /// Calls `onTilt` with the phone's left-right and front-back tilt, in degrees.
    func start(onTilt: @escaping @MainActor (_ sideways: Double, _ forward: Double) -> Void) {
        guard manager.isDeviceMotionAvailable, !manager.isDeviceMotionActive else { return }
        manager.deviceMotionUpdateInterval = 1.0 / 60
        manager.startDeviceMotionUpdates(to: .main) { motion, _ in
            guard let gravity = motion?.gravity else { return }
            let sideways = atan2(gravity.x, -gravity.z) * 180 / .pi
            let forward = atan2(-gravity.y, -gravity.z) * 180 / .pi
            MainActor.assumeIsolated { onTilt(sideways, forward) }
        }
    }

    func stop() {
        manager.stopDeviceMotionUpdates()
    }
}
