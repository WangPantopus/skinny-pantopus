//
//  BookingsExtrasUI.swift
//  Pantopus
//
//  Stream I9 — small shared view primitives used across the Bookings-extras
//  surfaces (E6 no-show / E7 follow-up / E9 filter / E10 double-book / E11
//  nudge / E8 roster / E13 waitlist). Tokens only — no hardcoded colors. Per-
//  frame point sizes are inlined to match the designer frames (the repo's
//  documented convention for type/size).
//

import SwiftUI

// MARK: - Centered confirmation-dialog scaffold (E6 / E10)

/// A centered white "confirmation dialog" card over a dimmed parent — the
/// EventDetail-delete / WizardCloseConfirm DNA. Present from a parent screen
/// via `.overlay { if isPresented { ExtrasDialog(...) } }` so the parent stays
/// visible (dimmed) behind it.
struct ExtrasDialog<Content: View>: View {
    /// Tapping the scrim dismisses unless the dialog is mid-submit.
    let isDismissable: Bool
    let onDismiss: () -> Void
    @ViewBuilder let content: Content

    var body: some View {
        ZStack {
            Theme.Color.appText.opacity(0.5)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture { if isDismissable { onDismiss() } }
            card
                .padding(.horizontal, Spacing.s5)
        }
        .transition(.opacity)
    }

    private var card: some View {
        VStack(spacing: 0) { content }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s5)
            .padding(.bottom, Spacing.s4)
            .frame(maxWidth: 300)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
            .shadow(color: Theme.Color.appText.opacity(0.3), radius: 25, y: 18)
    }
}

/// 40pt tinted disc with a centered glyph — the dialog / empty-state icon.
struct ExtrasIconDisc: View {
    let icon: PantopusIcon
    let background: Color
    let foreground: Color
    var diameter: CGFloat = 40

    var body: some View {
        ZStack {
            Circle().fill(background).frame(width: diameter, height: diameter)
            Icon(icon, size: diameter * 0.5, color: foreground)
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Buttons

/// Solid pill-radius primary button used on sheet footers + dialog confirms.
struct ExtrasSolidButton: View {
    let title: String
    var icon: PantopusIcon?
    var tone: Tone = .primary
    var accent: Color = Theme.Color.primary600
    var isEnabled: Bool = true
    var isBusy: Bool = false
    var fillWidth: Bool = true
    let action: () -> Void

    enum Tone { case primary, destructive }

    private var fill: Color {
        guard isEnabled else { return Theme.Color.appSurfaceSunken }
        return tone == .destructive ? Theme.Color.error : accent
    }

    var body: some View {
        Button(action: action) {
            Group {
                if isBusy {
                    ProgressView().tint(.white)
                } else {
                    HStack(spacing: Spacing.s2) {
                        if let icon { Icon(icon, size: 16, color: isEnabled ? .white : Theme.Color.appTextMuted) }
                        Text(title)
                    }
                }
            }
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(isEnabled ? Color.white : Theme.Color.appTextMuted)
            .frame(maxWidth: fillWidth ? .infinity : nil)
            .frame(height: 46)
            .padding(.horizontal, fillWidth ? 0 : Spacing.s5)
            .background(fill)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled || isBusy)
        .shadow(color: isEnabled && tone == .primary ? accent.opacity(0.28) : .clear, radius: 8, y: 4)
    }
}

/// Ghost / outline button (Cancel · Keep open · Try again · Book another).
struct ExtrasGhostButton: View {
    let title: String
    var icon: PantopusIcon?
    var foreground: Color = Theme.Color.appTextStrong
    var isEnabled: Bool = true
    var fillWidth: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                if let icon { Icon(icon, size: 16, color: foreground) }
                Text(title)
            }
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(foreground)
            .frame(maxWidth: fillWidth ? .infinity : nil)
            .frame(height: 46)
            .padding(.horizontal, fillWidth ? 0 : Spacing.s5)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(Theme.Color.appBorderStrong, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .opacity(isEnabled ? 1 : 0.5)
    }
}

// MARK: - Inline error strip

/// Red inline "Couldn't … — try again" strip shown inside dialogs/sheets.
struct ExtrasInlineError: View {
    let message: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 14, color: Theme.Color.error)
            Text(message)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.error)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s2)
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.errorBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(Theme.Color.errorLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}

// MARK: - Bottom-sheet chrome (E7 / E9 / E11 / E13 join)

/// Grabber pill shown at the top of a custom bottom-sheet body.
struct ExtrasSheetGrabber: View {
    var body: some View {
        Capsule()
            .fill(Theme.Color.appBorderStrong)
            .frame(width: 36, height: 5)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s1)
            .accessibilityHidden(true)
    }
}

/// Sticky footer container with a top hairline border (sheet CTA row).
struct ExtrasStickyFooter<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            Divider().overlay(Theme.Color.appBorder)
            content
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s3)
                .padding(.bottom, Spacing.s5)
        }
        .background(Theme.Color.appSurface)
    }
}

/// Uppercase overline label used above sheet sections (Audience / Status / …).
struct ExtrasOverline: View {
    let text: String

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .bold))
            .tracking(0.8)
            .foregroundStyle(Theme.Color.appTextSecondary)
    }
}
