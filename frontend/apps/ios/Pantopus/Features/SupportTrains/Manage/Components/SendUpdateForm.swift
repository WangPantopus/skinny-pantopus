//
//  SendUpdateForm.swift
//  Pantopus
//
//  A13.13 — Manage train. The "Send an update" form section. Three rows:
//    1. 108pt-tall message textarea + 168/500 char counter.
//    2. Audience chip row (`All helpers 12` selected sky · `Upcoming only`
//       · `Family`).
//    3. Push-to-phones row (bell icon + label + sub + iOS Toggle).
//
//  Also exports `SlotPreview` — the slot-fill summary strip rendered above
//  the form section. Kept colocated because both surfaces live inside the
//  "send an update" mid-section of the screen.
//

import SwiftUI

// MARK: - SlotPreview

/// Slot-fill summary strip: 21 dots painted in 3 tones (filled / dropout /
/// open) with a header + a 3-item legend underneath. Mirrors the design
/// source's `SlotPreview` atom.
@MainActor
public struct SlotPreview: View {
    private let filled: Int
    private let dropout: Int
    private let open: Int
    private let total: Int
    private let caption: String

    public init(filled: Int, dropout: Int, open: Int, total: Int, caption: String) {
        self.filled = filled
        self.dropout = dropout
        self.open = open
        self.total = total
        self.caption = caption
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            header
            dotRow
            legend
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("manageTrainSlotPreview")
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("Slot fill")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            Spacer()
            Text(caption)
                .font(.system(size: 11))
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var dotRow: some View {
        // Build a contiguous run: filled.. dropout.. filled.. open..
        // mirroring the design's visual cadence (a dropout in the middle
        // of the filled run, open slots at the tail).
        let states = dotStates
        return HStack(spacing: Spacing.s1) {
            ForEach(Array(states.enumerated()), id: \.offset) { _, state in
                dot(state)
            }
            Spacer(minLength: 0)
        }
    }

    private var legend: some View {
        HStack(spacing: Spacing.s3) {
            legendEntry(label: "Filled \(filled)", state: .filled)
            legendEntry(label: "Drop \(dropout)", state: .dropout)
            legendEntry(label: "Open \(open)", state: .open)
            Spacer(minLength: 0)
        }
    }

    private func legendEntry(label: String, state: DotState) -> some View {
        HStack(spacing: Spacing.s1) {
            dot(state, swatch: true)
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private enum DotState { case filled, dropout, open }

    private var dotStates: [DotState] {
        // First half of the filled run, then 1 dropout, then the rest of
        // the filled run, then open slots. Hard-clipped to `total` so a
        // future content delta never blows the row width.
        let firstFilled = min(filled / 2, total)
        let lead: [DotState] = Array(repeating: .filled, count: firstFilled)
        let dropRun: [DotState] = Array(repeating: .dropout, count: dropout)
        let tailFilled = max(filled - firstFilled, 0)
        let trail: [DotState] = Array(repeating: .filled, count: tailFilled)
        let openRun: [DotState] = Array(repeating: .open, count: open)
        let all = lead + dropRun + trail + openRun
        return Array(all.prefix(total))
    }

    @ViewBuilder
    private func dot(_ state: DotState, swatch: Bool = false) -> some View {
        let size: CGFloat = swatch ? 7 : 10
        let radius: CGFloat = swatch ? 2 : 3
        switch state {
        case .filled:
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(Theme.Color.success)
                .frame(width: size, height: size)
        case .dropout:
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(Theme.Color.error)
                .frame(width: size, height: size)
        case .open:
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .strokeBorder(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1, dash: [2]))
                .frame(width: size, height: size)
        }
    }
}

// MARK: - SendUpdateForm

/// The full "Send an update" form section. Hosts the message textarea
/// (with live char-counter), the audience chip row, and the push-to-phones
/// toggle. The parent owns the bindings; this view is pure render.
@MainActor
public struct SendUpdateForm: View {
    private let chips: [AudienceChipContent]
    @Binding private var message: String
    @Binding private var selectedAudienceId: String
    @Binding private var pushToPhones: Bool
    private let counterLabel: String
    private let isOverLimit: Bool

    public init(
        chips: [AudienceChipContent],
        message: Binding<String>,
        selectedAudienceId: Binding<String>,
        pushToPhones: Binding<Bool>,
        counterLabel: String,
        isOverLimit: Bool
    ) {
        self.chips = chips
        _message = message
        _selectedAudienceId = selectedAudienceId
        _pushToPhones = pushToPhones
        self.counterLabel = counterLabel
        self.isOverLimit = isOverLimit
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            messageBlock
            audienceBlock
            pushBlock
        }
        .accessibilityIdentifier("manageTrainSendUpdateForm")
    }

    // MARK: - Message block

    private var messageBlock: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Message")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.appSurface)
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(messageBorderColor, lineWidth: 1)
                TextEditor(text: $message)
                    .scrollContentBackground(.hidden)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, Spacing.s2)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityIdentifier("manageTrainMessageField")
            }
            .frame(height: 108)
            HStack {
                Spacer()
                Text(counterLabel)
                    .font(.system(size: 11))
                    .monospacedDigit()
                    .foregroundStyle(isOverLimit ? Theme.Color.error : Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("manageTrainMessageCounter")
            }
        }
    }

    private var messageBorderColor: Color {
        isOverLimit ? Theme.Color.error : Theme.Color.appBorder
    }

    // MARK: - Audience block

    private var audienceBlock: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Audience")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            FlowingChipsRow(chips: chips, selectedId: $selectedAudienceId)
        }
    }

    // MARK: - Push block

    private var pushBlock: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.bell, size: 15, color: Theme.Color.appTextSecondary)
            VStack(alignment: .leading, spacing: 1) {
                Text("Push to phones")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                Text("Otherwise it lands in their inbox only.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s1)
            Toggle("", isOn: $pushToPhones)
                .labelsHidden()
                .accessibilityLabel("Push to phones")
                .accessibilityIdentifier("manageTrainPushToggle")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

// MARK: - FlowingChipsRow

/// Wrapping row of selectable audience chips. The selected chip paints
/// in the sky primary palette; the others sit on the surface.
@MainActor
struct FlowingChipsRow: View {
    let chips: [AudienceChipContent]
    @Binding var selectedId: String

    var body: some View {
        // SwiftUI doesn't ship a built-in flow layout pre-iOS 16; the
        // chips fit on one line in every shipped fixture, so a plain
        // wrapping HStack with `.fixedSize()` keeps the layout simple
        // and snapshot-stable.
        HStack(spacing: Spacing.s2) {
            ForEach(chips) { chip in
                chipView(chip)
            }
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private func chipView(_ chip: AudienceChipContent) -> some View {
        let isSelected = chip.id == selectedId
        Button {
            selectedId = chip.id
        } label: {
            HStack(spacing: Spacing.s1) {
                if isSelected {
                    Icon(.check, size: 12, strokeWidth: 3, color: Theme.Color.primary600)
                }
                Text(chip.label)
                    .font(.system(size: 12.5, weight: isSelected ? .semibold : .medium))
                    .foregroundStyle(isSelected ? Theme.Color.primary700 : Theme.Color.appTextStrong)
                Text(chip.count)
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(isSelected ? Theme.Color.primary600 : Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 7)
            .background(
                Capsule(style: .continuous)
                    .fill(isSelected ? Theme.Color.primary50 : Theme.Color.appSurface)
            )
            .overlay(
                Capsule(style: .continuous)
                    .stroke(isSelected ? Theme.Color.primary100 : Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("manageTrainAudienceChip.\(chip.id)")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

#Preview("SlotPreview") {
    SlotPreview(filled: 18, dropout: 1, open: 2, total: 21, caption: "18 / 21 · 86%")
        .padding()
        .background(Theme.Color.appBg)
}

#Preview("SendUpdateForm") {
    @Previewable @State var msg = "Quick note from Daniel — see Tuesday's drop."
    @Previewable @State var aud = "all"
    @Previewable @State var push = true
    return SendUpdateForm(
        chips: [
            AudienceChipContent(id: "all", label: "All helpers", count: "12"),
            AudienceChipContent(id: "upcoming", label: "Upcoming only", count: "6"),
            AudienceChipContent(id: "family", label: "Family", count: "3")
        ],
        message: $msg,
        selectedAudienceId: $aud,
        pushToPhones: $push,
        counterLabel: "168 / 500",
        isOverLimit: false
    )
    .padding()
    .background(Theme.Color.appBg)
}
