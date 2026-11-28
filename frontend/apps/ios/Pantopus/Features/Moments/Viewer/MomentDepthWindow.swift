//
//  MomentDepthWindow.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 4, depth windows (DESIGN rows "3D depth windows, text and notes at depth"; PHASE-4 piece 8;
//  LEAD-5's terms, 182nd pass): tilting the phone looks a little around a photo Moment. The photo sits at the back, its
//  subject (lifted on the phone by Vision, as the Studio's cutouts lift it) a little in front, and the author's stamps,
//  items and dots in front of that, so words and notes float at their own depth.
//
//  Only what the phone already has: the photo, the subject lift and the author's layers. No model is downloaded, nothing
//  is asked of the server, and the picture is never changed: the layers only move a few points over it. The tilt needs
//  no permission (Core Motion's device motion). With the switch off none of this is built and the motion sensor is
//  not read; with Reduce Motion or Low Power Mode on, the photo stays flat. It measures its own frames: when they come
//  too slowly it goes flat for the rest of the run. A simulator can't tilt, so a small drag pad stands in for it there.
//

import CoreMotion
import OSLog
import QuartzCore
import SwiftUI
import UIKit

/// How far each plane moves at full tilt, in points: the back one away from the tilt, the others toward it.
private enum MomentDepthPlane {
    static let photo: CGFloat = -5
    static let subject: CGFloat = 3
    static let layers: CGFloat = 10
    /// The photo is drawn this much bigger, so its edges never show when it moves.
    static let photoScale: CGFloat = 1.025
}

/// The phone's tilt for depth windows, shared by every photo on screen (one sensor, started while one shows).
@Observable
@MainActor
final class MomentDepthTilt {
    static let shared = MomentDepthTilt()

    /// Left and right, and front and back, each -1 to 1 from how the phone was held when the photo appeared.
    private(set) var x: CGFloat = 0
    private(set) var y: CGFloat = 0
    /// Frames came too slowly: depth stays flat for the rest of this run.
    private(set) var tooSlow = false

    @ObservationIgnored private let manager = CMMotionManager()
    @ObservationIgnored private var showing = 0
    @ObservationIgnored private var resting: (sideways: Double, forward: Double)?
    @ObservationIgnored private var meter: MomentDepthMeter?

    /// Degrees of tilt that move the planes all the way.
    private static let fullTilt = 18.0

    /// A photo with depth came on screen.
    func begin() {
        guard !tooSlow else { return }
        showing += 1
        guard showing == 1 else { return }
        resting = nil
        startMotion()
        meter = MomentDepthMeter { [weak self] report in self?.measured(report) }
    }

    /// It left the screen.
    func end() {
        guard showing > 0 else { return }
        showing -= 1
        guard showing == 0 else { return }
        stopAll()
        x = 0
        y = 0
    }

    /// Simulator builds only: the drag pad's place, each -1 to 1.
    func standIn(x newX: CGFloat, y newY: CGFloat) {
        x = max(-1, min(1, newX))
        y = max(-1, min(1, newY))
    }

    private func startMotion() {
        guard manager.isDeviceMotionAvailable, !manager.isDeviceMotionActive else { return }
        manager.deviceMotionUpdateInterval = 1.0 / 60
        manager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let gravity = motion?.gravity else { return }
            let sideways = atan2(gravity.x, -gravity.z) * 180 / .pi
            let forward = atan2(-gravity.y, -gravity.z) * 180 / .pi
            MainActor.assumeIsolated { self?.tilted(sideways: sideways, forward: forward) }
        }
    }

    private func tilted(sideways: Double, forward: Double) {
        guard let resting else {
            resting = (sideways, forward)
            return
        }
        let wantX = CGFloat(max(-1, min(1, (sideways - resting.sideways) / Self.fullTilt)))
        let wantY = CGFloat(max(-1, min(1, (forward - resting.forward) / Self.fullTilt)))
        // A little smoothing, so the hand's shake doesn't show.
        x += (wantX - x) * 0.25
        y += (wantY - y) * 0.25
    }

    private func measured(_ report: MomentDepthMeter.Report) {
        let late = Int(report.lateShare * 100)
        let mean = report.meanMs
        let slowest = report.p95Ms
        MomentDepthMeter.log.info("depth frames: \(report.frames) in \(report.seconds) s, mean \(mean) ms")
        MomentDepthMeter.log
            .info("depth frames: slowest 5% \(slowest) ms, late \(late)%, screen frame \(report.expectedMs) ms, warm-up \(report.warmUp)")
        guard report.tooSlow else { return }
        MomentDepthMeter.log.info("depth windows: too slow here, flat for the rest of this run")
        tooSlow = true
        stopAll()
        x = 0
        y = 0
    }

    private func stopAll() {
        manager.stopDeviceMotionUpdates()
        meter?.stop()
        meter = nil
    }
}

/// Times the screen's frames while depth shows, and says every second and a half how they came.
@MainActor
final class MomentDepthMeter: NSObject {
    struct Report {
        let frames: Int
        let seconds: Double
        let meanMs: Double
        let p95Ms: Double
        /// The share of frames that came more than half a frame late.
        let lateShare: Double
        /// The screen's own frame (16.7 ms at 60 Hz, 8.3 at 120).
        let expectedMs: Double
        /// The first report also holds the viewer opening and the subject being lifted: it is told, never judged.
        let warmUp: Bool

        /// Under about three quarters of the screen's own frame rate on average, or a quarter of the frames late.
        var tooSlow: Bool {
            !warmUp && frames >= 30 && (meanMs > expectedMs * 1.35 || lateShare > 0.25)
        }
    }

    nonisolated static let log = Logger(subsystem: "com.pantopus.app", category: "depthWindows")

    private var link: CADisplayLink?
    private var last: CFTimeInterval?
    private var gaps: [Double] = []
    private var expected: Double = 1.0 / 60
    private var reports = 0
    private let onReport: (Report) -> Void

    init(onReport: @escaping (Report) -> Void) {
        self.onReport = onReport
        super.init()
        let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        link.add(to: .main, forMode: .common)
        self.link = link
    }

    func stop() {
        link?.invalidate()
        link = nil
    }

    @objc private func tick(_ link: CADisplayLink) {
        let now = link.timestamp
        let frame = link.targetTimestamp - link.timestamp
        if frame > 0 { expected = frame }
        defer { last = now }
        guard let last else { return }
        gaps.append(now - last)
        guard gaps.reduce(0, +) >= 1.5 else { return }
        let sorted = gaps.sorted()
        let report = Report(
            frames: gaps.count,
            seconds: gaps.reduce(0, +),
            meanMs: gaps.reduce(0, +) / Double(gaps.count) * 1000,
            p95Ms: sorted[min(sorted.count - 1, Int(Double(sorted.count) * 0.95))] * 1000,
            lateShare: Double(gaps.filter { $0 > expected * 1.5 }.count) / Double(gaps.count),
            expectedMs: expected * 1000,
            warmUp: reports == 0
        )
        reports += 1
        gaps.removeAll()
        onReport(report)
    }
}

/// The subject lifted from a photo for its depth, kept for the few photos around the one showing.
@MainActor
final class MomentDepthSubjects {
    static let shared = MomentDepthSubjects()
    private var lifted: [String: UIImage] = [:]
    private var order: [String] = []
    private var lifting: Set<String> = []

    func subject(for id: String) -> UIImage? {
        lifted[id]
    }

    /// Lifts the subject once per Moment, off the main thread; nothing when Vision finds none.
    func lift(_ image: UIImage, id: String) async -> UIImage? {
        if let held = lifted[id] { return held }
        guard !lifting.contains(id) else { return nil }
        lifting.insert(id)
        defer { lifting.remove(id) }
        guard let subject = await MomentsSubject.lift(image, placement: nil, backdrop: nil)?.image else { return nil }
        lifted[id] = subject
        order.append(id)
        if order.count > 3 { lifted[order.removeFirst()] = nil }
        return subject
    }
}

/// Whether a photo shows with depth for this reader now: the switch on, Reduce Motion and Low Power Mode off, and fast
/// enough so far.
enum MomentDepth {
    @MainActor
    static func shows(reduceMotion: Bool) -> Bool {
        PulseReinventedFlags.shared.isOn && !reduceMotion && !ProcessInfo.processInfo.isLowPowerModeEnabled
            && !MomentDepthTilt.shared.tooSlow
    }
}

/// A photo Moment with depth: the photo at the back, its subject in front, the author's layers in front of that.
struct MomentDepthWindow: View {
    let moment: MomentDTO
    let image: UIImage
    private let tilt = MomentDepthTilt.shared
    @State private var subject: UIImage?

    var body: some View {
        Color.clear
            .overlay {
                ZStack {
                    plane(image, by: MomentDepthPlane.photo)
                        .accessibilityLabel("\(moment.author.shortName)'s photo")
                        .accessibilityIdentifier("moments.viewer.photo")
                    if let subject {
                        plane(subject, by: MomentDepthPlane.subject)
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)
                    }
                }
            }
            .clipped()
            .overlay {
                MomentLayersOverlay(moment: moment, picture: image.size)
                    .offset(x: tilt.x * MomentDepthPlane.layers, y: tilt.y * MomentDepthPlane.layers)
            }
        #if targetEnvironment(simulator)
            // Low on the right, clear of where cards and dots open.
            .overlay(alignment: .bottomTrailing) { MomentDepthStandInPad().padding(.trailing, 12).padding(.bottom, 150) }
        #endif
            .onAppear { tilt.begin() }
            .onDisappear { tilt.end() }
            .task(id: moment.id) { subject = await MomentDepthSubjects.shared.lift(image, id: moment.id) }
    }

    private func plane(_ picture: UIImage, by reach: CGFloat) -> some View {
        Image(uiImage: picture)
            .resizable()
            .scaledToFill()
            .scaleEffect(MomentDepthPlane.photoScale)
            .offset(x: tilt.x * reach, y: tilt.y * reach)
    }
}

#if targetEnvironment(simulator)
/// Simulator builds only: a drag inside this pad stands in for tilting the phone. Never in an app built for a phone.
private struct MomentDepthStandInPad: View {
    private let side: CGFloat = 96

    var body: some View {
        RoundedRectangle(cornerRadius: 14)
            .fill(Color.black.opacity(0.35))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.7), lineWidth: 1.5))
            .overlay {
                Text("Tilt\n(simulator)")
                    .font(.system(size: 12, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
            }
            .frame(width: side, height: side)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        MomentDepthTilt.shared.standIn(
                            x: (value.location.x - side / 2) / (side / 2),
                            y: (value.location.y - side / 2) / (side / 2)
                        )
                    }
                    .onEnded { _ in
                        withAnimation(.spring(duration: 0.35)) { MomentDepthTilt.shared.standIn(x: 0, y: 0) }
                    }
            )
            .accessibilityLabel("Tilt stand-in")
            .accessibilityIdentifier("moments.viewer.depth.standIn")
    }
}
#endif
