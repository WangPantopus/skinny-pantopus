//
//  ReinventedReachDial.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 1, the reach dial (PHASE-1 §2 piece 9; board B15), opened from the scope pill: Close
//  circle, Around me (1 to 25 miles) and Explore, each with one line saying what it shows and how it is ordered, and
//  "No hidden ranking" with the page anyone can read that says Explore's rules (the web's `/about/explore`).
//  Phase 3 (CONTRACT 8d): with Close circle chosen the dial stays open and offers the person's circles (only that
//  circle's people who are in), and "Your circles" opens inside the dial's own navigation. The circles are read when
//  Close circle is shown here, never beside what opens the tab.
//

import SwiftUI

/// One of the person's circles picked inside Close circle.
struct ReinventedCirclePick: Equatable {
    let id: String
    let name: String
}

struct ReinventedReachDial: View {
    let reach: String
    let miles: Int
    let circle: ReinventedCirclePick?
    let onPick: (String, Int, ReinventedCirclePick?) -> Void
    @State private var pickedMiles: Double
    @State private var path: [ReinventedCircleRoute] = []
    /// Half height for the choices; the circles' pages open at full height, so a keyboard closing never leaves a form
    /// at half height with taps above it closing the dial.
    @State private var detent: PresentationDetent = .medium
    /// A Moment or post a magazine opened: opened once the dial has gone.
    @State private var opening: String?
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    private let circles = ReinventedCirclesModel.shared

    init(reach: String, miles: Int, circle: ReinventedCirclePick?, onPick: @escaping (String, Int, ReinventedCirclePick?) -> Void) {
        self.reach = reach
        self.miles = miles
        self.circle = circle
        self.onPick = onPick
        _pickedMiles = State(initialValue: Double(miles))
    }

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView { choices }
                .navigationDestination(for: ReinventedCircleRoute.self) { route in destination(route) }
                .toolbar(.hidden, for: .navigationBar)
        }
        .presentationDetents([.medium, .large], selection: $detent)
        .onChange(of: path) { _, pages in if !pages.isEmpty { detent = .large } }
        .task(id: reach == "close") { if reach == "close" { await circles.read() } }
        .onDisappear {
            if let opening { DeepLinkRouter.shared.handle(path: opening) }
        }
    }

    private var choices: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("What Pulse shows")
                .pulseFont(20, weight: .bold)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            option(
                "close",
                title: "Close circle",
                icon: .users,
                line: circle.map { "Only \($0.name). Newest first." } ?? "The people you're connected with. Newest first."
            )
            if reach == "close" { circleChoices }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                option(
                    "around",
                    title: "Around me",
                    icon: .mapPin,
                    line: "Within \(Int(pickedMiles)) \(Int(pickedMiles) == 1 ? "mile" : "miles") of you. Nearest first."
                )
                Slider(value: $pickedMiles, in: 1...25, step: 1) { editing in
                    if !editing { pick("around") }
                }
                .tint(Theme.Color.primarySolid)
                .padding(.horizontal, Spacing.s2)
                .accessibilityLabel("Miles around you")
                .accessibilityValue("\(Int(pickedMiles)) miles")
                .accessibilityIdentifier("reinventedPulse.dial.miles")
            }
            option(
                "explore",
                title: "Explore",
                icon: .globe,
                line: "Anywhere else, only what its author chose to show. Ten picked by people today, then the newest."
            )
            HStack(spacing: Spacing.s2) {
                Text("No hidden ranking.")
                    .pulseFont(14, weight: .semibold)
                    .foregroundStyle(Theme.Color.appText)
                Button("See the rules") {
                    if let url = Self.rulesURL { openURL(url) }
                }
                .pulseFont(14, weight: .semibold)
                .accessibilityIdentifier("reinventedPulse.dial.rules")
            }
            .padding(.top, Spacing.s2)
            Spacer(minLength: 0)
        }
        .padding(Spacing.s5)
        .accessibilityIdentifier("reinventedPulse.dial")
    }

    /// A pick closes the dial, but Close circle stays open so one of the person's circles can be chosen (or made).
    private func pick(_ key: String, circle chosen: ReinventedCirclePick? = nil) {
        onPick(key, Int(pickedMiles), key == "close" ? chosen : nil)
        if key != "close" || chosen != nil { dismiss() }
    }

    /// "All your connections", each circle, and "Your circles" (with how many invites and magazines are new).
    private var circleChoices: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if !circles.circles.isEmpty {
                circleRow("All your connections", on: circle == nil) {
                    onPick("close", Int(pickedMiles), nil)
                    dismiss()
                }
                ForEach(circles.circles) { item in
                    circleRow(item.name, on: circle?.id == item.id) {
                        pick("close", circle: ReinventedCirclePick(id: item.id, name: item.name))
                    }
                }
            }
            Button { path.append(.circles) } label: {
                HStack(spacing: Spacing.s2) {
                    Text(circles.circles.isEmpty ? "Make a circle of 2 to 8 close people" : "Your circles")
                        .pulseFont(14.5, weight: .semibold)
                        .foregroundStyle(Theme.Color.primaryTint)
                    if circles.news > 0 {
                        Text("\(circles.news) new")
                            .pulseFont(12, weight: .bold)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Capsule().fill(Theme.Color.primarySolid))
                    }
                    Spacer(minLength: 0)
                    Icon(.chevronRight, size: 16, color: Theme.Color.primaryTint)
                }
                .frame(minHeight: 40)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("reinventedPulse.dial.circles")
        }
        .padding(.leading, 52)
    }

    private func circleRow(_ title: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(
                    on ? .checkCircle : .circle,
                    size: 18,
                    strokeWidth: 2,
                    color: on ? Theme.Color.primarySolid : Theme.Color.appTextSecondary
                )
                Text(title)
                    .pulseFont(15)
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: 0)
            }
            .frame(minHeight: 36)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("reinventedPulse.dial.circle")
    }

    @ViewBuilder
    private func destination(_ route: ReinventedCircleRoute) -> some View {
        switch route {
        case .circles: ReinventedCirclesView(path: $path)
        case .new: ReinventedNewCircleView(path: $path)
        case let .circle(id): ReinventedCircleDetail(circleId: id, path: $path)
        case let .magazine(id):
            ReinventedMagazineView(circleId: id) { link in
                opening = link
                dismiss()
            }
        }
    }

    private func option(_ key: String, title: String, icon: PantopusIcon, line: String) -> some View {
        let on = reach == key
        return Button { pick(key) } label: {
            HStack(alignment: .top, spacing: Spacing.s3) {
                Icon(icon, size: 20, strokeWidth: 2.2, color: on ? .white : Theme.Color.primaryTint)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(on ? Theme.Color.primarySolid : Theme.Color.appSurfaceRaised))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .pulseFont(16, weight: .bold)
                        .foregroundStyle(Theme.Color.appText)
                    Text(line)
                        .pulseFont(13.5)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                if on { Icon(.check, size: 18, strokeWidth: 2.4, color: Theme.Color.primaryTint) }
            }
            .padding(Spacing.s3)
            .background(RoundedRectangle(cornerRadius: Radii.lg).fill(on ? Theme.Color.primary50 : Theme.Color.appSurface))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg).stroke(Theme.Color.appBorder, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("reinventedPulse.dial.\(key)")
    }

    /// The rules page on this build's website (`PantopusPublicWebURL`), else production.
    static var rulesURL: URL? {
        let configured = (Bundle.main.object(forInfoDictionaryKey: "PantopusPublicWebURL") as? String).flatMap(URL.init(string:))
        let origin = configured.flatMap { ["http", "https"].contains($0.scheme ?? "") && $0.host != nil ? $0 : nil }
            ?? URL(string: "https://pantopus.com")
        return origin?.appendingPathComponent("about/explore")
    }
}
