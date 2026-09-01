//
//  DoubleBookWarningDialog.swift
//  Pantopus
//
//  Stream I9 — E10 Double-Book Warning (advisory confirm modal). Warns a host
//  before confirming a manual/blocked event that overlaps an existing booking
//  or another member's commitment. Advisory, NOT a hard block: a soft overlap
//  permits a human override ("Book anyway"); a hard member-conflict disables
//  the primary and offers "Pick another member". Presented locally via overlay
//  from the Manual Booking flow.
//

import SwiftUI

/// Describes the conflict an advisory double-book warning should render.
struct DoubleBookConflict: Equatable {
    enum Severity { case soft, hard }

    /// One linked, tappable conflicting commitment.
    struct LinkedEvent: Equatable {
        let title: String
        let detail: String
    }

    let severity: Severity
    let title: String
    let message: String
    var linkedEvent: LinkedEvent?
    /// For hard conflicts, the member whose availability the time collides with.
    var memberName: String?
}

struct DoubleBookWarningDialog: View {
    let conflict: DoubleBookConflict
    /// Retained for call-site compatibility; the design renders both CTAs in
    /// the fixed brand blue regardless of owner context, so the dialog uses
    /// `Theme.Color.primary600` for the action affordances (see JSX `PRIMARY`).
    var accent: Color = Theme.Color.primary600
    let onCancel: () -> Void
    var onViewConflict: (() -> Void)?
    var onBookAnyway: (() -> Void)?
    var onPickAnotherMember: (() -> Void)?

    private var isHard: Bool {
        conflict.severity == .hard
    }

    /// JSX hardcodes `PRIMARY = E.blue600` (primary600) for both the soft
    /// "Book anyway" solid CTA and the hard "Pick another member" link — the
    /// pillar accent is not applied to these affordances in the design.
    private var ctaAccent: Color {
        Theme.Color.primary600
    }

    var body: some View {
        ExtrasDialog(isDismissable: true, onDismiss: onCancel) {
            ExtrasIconDisc(
                icon: isHard ? .lock : .calendarClock,
                background: isHard ? Theme.Color.errorBg : Theme.Color.warningBg,
                foreground: isHard ? Theme.Color.error : Theme.Color.warning
            )
            .padding(.bottom, Spacing.s3)

            Text(conflict.title)
                .font(.system(size: 16.5, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .padding(.bottom, Spacing.s2)

            Text(conflict.message)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineSpacing(2)
                .multilineTextAlignment(.center)
                .padding(.bottom, Spacing.s3)

            if let linked = conflict.linkedEvent {
                conflictCard(linked)
                    .padding(.bottom, Spacing.s3)
            }

            if isHard, let member = conflict.memberName {
                memberConflictPill(member)
                    .padding(.bottom, Spacing.s3)
            }

            footer
        }
        .accessibilityIdentifier("scheduling.doubleBook")
    }

    // MARK: Conflict card (soft)

    private func conflictCard(_ linked: DoubleBookConflict.LinkedEvent) -> some View {
        Button {
            onViewConflict?()
        } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.warningBg)
                        .frame(width: 36, height: 36)
                    Icon(.wrench, size: 18, color: Theme.Color.warning)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(linked.title)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(linked.detail)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.appSurfaceSunken)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(onViewConflict == nil)
    }

    // MARK: Member conflict pill (hard)

    private func memberConflictPill(_ member: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Circle().fill(Theme.Color.home).frame(width: 8, height: 8)
            Text("Conflicts with \(member)'s availability")
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.homeDark)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 9)
        .background(Theme.Color.homeBg)
        // JSX green member-conflict pill uses borderRadius:11 → lg bucket (12), not md (8).
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    // MARK: Footer

    @ViewBuilder private var footer: some View {
        if isHard {
            VStack(spacing: 9) {
                disabledLockButton
                HStack(spacing: 9) {
                    ExtrasGhostButton(title: "Cancel") { onCancel() }
                    Button {
                        onPickAnotherMember?()
                    } label: {
                        HStack(spacing: Spacing.s2) {
                            Icon(.users, size: 15, color: ctaAccent)
                            Text("Pick another member")
                        }
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(ctaAccent)
                        .frame(maxWidth: .infinity)
                        // JSX "Pick another member" button is height:44 (line 106),
                        // matching the disabled lock row and the 44pt CTA row.
                        .frame(height: 44)
                    }
                    .buttonStyle(.plain)
                    .disabled(onPickAnotherMember == nil)
                }
            }
        } else {
            HStack(spacing: 9) {
                ExtrasGhostButton(title: "Cancel") { onCancel() }
                ExtrasSolidButton(title: "Book anyway", accent: ctaAccent) {
                    onBookAnyway?()
                }
            }
        }
    }

    private var disabledLockButton: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.lock, size: 15, color: Theme.Color.appTextMuted)
            Text("Can't book — member unavailable")
        }
        .font(.system(size: 13, weight: .bold))
        .foregroundStyle(Theme.Color.appTextMuted)
        .frame(maxWidth: .infinity)
        // JSX disabled lock button is height:44 (matches the design's 44pt CTA row).
        .frame(height: 44)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityHint("This time conflicts with the selected member's availability")
    }
}

#if DEBUG
#Preview("Soft overlap") {
    Color.white.overlay {
        DoubleBookWarningDialog(
            conflict: DoubleBookConflict(
                severity: .soft,
                title: "This time overlaps",
                message: "You already have \"Plumber visit\" from 2:00–3:00 PM on this calendar.",
                linkedEvent: .init(title: "Plumber visit", detail: "2:00–3:00 PM · this calendar")
            ),
            onCancel: {},
            onViewConflict: {},
            onBookAnyway: {}
        )
    }
}

#Preview("Hard conflict") {
    Color.white.overlay {
        DoubleBookWarningDialog(
            conflict: DoubleBookConflict(
                severity: .hard,
                title: "Member is unavailable",
                message: "This time conflicts with Mara's personal availability.",
                memberName: "Mara"
            ),
            accent: Theme.Color.home,
            onCancel: {},
            onPickAnotherMember: {}
        )
    }
}
#endif
