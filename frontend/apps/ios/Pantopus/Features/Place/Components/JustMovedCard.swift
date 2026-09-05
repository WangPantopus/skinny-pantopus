//
//  JustMovedCard.swift
//  Pantopus
//
//  Just moved — the first week at this address (Wedge v2 D5, movers first).
//  For ~60 days after the move-in date this card leads the dashboard: five
//  things the address can do now, each a row into a surface that already
//  exists, each with a check the person ticks off. "Set your pickup day"
//  ticks itself once the calendar runs on the household's own day. At five
//  of five the card retires into one line; "Not new here" dismisses it.
//  Only the ticks and the dismissal are stored, in UserDefaults. Parity
//  twin of the web `JustMovedCard`.
//

import SwiftUI

enum JustMovedStepId: String, CaseIterable {
    case pickup, mail, money, civic, block
}

/// True when the move-in date is within the last 60 days (or up to 14 days ahead).
func isRecentMove(_ moveInDate: String?, now: Date = Date()) -> Bool {
    guard let moveInDate, moveInDate.count >= 10 else { return false }
    // Server dates are ISO and Gregorian whatever the device region says.
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.timeZone = .current
    guard let day = formatter.date(from: String(moveInDate.prefix(10))) else { return false }
    // Whole calendar days, day 60 inclusive: the same window as web and Android.
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .current
    let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: day), to: calendar.startOfDay(for: now)).day ?? 0
    return days >= -14 && days <= 60
}

/// Local, per-home memory of the ticks and the dismissal.
struct JustMovedStore {
    let homeId: String
    var defaults: UserDefaults = .standard

    private var dismissKey: String {
        "just_moved.dismissed.\(homeId)"
    }

    private var doneKey: String {
        "just_moved.done.\(homeId)"
    }

    var isDismissed: Bool {
        defaults.bool(forKey: dismissKey)
    }

    func dismiss() {
        defaults.set(true, forKey: dismissKey)
    }

    var done: Set<JustMovedStepId> {
        Set((defaults.stringArray(forKey: doneKey) ?? []).compactMap(JustMovedStepId.init(rawValue:)))
    }

    func setDone(_ done: Set<JustMovedStepId>) {
        defaults.set(done.map(\.rawValue).sorted(), forKey: doneKey)
    }
}

struct JustMovedCard: View {
    let homeId: String
    let moveInDate: String?
    /// From the address calendar: false once the household has set its own pickup day.
    var needsPickupDay: Bool?
    let onOpenDetail: (PlaceDetailGroup) -> Void
    let onOpenMailDay: () -> Void

    @State private var dismissed = false
    @State private var done: Set<JustMovedStepId> = []
    @State private var loaded = false

    private struct Step {
        let id: JustMovedStepId
        let icon: PantopusIcon
        let label: String
        let payoff: String
        let target: PlaceDetailGroup?
    }

    private static let steps: [Step] = [
        Step(id: .pickup, icon: .trash2, label: "Set your pickup day", payoff: "Reminders the night before, every week", target: .today),
        Step(
            id: .mail,
            icon: .mailbox,
            label: "Send back the previous resident's mail",
            payoff: "One tap returns it; yours gets filed",
            target: nil
        ),
        Step(
            id: .money,
            icon: .zap,
            label: "Utilities, rebates, and rates",
            payoff: "What this address qualifies for, and when taxes are due",
            target: .money
        ),
        Step(
            id: .civic,
            icon: .landmark,
            label: "Who represents you, and the schools",
            payoff: "Your districts, the next election, the council calendar",
            target: .civic
        ),
        Step(
            id: .block,
            icon: .users,
            label: "Meet the block",
            payoff: "Who is verified nearby, and the Founding Neighbor slots",
            target: .block
        )
    ]

    private var store: JustMovedStore {
        JustMovedStore(homeId: homeId)
    }

    private func isDone(_ id: JustMovedStepId) -> Bool {
        (id == .pickup && needsPickupDay == false) || done.contains(id)
    }

    private var doneCount: Int {
        Self.steps.filter { isDone($0.id) }.count
    }

    var body: some View {
        Group {
            if loaded, !dismissed, isRecentMove(moveInDate) {
                if doneCount == Self.steps.count {
                    retired
                } else {
                    card
                }
            }
        }
        .onAppear {
            guard !loaded else { return }
            dismissed = store.isDismissed
            done = store.done
            loaded = true
        }
    }

    private func dismiss() {
        store.dismiss()
        dismissed = true
    }

    /// Five of five: the card retires into one line rather than vanishing.
    private var retired: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Theme.Color.home)
                Icon(.check, size: 16, strokeWidth: 2.75, color: .white)
            }
            .frame(width: 32, height: 32)
            Text("First week done. The block is yours.")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button("Hide", action: dismiss)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Theme.Color.homeBg)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityIdentifier("place.justMoved.done")
    }

    private var card: some View {
        VStack(spacing: 0) {
            header
            VStack(spacing: 0) {
                ForEach(Array(Self.steps.enumerated()), id: \.element.id) { index, step in
                    if index > 0 {
                        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                    }
                    row(step)
                }
            }
            .padding(.horizontal, 8)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            HStack {
                Text("Shows for your first two months here.")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextMuted)
                Spacer()
                Button("Not new here", action: dismiss)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("place.justMoved.dismiss")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .shadow(color: .black.opacity(0.04), radius: 2, y: 1)
        .accessibilityIdentifier("place.justMoved")
    }

    /// Header band in the home tint: this is the card the eye lands on.
    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Theme.Color.home)
                    Icon(.truck, size: 22, strokeWidth: 2, color: .white)
                }
                .frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Your first week at this address")
                        .font(.system(size: 18, weight: .bold))
                        .kerning(-0.27)
                        .foregroundStyle(Theme.Color.appText)
                    Text("Five things it can do for you now, before there are neighbors to meet.")
                        .font(.system(size: 13.5))
                        .lineSpacing(3)
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            HStack(spacing: 12) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.Color.appText.opacity(0.15))
                        Capsule().fill(Theme.Color.home)
                            .frame(width: geo.size.width * CGFloat(doneCount) / CGFloat(Self.steps.count))
                    }
                }
                .frame(height: 6)
                Text("\(doneCount) of \(Self.steps.count) done")
                    .font(.system(size: 12.5, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .accessibilityIdentifier("place.justMoved.progress")
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 14)
        .background(Theme.Color.homeBg)
    }

    private func row(_ step: Step) -> some View {
        let checked = isDone(step.id)
        let auto = step.id == .pickup && needsPickupDay == false
        return HStack(spacing: 4) {
            Button {
                if done.contains(step.id) { done.remove(step.id) } else { done.insert(step.id) }
                store.setDone(done)
            } label: {
                ZStack {
                    Circle().fill(checked ? Theme.Color.home : Theme.Color.appSurface)
                    Circle().strokeBorder(checked ? Theme.Color.home : Theme.Color.appBorder, lineWidth: 2)
                    if checked {
                        Icon(.check, size: 14, strokeWidth: 3, color: .white)
                    }
                }
                .frame(width: 28, height: 28)
                .padding(4)
            }
            .buttonStyle(.plain)
            .disabled(auto)
            .accessibilityLabel(checked ? "\(step.label), done" : step.label)
            .accessibilityAddTraits(.isButton)
            .accessibilityIdentifier("place.justMoved.check.\(step.id.rawValue)")

            Button {
                if let target = step.target { onOpenDetail(target) } else { onOpenMailDay() }
            } label: {
                HStack(spacing: 12) {
                    Icon(step.icon, size: 18, strokeWidth: 2, color: checked ? Theme.Color.appTextMuted : Theme.Color.home)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(step.label)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(checked ? Theme.Color.appTextSecondary : Theme.Color.appText)
                        Text(step.payoff)
                            .font(.system(size: 12.5))
                            .lineSpacing(2)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Icon(.chevronRight, size: 16, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
                }
                .padding(.vertical, 10)
                .padding(.trailing, 4)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }
}
