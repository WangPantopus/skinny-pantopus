//
//  InviteOwnerFormContent.swift
//  Pantopus
//
//  A13.2 body content for the Invite Owner single-screen form.
//

import SwiftUI

@MainActor
struct InviteOwnerFormContent: View {
    @Bindable var viewModel: InviteOwnerFormViewModel

    var body: some View {
        HomeContextStrip(context: viewModel.homeContext)
            .padding(.horizontal, Spacing.s4)

        FormFieldGroup("Contact info") {
            PantopusTextField(
                "Email",
                text: bind(.email),
                placeholder: "name@example.com",
                state: fieldState(.email),
                isRequired: true,
                keyboardType: .emailAddress,
                contentType: .emailAddress,
                identifier: "inviteOwnerEmailField"
            )
            VStack(alignment: .leading, spacing: Spacing.s1) {
                PantopusTextField(
                    "Phone (optional)",
                    text: bind(.phone),
                    placeholder: "(415) 555-...",
                    state: fieldState(.phone),
                    keyboardType: .phonePad,
                    contentType: .telephoneNumber,
                    identifier: "inviteOwnerPhoneField"
                )
                Text("Used only for SMS verification code.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }

        FormFieldGroup("Ownership share") {
            OwnershipSummaryCard(summary: viewModel.ownershipSummary)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                RequiredFieldLabel("Share to grant", isRequired: true)
                StatefulSlider(
                    value: Binding(
                        get: { viewModel.grantPercent },
                        set: { viewModel.updateGrantPercent($0) }
                    ),
                    isError: viewModel.hasShareConflict
                )
                if !viewModel.hasShareConflict {
                    Text(viewModel.retentionHint)
                        .pantopusTextStyle(.caption)
                        .italic()
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .accessibilityIdentifier("inviteOwnerShareHint")
                }
            }
            if viewModel.hasShareConflict {
                OwnershipConflictBlock(viewModel: viewModel)
            }
        }

        FormFieldGroup("Verification") {
            FastTrackToggleRow(isOn: $viewModel.fastTrack)
        }

        FormFieldGroup("Role") {
            RoleNoteEditor(
                text: bind(.role),
                maxLength: viewModel.noteMaxLength
            )
            Text("Visible to other owners. Helps avoid stepping on each other.")
                .pantopusTextStyle(.caption)
                .italic()
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private func bind(_ field: InviteOwnerField) -> Binding<String> {
        Binding(
            get: { viewModel.fields[field]?.value ?? "" },
            set: { viewModel.update(field, to: $0) }
        )
    }

    private func fieldState(_ field: InviteOwnerField) -> PantopusFieldState {
        guard let snapshot = viewModel.fields[field], snapshot.touched else { return .default }
        if let error = snapshot.error { return .error(error) }
        return snapshot.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .default : .valid
    }
}

// MARK: - Fast track

/// RN's fast-track switch (`src/app/homes/[id]/owners/invite.tsx:98-110`),
/// copy from `constants/ownershipCopy.ts` `CO_OWNER_INVITE`. Defaults ON
/// and sends `fast_track` so the backend files the claim as a vouch.
private struct FastTrackToggleRow: View {
    @Binding var isOn: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Fast track (vouch)")
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text("Still requires verification")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Toggle("", isOn: $isOn)
                .labelsHidden()
                .tint(Theme.Color.primary600)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 2)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Fast track vouch. Still requires verification.")
        .accessibilityIdentifier("inviteOwnerFastTrackToggle")
    }
}

// MARK: - Context

private struct HomeContextStrip: View {
    let context: InviteOwnerHomeContext

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.home)
                    .frame(width: 30, height: 30)
                Icon(.home, size: 15, color: Theme.Color.appTextInverse)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(context.title)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text(context.subtitle)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
            Text("OWNER INVITE")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.primary700)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 3)
                .background(Theme.Color.primary100)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 2)
        .background(Theme.Color.primary50)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary100, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Owner invite for \(context.title), \(context.subtitle)")
        .accessibilityIdentifier("inviteOwnerHomeContext")
    }
}

// MARK: - Ownership summary

private struct OwnershipSummaryCard: View {
    let summary: InviteOwnershipSummary

    var body: some View {
        HStack(spacing: Spacing.s3) {
            HStack(spacing: -Spacing.s2) {
                ForEach(summary.owners) { owner in
                    OwnerAvatar(owner: owner)
                }
            }
            .padding(.trailing, Spacing.s1)

            summaryText
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text("\(summary.availablePercent)% left")
                .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                .foregroundStyle(summary.hasConflict ? Theme.Color.error : Theme.Color.success)
                .textCase(.uppercase)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 3)
                .background(summary.hasConflict ? Theme.Color.errorBg : Theme.Color.successBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
                .accessibilityIdentifier("inviteOwnerAvailablePill")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 2)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilitySummary)
        .accessibilityIdentifier("inviteOwnerOwnershipSummary")
    }

    private var summaryText: Text {
        var result = Text("")
        for (index, owner) in summary.owners.enumerated() {
            let separator = index < summary.owners.count - 1 ? Text(" · ") : Text("")
            result = result
                + Text(owner.name)
                .foregroundColor(Theme.Color.appText)
                .font(.system(size: 11, weight: .semibold))
                + Text(" \(owner.sharePercent)%")
                .font(.system(size: 11, weight: .regular, design: .monospaced))
                + separator
        }
        return result
    }

    private var accessibilitySummary: String {
        let owners = summary.owners.map { "\($0.name) \($0.sharePercent)%" }.joined(separator: ", ")
        return "\(owners). \(summary.availablePercent)% available."
    }
}

private struct OwnerAvatar: View {
    let owner: InviteOwnerOwnerShare

    var body: some View {
        Text(owner.initials)
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .frame(width: 22, height: 22)
            .background(owner.tone.fillColor)
            .clipShape(Circle())
            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
            .accessibilityHidden(true)
    }
}

// MARK: - Slider

private struct StatefulSlider: View {
    @Binding var value: Int
    let isError: Bool

    private let maxValue = 100

    var body: some View {
        HStack(spacing: Spacing.s3 + 2) {
            track
            Text("\(value)%")
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundStyle(isError ? Theme.Color.error : Theme.Color.primary700)
                .frame(minWidth: 44)
                .padding(.horizontal, Spacing.s2 + 2)
                .padding(.vertical, Spacing.s1)
                .background(isError ? Theme.Color.errorBg : Theme.Color.primary50)
                .clipShape(Capsule())
                .accessibilityHidden(true)
        }
        .accessibilityElement()
        .accessibilityLabel("Share to grant")
        .accessibilityValue("\(value)%")
        .accessibilityIdentifier("inviteOwnerShareSlider")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: value = min(maxValue, value + 1)
            case .decrement: value = max(0, value - 1)
            @unknown default: break
            }
        }
    }

    private var track: some View {
        GeometryReader { proxy in
            let width = max(proxy.size.width, 1)
            let percent = CGFloat(value) / CGFloat(maxValue)
            let thumbOffset = min(max(0, (width * percent) - 12), max(0, width - 24))

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(height: Spacing.s1)
                Capsule()
                    .fill(activeColor)
                    .frame(width: width * percent, height: Spacing.s1)
                Circle()
                    .fill(Theme.Color.appSurface)
                    .frame(width: Spacing.s6, height: Spacing.s6)
                    .overlay(Circle().stroke(activeColor, lineWidth: 2))
                    .shadow(color: activeColor.opacity(0.25), radius: 3, x: 0, y: 2)
                    .offset(x: thumbOffset)
            }
            .frame(height: 44)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { gesture in
                        let x = min(max(0, gesture.location.x), width)
                        value = Int((x / width * CGFloat(maxValue)).rounded())
                    }
            )
        }
        .frame(height: 44)
    }

    private var activeColor: Color {
        isError ? Theme.Color.error : Theme.Color.primary600
    }
}

// MARK: - Conflict

private struct OwnershipConflictBlock: View {
    @Bindable var viewModel: InviteOwnerFormViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.alertCircle, size: 14, color: Theme.Color.error)
                    .padding(.top, 1)
                conflictText
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.error)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: Spacing.s3) {
                Button(action: viewModel.snapGrantToAvailablePool) {
                    HStack(spacing: Spacing.s1) {
                        Text("Snap to \(viewModel.availablePool)%")
                            .pantopusTextStyle(.small)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.error)
                        Icon(.download, size: 12, color: Theme.Color.error)
                    }
                    .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Snap to \(viewModel.availablePool) percent")
                .accessibilityIdentifier("inviteOwnerSnapButton")

                Button(action: viewModel.rebalanceShares) {
                    HStack(spacing: Spacing.s1) {
                        Text("Snap & Rebalance")
                            .pantopusTextStyle(.small)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.error)
                        Icon(.arrowRight, size: 12, color: Theme.Color.error)
                    }
                    .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Snap and rebalance shares")
                .accessibilityIdentifier("inviteOwnerRebalanceButton")
            }
            .padding(.leading, Spacing.s6 - 2)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 2)
        .background(Theme.Color.errorBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.errorLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("inviteOwnerConflictBlock")
    }

    private var conflictText: Text {
        let message = viewModel.conflictMessage ?? ""
        let emphasized = "Total would be \(viewModel.totalAfterGrant)%."
        guard let range = message.range(of: emphasized) else {
            return Text(message)
        }
        return Text(String(message[..<range.lowerBound]))
            + Text(emphasized).font(.system(size: 12, weight: .semibold))
            + Text(String(message[range.upperBound...]))
    }
}

// MARK: - Role

private struct RoleNoteEditor: View {
    @Binding var text: String
    let maxLength: Int

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            RequiredFieldLabel("What they are responsible for (optional)", isRequired: false)
            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text("e.g. Maintenance lead, deals with the super and contractors.")
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, Spacing.s2 + 1)
                        .padding(.vertical, Spacing.s2)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $text)
                    .font(Theme.Font.body)
                    .foregroundStyle(Theme.Color.appText)
                    .frame(minHeight: 92)
                    .padding(Spacing.s1)
                    .scrollContentBackground(.hidden)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .accessibilityLabel("Owner responsibility note")
                    .accessibilityIdentifier("inviteOwnerRoleField")
            }
            Text("\(text.count) / \(maxLength)")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .accessibilityIdentifier("inviteOwnerRoleCharCount")
        }
    }
}

private struct RequiredFieldLabel: View {
    let title: String
    let isRequired: Bool

    init(_ title: String, isRequired: Bool) {
        self.title = title
        self.isRequired = isRequired
    }

    var body: some View {
        HStack(spacing: 2) {
            Text(title)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            if isRequired {
                Text("*")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityLabel(isRequired ? "\(title), required" : title)
    }
}

private extension InviteOwnerTone {
    var fillColor: Color {
        switch self {
        case .personal: Theme.Color.personal
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        }
    }
}
