//
//  PlanAskSheet.swift
//  Pantopus
//
//  Boards J3 "Ask to join" and J4 "Ask to join a playdate": who's coming
//  (or the kids and their ages, with "I'll stay with my kids the whole
//  time"), an optional hello with quick phrases, what the host will see,
//  and "Send request".
//

import SwiftUI

struct PlanAskSheet: View {
    let card: PlanCardDTO
    /// The request being changed (J5 "Change who's coming").
    let previous: PlanAskPrefill?
    let onSend: (AskToJoinBody) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var partySize = 1
    @State private var note = ""
    @State private var kidsCount = 1
    @State private var ages: Set<PlanKidsAgeBand> = []
    @State private var staysWithKids = false
    @State private var isSending = false
    @State private var failed: String?
    @FocusState private var noteFocused: Bool
    /// The content's height, so the sheet opens just tall enough (J3, J4).
    @State private var contentHeight: CGFloat = 0

    private static let noteLimit = 280

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                header
                if card.kind == .playdate { kids } else { whoIsComing }
                hello
                PlanScopeLine(text: scopeSentence)
                if let failed {
                    Text(failed)
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.error)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("planAskError")
                }
                Button(action: send) {
                    PlanButtonLabel(title: sendTitle, kind: .primary, isLoading: isSending)
                }
                .planButton(.primary)
                .disabled(!canSend || isSending)
                .accessibilityIdentifier("planAskSend")
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s5)
            .padding(.bottom, Spacing.s6)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
        }
        .scrollDismissesKeyboard(.interactively)
        // Just tall enough for everything, Send request included; taller than
        // the screen (large text) opens fully and scrolls.
        .presentationDetents(contentHeight > 0 ? [.height(contentHeight), .large] : [.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(26)
        // Opaque, as the boards draw the modal: the plan behind must not show through.
        .presentationBackground(Theme.Color.appSurface)
        .onAppear(perform: prefill)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planAskSheet")
    }

    private var hostFirst: String {
        PlanCardLines.firstName(card.host.displayName)
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Ask \(hostFirst) to join")
                    .planFont(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text(subtitle)
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
            Button { dismiss() } label: {
                Icon(.x, size: 16, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Theme.Color.appSurfaceSunken))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
    }

    /// "Seahawks game · Sun 1:25 PM", or the part of the day for a playdate.
    private var subtitle: String {
        let short = card.details?.game.map { "\($0.label) game" } ?? card.title
        let calendar = PlanFormat.calendar(for: card.timezone)
        guard let start = card.startsAtDate else {
            return "\(short) · \(PlanFormat.dayPartPhrase(card.dayPart, day: card.startsOnDate, calendar: calendar))"
        }
        let time = PlanFormat.rowWhen(state: .upcoming, start: start, end: nil, calendar: calendar) ?? PlanFormat.time(
            start,
            calendar: calendar
        )
        return "\(short) · \(time)"
    }

    // MARK: - J3: who's coming

    private var whoIsComing: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("Who's coming")
            PlanChoiceChips(
                options: (1...4).map { size in
                    PlanChoiceOption(
                        id: size,
                        label: size == 1 ? "Just me" : "Me + \(size - 1)",
                        isEnabled: card.isFull || size <= max(card.spotsLeft, 1)
                    )
                },
                isSelected: { $0 == partySize },
                onTap: { partySize = $0 },
                groupLabel: "Who's coming",
                identifier: "planAskParty"
            )
        }
    }

    // MARK: - J4: kids

    private var kids: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HStack {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Kids coming").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    Text("With you, the whole time").planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                PlanStepper(value: $kidsCount, range: 1...6, label: "Kids coming")
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text.planOverline("Their ages")
                PlanChoiceChips(
                    options: PlanKidsAgeBand.allCases.map { PlanChoiceOption(id: $0, label: PlanComposerOptions.ageLabel($0)) },
                    isSelected: { ages.contains($0) },
                    onTap: { band in
                        if ages.contains(band) { ages.remove(band) } else { ages.insert(band) }
                    },
                    groupLabel: "Their ages",
                    identifier: "planAskAges"
                )
            }
            Button { staysWithKids.toggle() } label: {
                HStack(spacing: Spacing.s3) {
                    PlanCheckbox(isOn: staysWithKids)
                    Text("I'll stay with my kids the whole time")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, Spacing.s3)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.Color.appSurfaceSunken))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("I'll stay with my kids the whole time")
            .accessibilityAddTraits(staysWithKids ? [.isButton, .isSelected] : .isButton)
            .accessibilityIdentifier("planAskStays")
        }
    }

    // MARK: - Hello

    private var hello: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("Say hi · optional")
            TextField("Add a short hello", text: $note, axis: .vertical)
                .planFont(.body)
                .lineLimit(3...6)
                .focused($noteFocused)
                .padding(.horizontal, 14)
                .padding(.vertical, Spacing.s3)
                .frame(minHeight: 78, alignment: .topLeading)
                .background(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).fill(Theme.Color.appSurface))
                .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
                .onChange(of: note) { _, new in
                    if new.count > Self.noteLimit { note = String(new.prefix(Self.noteLimit)) }
                }
                .accessibilityLabel("Say hi, optional")
                .accessibilityIdentifier("planAskNote")
            if card.kind != .playdate {
                PlanChoiceChips(
                    options: ["First time", "Bringing a snack", "Can help set up"].map { PlanChoiceOption(id: $0, label: $0) },
                    isSelected: { note.contains($0) },
                    onTap: append,
                    groupLabel: "Quick hellos"
                )
            }
        }
    }

    private func append(_ phrase: String) {
        guard !note.contains(phrase) else { return }
        note = note.isEmpty ? "\(phrase)." : "\(note.trimmingCharacters(in: .whitespaces)) \(phrase)."
    }

    private var scopeSentence: String {
        card.kind == .playdate
            ? "\(hostFirst) sees your first name, your verified badge, about how far away you live and your kids' ages. Never their names."
            : "\(hostFirst) sees your first name, your verified badge and about how far away you live. Never your address."
    }

    // MARK: - Sending

    private var sendTitle: String {
        if previous != nil { return "Update request" }
        return card.isFull ? "Join the waitlist" : "Send request"
    }

    private var canSend: Bool {
        guard card.kind == .playdate else { return true }
        return !ages.isEmpty && staysWithKids
    }

    private func prefill() {
        guard let previous else { return }
        partySize = previous.partySize
        note = previous.note ?? ""
        if let kids = previous.kidsCount { kidsCount = kids }
        ages = Set(previous.kidsAgeBands)
        if card.kind == .playdate { staysWithKids = true }
    }

    private func send() {
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = card.kind == .playdate
            ? AskToJoinBody(
                partySize: 1,
                note: trimmed.isEmpty ? nil : trimmed,
                kidsCount: kidsCount,
                kidsAgeBands: PlanKidsAgeBand.allCases.filter(ages.contains),
                staysWithKids: staysWithKids
            )
            : AskToJoinBody(partySize: partySize, note: trimmed.isEmpty ? nil : trimmed)
        Task {
            isSending = true
            failed = nil
            let sent = await onSend(body)
            isSending = false
            if sent { dismiss() } else { failed = "We couldn't send that. Please try again." }
        }
    }
}

/// Board P2 stepper: 48 pt, a minus and a plus around the value.
struct PlanStepper: View {
    @Binding var value: Int
    let range: ClosedRange<Int>
    let label: String

    var body: some View {
        HStack(spacing: Spacing.s1) {
            stepButton(.minus, "One fewer", enabled: value > range.lowerBound) { value -= 1 }
            Text("\(value)")
                .planFont(.h4)
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appText)
                .frame(minWidth: 36)
            stepButton(.plus, "One more", enabled: value < range.upperBound) { value += 1 }
        }
        .padding(.horizontal, Spacing.s1)
        .frame(minHeight: 48)
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue("\(value)")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: if value < range.upperBound { value += 1 }
            case .decrement: if value > range.lowerBound { value -= 1 }
            @unknown default: break
            }
        }
    }

    private func stepButton(_ icon: PantopusIcon, _ label: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon(icon, size: 16, color: Theme.Color.appText)
                .frame(width: 40, height: 40)
                .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Theme.Color.appSurfaceSunken))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.4)
        .accessibilityLabel(label)
    }
}

/// Board P2 checkbox: 24 pt, sky when on.
struct PlanCheckbox: View {
    let isOn: Bool

    var body: some View {
        RoundedRectangle(cornerRadius: 7, style: .continuous)
            .fill(isOn ? Theme.Color.primary600 : Color.clear)
            .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).stroke(
                isOn ? Theme.Color.primary600 : Theme.Color.appTextSecondary,
                lineWidth: 2
            ))
            .overlay {
                if isOn { Icon(.check, size: 14, strokeWidth: 3, color: Theme.Color.appTextInverse) }
            }
            .frame(width: 24, height: 24)
            .accessibilityHidden(true)
    }
}
