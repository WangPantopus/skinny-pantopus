//
//  AutomationsKit.swift
//  Pantopus
//
//  Stream I16 (Reminders / workflows / templates) — the local UI vocabulary for
//  H1–H8. Mirrors the proven `BusinessKit` / `SetupKit` primitives (top bar,
//  card, overline, note, sheet chrome, segmented control, stepper, skeleton) on
//  the Personal-sky pillar, plus the automations-specific atoms the design suite
//  calls for: the A08 2px-underline tab strip, Push/Email channel chips, a
//  floating create FAB, the inline "no follow-ups" empty, and the dark success
//  toast. Tokens only (Theme.Color.* / Spacing / Radii / Icon) — no hardcoded
//  colors or spacing. Functional CTAs stay product sky; identity chrome takes the
//  owner pillar accent via `SchedulingIdentityTheme`.
//

// swiftlint:disable file_length

import SwiftUI

// MARK: - Top bar (46pt)

/// The 46pt top bar used by the routed full screens (H2 / H3 / H5 / H7 / H8).
/// Leading back/close + centered title + optional trailing control.
struct AutoTopBar: View {
    enum Leading { case none, back, close }

    let title: String
    var leading: Leading = .back
    var onLeading: (() -> Void)?
    var trailing: AnyView?

    var body: some View {
        HStack(spacing: Spacing.s0) {
            leadingControl.frame(width: 40, height: 40)
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .tracking(-0.2)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity)
                .lineLimit(1)
                .accessibilityAddTraits(.isHeader)
            Group {
                if let trailing { trailing } else { Color.clear }
            }
            .frame(width: 40, height: 40)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 46)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
    }

    @ViewBuilder private var leadingControl: some View {
        switch leading {
        case .none:
            Color.clear
        case .back, .close:
            Button { onLeading?() } label: {
                Icon(leading == .back ? .chevronLeft : .x, size: 21, color: Theme.Color.appText)
                    .frame(width: 40, height: 40)
            }
            .accessibilityIdentifier(leading == .back ? "automationsTopBarBack" : "automationsTopBarClose")
            .accessibilityLabel(leading == .back ? "Back" : "Close")
        }
    }
}

/// A primary-tinted text button for the top-bar trailing slot ("Save", "+").
struct AutoTopBarTextButton: View {
    let title: String
    var icon: PantopusIcon?
    var isEnabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 3) {
                if let icon { Icon(icon, size: 16, color: color) }
                Text(title).font(.system(size: 13.5, weight: .bold)).foregroundStyle(color)
            }
        }
        .disabled(!isEnabled)
        .accessibilityIdentifier("automationsTopBarAction")
    }

    private var color: Color {
        isEnabled ? Theme.Color.primary600 : Theme.Color.appTextMuted
    }
}

// MARK: - Card + overline

/// White card · 1px border · 16pt radius · soft shadow.
struct AutoCard<Content: View>: View {
    var padding = EdgeInsets(top: Spacing.s1, leading: 13, bottom: Spacing.s1, trailing: 13)
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .pantopusShadow(.sm)
    }
}

/// Uppercase section overline (group label).
struct AutoOverline: View {
    let text: String
    var color: Color = Theme.Color.appTextSecondary

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10.5, weight: .bold))
            .tracking(0.84)
            .foregroundStyle(color)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Inline note

enum AutoTone {
    case info, warning, error, success, neutral

    var bg: Color {
        switch self {
        case .info: Theme.Color.primary50
        case .warning: Theme.Color.warningBg
        case .error: Theme.Color.errorBg
        case .success: Theme.Color.successBg
        case .neutral: Theme.Color.appSurfaceSunken
        }
    }

    var fg: Color {
        switch self {
        case .info: Theme.Color.primary700
        case .warning: Theme.Color.warning
        case .error: Theme.Color.error
        case .success: Theme.Color.success
        case .neutral: Theme.Color.appTextStrong
        }
    }

    var border: Color? {
        switch self {
        case .info: Theme.Color.primary100
        case .warning: Theme.Color.warningLight
        case .error: Theme.Color.errorLight
        case .success: Theme.Color.successLight
        case .neutral: Theme.Color.appBorder
        }
    }
}

/// Semantic-tinted inline callout (paused / push-off / validation hints).
struct AutoNote: View {
    let tone: AutoTone
    var icon: PantopusIcon?
    let text: String
    var trailing: AnyView?

    var body: some View {
        HStack(alignment: trailing == nil ? .top : .center, spacing: 9) {
            if let icon {
                Icon(icon, size: 16, color: tone.fg)
                    .padding(.top, trailing == nil ? 1 : 0)
            }
            Text(text)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(tone.fg)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s2)
            if let trailing { trailing }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 11)
        .background(tone.bg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(tone.border ?? .clear, lineWidth: tone.border == nil ? 0 : 1)
        )
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Chips

/// Small uppercase pill chip (channel / usage badges).
struct AutoChip: View {
    let text: String
    var icon: PantopusIcon?
    var tone: AutoTone = .neutral

    var body: some View {
        HStack(spacing: Spacing.s1) {
            if let icon { Icon(icon, size: 10, strokeWidth: 2.6, color: tone.fg) }
            Text(text.uppercased())
                .font(.system(size: 9.5, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(tone.fg)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(tone.bg)
        .clipShape(Capsule())
    }
}

/// Push / Email selectable channel chip (reminder rows + action picker).
struct AutoChannelChip: View {
    let label: String
    let icon: PantopusIcon
    var isOn: Bool
    var isComingSoon: Bool = false
    var accent: Color = Theme.Color.primary600
    var accentBg: Color = Theme.Color.primary50
    var onTap: (() -> Void)?

    var body: some View {
        Group {
            if let onTap, !isComingSoon {
                Button(action: onTap) { chip }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(isOn ? [.isSelected, .isButton] : .isButton)
            } else {
                chip
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(isComingSoon ? "\(label), coming soon" : label)
            }
        }
    }

    private var chip: some View {
        HStack(spacing: 4) {
            Icon(icon, size: 11, color: foreground)
            Text(label).font(.system(size: 10.5, weight: isOn ? .bold : .semibold)).foregroundStyle(foreground)
            if isComingSoon {
                Text("Soon").font(.system(size: 8.5, weight: .bold)).foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .padding(.horizontal, 11)
        .frame(height: 24)
        .background(background)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(borderColor, lineWidth: 1))
        .opacity(isComingSoon ? 0.7 : 1)
    }

    private var foreground: Color {
        if isComingSoon { return Theme.Color.appTextMuted }
        return isOn ? accent : Theme.Color.appTextSecondary
    }

    private var background: Color {
        isOn ? accentBg : Theme.Color.appSurface
    }

    private var borderColor: Color {
        isOn ? accentBg : Theme.Color.appBorder
    }
}

// MARK: - Underline tab strip (A08)

/// A08-style 2px-underline tab strip used for the scope selector (Global / This
/// event type), the Build / Activity tabs, and the preview channel tabs.
struct AutoUnderlineTabs: View {
    let tabs: [String]
    let selectedIndex: Int
    var accent: Color = Theme.Color.primary600
    let onSelect: (Int) -> Void

    var body: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(Array(tabs.enumerated()), id: \.offset) { idx, tab in
                let on = idx == selectedIndex
                Button { onSelect(idx) } label: {
                    Text(tab)
                        .font(.system(size: 12.5, weight: on ? .bold : .semibold))
                        .foregroundStyle(on ? Theme.Color.appText : Theme.Color.appTextSecondary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .overlay(alignment: .bottom) {
                            Rectangle()
                                .fill(on ? accent : Color.clear)
                                .frame(height: 2)
                        }
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? [.isSelected, .isButton] : .isButton)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
    }
}

// MARK: - Segmented (pill)

/// Pill segmented control (recipient chips, before/after, start/end, lifecycle).
struct AutoSegmented: View {
    let options: [String]
    let selectedIndex: Int
    var accent: Color = Theme.Color.primary600
    var disabled: Bool = false
    let onSelect: (Int) -> Void

    var body: some View {
        HStack(spacing: 3) {
            ForEach(Array(options.enumerated()), id: \.offset) { idx, opt in
                let on = idx == selectedIndex
                Button { onSelect(idx) } label: {
                    Text(opt)
                        .font(.system(size: 11.5, weight: on ? .bold : .semibold))
                        .foregroundStyle(on ? accent : Theme.Color.appTextSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity)
                        .frame(height: 32)
                        .background(on ? Theme.Color.appSurface : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                        .pantopusShadow(on ? .sm : .init(color: .clear, opacity: 0, radius: 0, x: 0, y: 0))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? [.isSelected, .isButton] : .isButton)
            }
        }
        .padding(3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        .disabled(disabled)
        .opacity(disabled ? 0.6 : 1)
    }
}

// MARK: - Radio row (trigger lifecycle list)

/// A 48pt selection row with a trailing radio — used by the Trigger Picker.
struct AutoRadioRow: View {
    let label: String
    var sub: String?
    let selected: Bool
    var accent: Color = Theme.Color.primary600
    var icon: PantopusIcon?
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 11) {
                if let icon {
                    Icon(icon, size: 16, color: selected ? accent : Theme.Color.appTextSecondary)
                        .frame(width: 22)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(label).font(.system(size: 14.5, weight: .medium)).foregroundStyle(Theme.Color.appText)
                    if let sub {
                        Text(sub).font(.system(size: 11)).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(1)
                    }
                }
                Spacer(minLength: Spacing.s2)
                ZStack {
                    Circle().stroke(selected ? Color.clear : Theme.Color.appBorderStrong, lineWidth: 1.5)
                    if selected {
                        Circle().fill(accent)
                        Icon(.check, size: 11, strokeWidth: 3.2, color: Theme.Color.appTextInverse)
                    }
                }
                .frame(width: 22, height: 22)
            }
            .padding(.vertical, 11)
            .frame(minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
    }
}

// MARK: - Stepper

/// − value + pill stepper for the custom reminder time + trigger offset.
struct AutoStepper: View {
    let value: Int
    var accent: Color = Theme.Color.primary600
    var isInvalid: Bool = false
    var canDecrement: Bool = true
    var canIncrement: Bool = true
    let onDecrement: () -> Void
    let onIncrement: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s1) {
            stepButton(.minus, enabled: canDecrement, color: Theme.Color.appTextStrong, action: onDecrement)
                .accessibilityLabel("Decrease")
            Text("\(value)")
                .font(.system(size: 13, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(isInvalid ? Theme.Color.error : accent)
                .frame(minWidth: 34)
            stepButton(.plus, enabled: canIncrement, color: accent, action: onIncrement)
                .accessibilityLabel("Increase")
        }
    }

    private func stepButton(_ icon: PantopusIcon, enabled: Bool, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ZStack {
                Circle().stroke(Theme.Color.appBorder, lineWidth: 1)
                Icon(icon, size: 12, color: enabled ? color : Theme.Color.appTextMuted)
            }
            .frame(width: 28, height: 28)
            .background(Theme.Color.appSurface, in: Circle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

// MARK: - Sheet chrome

/// Bottom-sheet header: title + optional subhead + circular close.
struct AutoSheetHeader: View {
    let title: String
    var subhead: String?
    var trailing: AnyView?
    let onClose: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(title)
                    .font(.system(size: 17, weight: .bold))
                    .tracking(-0.3)
                    .foregroundStyle(Theme.Color.appText)
                if let subhead {
                    Text(subhead)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: Spacing.s2)
            if let trailing { trailing }
            Button(action: onClose) {
                ZStack {
                    Circle().fill(Theme.Color.appSurfaceSunken)
                    Icon(.x, size: 16, color: Theme.Color.appTextStrong)
                }
                .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s2)
    }
}

/// Sticky footer container above the home indicator.
struct AutoSheetFooter<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            content
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s3)
                .padding(.bottom, Spacing.s5)
        }
        .background(Theme.Color.appSurface)
    }
}

/// Full-width primary CTA. Functional chrome → product sky.
struct AutoPrimaryButton: View {
    let title: String
    var icon: PantopusIcon?
    var isSaving: Bool = false
    var isDisabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                if isSaving {
                    ProgressView().tint(Theme.Color.appTextInverse)
                } else if let icon {
                    Icon(icon, size: 16, color: Theme.Color.appTextInverse)
                }
                Text(title)
                    .font(.system(size: 14.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(Theme.Color.primary600.opacity(isDisabled ? 0.45 : 1))
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .pantopusShadow(isDisabled ? .init(color: .clear, opacity: 0, radius: 0, x: 0, y: 0) : .primary)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled || isSaving)
        .accessibilityIdentifier("automationsPrimaryButton")
    }
}

/// Bordered neutral / outline button.
struct AutoGhostButton: View {
    let title: String
    var icon: PantopusIcon?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                if let icon { Icon(icon, size: 15, color: Theme.Color.appTextStrong) }
                Text(title).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.Color.appTextStrong)
            }
            .frame(height: 40)
            .padding(.horizontal, 16)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Divider + icon tile

/// Hairline row divider.
struct AutoRowDivider: View {
    var body: some View {
        Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
    }
}

/// Rounded leading glyph tile.
func autoIconTile(_ icon: PantopusIcon, bg: Color, fg: Color, size: CGFloat = 34, glyph: CGFloat = 17) -> some View {
    ZStack {
        RoundedRectangle(cornerRadius: 9, style: .continuous).fill(bg)
        Icon(icon, size: glyph, color: fg)
    }
    .frame(width: size, height: size)
}

// MARK: - FAB

/// Floating create button (52×52, pillar-accented, tinted shadow).
struct AutoFAB: View {
    var accent: Color = Theme.Color.primary600
    var shadow: PantopusShadow = .primary
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle().fill(accent)
                Icon(.plus, size: 24, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
            }
            .frame(width: 52, height: 52)
            .pantopusShadow(shadow)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityIdentifier("automationsFAB")
    }
}

// MARK: - Inline empty + error + skeleton

/// Compact centered empty prompt (kept below a pinned card, so not full-bleed).
struct AutoInlineEmpty: View {
    let icon: PantopusIcon
    let headline: String
    let subcopy: String
    var accent: Color = Theme.Color.primary600
    var accentBg: Color = Theme.Color.primary50
    var ctaTitle: String?
    var onCTA: (() -> Void)?

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle().fill(accentBg).frame(width: 56, height: 56)
                Icon(icon, size: 25, strokeWidth: 1.8, color: accent)
            }
            .accessibilityHidden(true)
            Text(headline).font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.Color.appText)
            Text(subcopy)
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(2)
                .frame(maxWidth: 230)
            if let ctaTitle, let onCTA {
                AutoGhostButton(title: ctaTitle, icon: .plus, action: onCTA).padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s5)
        .padding(.vertical, Spacing.s5)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(headline). \(subcopy)")
    }
}

/// Full-bleed centered retry card (cloud-off + Try again).
struct AutoErrorView: View {
    var headline: String = "Couldn't load"
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 56, height: 56)
                Icon(.cloudOff, size: 25, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            }
            Text(headline)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 240)
            Button(action: onRetry) {
                HStack(spacing: 6) {
                    Icon(.refreshCw, size: 14, color: Theme.Color.appTextStrong)
                    Text("Try again")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            .accessibilityIdentifier("automationsRetry")
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s8)
        .background(Theme.Color.appBg)
    }
}

/// Shimmer skeleton row (tile + two bars + optional trailing pill).
struct AutoSkeletonRow: View {
    var showTrailingPill: Bool = true

    var body: some View {
        HStack(spacing: 11) {
            Shimmer(width: 34, height: 34, cornerRadius: 9)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Shimmer(width: 150, height: 11, cornerRadius: Radii.sm)
                Shimmer(width: 96, height: 9, cornerRadius: Radii.sm)
            }
            Spacer(minLength: Spacing.s0)
            if showTrailingPill { Shimmer(width: 46, height: 28, cornerRadius: Radii.pill) }
        }
        .padding(.vertical, 13)
    }
}

// MARK: - Text inputs

/// Single-line form input (subject / name fields).
struct AutoTextField: View {
    let placeholder: String
    @Binding var text: String
    var accent: Color = Theme.Color.primary600

    var body: some View {
        TextField(placeholder, text: $text)
            .font(.system(size: 14))
            .foregroundStyle(Theme.Color.appText)
            .padding(.horizontal, 12)
            .frame(height: 42)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
    }
}

/// Multi-line message body editor with a placeholder + optional error border.
struct AutoTextEditor: View {
    let placeholder: String
    @Binding var text: String
    var minHeight: CGFloat = 120
    var isError: Bool = false

    var body: some View {
        ZStack(alignment: .topLeading) {
            TextEditor(text: $text)
                .font(.system(size: 14))
                .foregroundStyle(Theme.Color.appText)
                .scrollContentBackground(.hidden)
                .frame(minHeight: minHeight)
                .padding(8)
            if text.isEmpty {
                Text(placeholder)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.horizontal, 13)
                    .padding(.top, 16)
                    .allowsHitTesting(false)
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(isError ? Theme.Color.error : Theme.Color.appBorder, lineWidth: isError ? 1.5 : 1)
        )
    }
}

// MARK: - Toast

/// Dark pill success toast (bottom by default). Drive via an `isShown` flag.
struct AutoToast: View {
    let text: String
    var icon: PantopusIcon = .checkCircle
    var tint: Color = Theme.Color.success

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(icon, size: 15, strokeWidth: 2.4, color: tint)
            Text(text)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 10)
        .background(Theme.Color.appText)
        .clipShape(Capsule())
        .pantopusShadow(.lg)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(text)
    }
}
