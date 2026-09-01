//
//  WaitlistJoinSheet.swift
//  Pantopus
//
//  Stream I9 — E13 Waitlist (invitee join). A host-branded bottom sheet shown
//  when an event type / slot is full: a "Fully booked" pill, the requested
//  window, contact fields, and a "Join waitlist" CTA that swaps to a joined
//  confirmation. Presented by the public booking flow (I5/I7) when full.
//  Accent follows the host's pillar.
//
//  Frames implemented:
//    Frame 1  FrameJoin      — join form (Mobile/phone field, SMS copy)
//    Frame 2  FrameJoined    — joined confirmation (#N position badge when
//                              available, "Leave waitlist" ghost CTA)
//    Frame 3  FrameAlready   — already on waitlist (clock disc, join date,
//                              position badge, "Leave waitlist" ghost CTA)
//

import SwiftUI

struct WaitlistJoinSheet: View {
    @State private var viewModel: WaitlistJoinViewModel
    var accent: Color
    let onClose: () -> Void

    init(viewModel: WaitlistJoinViewModel, accent: Color, onClose: @escaping () -> Void) {
        _viewModel = State(wrappedValue: viewModel)
        self.accent = accent
        self.onClose = onClose
    }

    var body: some View {
        VStack(spacing: 0) {
            ExtrasSheetGrabber()
            if viewModel.alreadyJoined {
                alreadyJoinedConfirmation
            } else if viewModel.didJoin {
                joinedConfirmation
            } else {
                form
                footer
            }
        }
        .background(Theme.Color.appSurface)
        .presentationDetents([.large])
        .presentationDragIndicator(.hidden)
        .accessibilityIdentifier("scheduling.waitlistJoin")
    }

    // MARK: Form (Frame 1)

    private var form: some View {
        @Bindable var viewModel = viewModel
        return ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                fullyBookedPill
                Text(viewModel.windowLabel)
                    .font(.system(size: 16.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Join the waitlist and we'll text you the moment a spot opens.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineSpacing(2)

                tzChip

                field(label: "Your name", icon: .user, placeholder: "Full name", text: $viewModel.name)
                field(
                    label: "Mobile",
                    icon: .phone,
                    placeholder: "For a text when a spot opens",
                    text: $viewModel.phone,
                    isPhone: true
                )
                field(label: "Preferred time", icon: nil, placeholder: "Any morning works (optional)", text: $viewModel.preferredTime)

                if let message = viewModel.errorMessage {
                    ExtrasInlineError(message: message)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s3)
        }
    }

    private var fullyBookedPill: some View {
        HStack(spacing: Spacing.s2 - 2) {
            Icon(.usersRound, size: 13, color: Theme.Color.warning)
            Text("Fully booked")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.warning)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s1 + 1)
        .background(Theme.Color.warningBg)
        .overlay(Capsule().strokeBorder(Theme.Color.warningLight, lineWidth: 1))
        .clipShape(Capsule())
    }

    private var tzChip: some View {
        HStack(spacing: Spacing.s2 - 2) {
            Icon(.globe, size: 13, color: Theme.Color.appTextStrong)
            Text("Times in \(viewModel.timeZoneLabel)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 28)
        .overlay(Capsule().strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
    }

    private func field(
        label: String,
        icon: PantopusIcon?,
        placeholder: String,
        text: Binding<String>,
        isPhone: Bool = false
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2 - 2) {
            ExtrasOverline(text: label)
            HStack(spacing: Spacing.s2 + 1) {
                if let icon { Icon(icon, size: 16, color: Theme.Color.appTextMuted) }
                TextField(placeholder, text: text)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appText)
                    .keyboardType(isPhone ? .phonePad : .default)
                    .textInputAutocapitalization(isPhone ? .never : .words)
                    .autocorrectionDisabled(isPhone)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 44)
            .background(Theme.Color.appSurfaceSunken)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
    }

    private var footer: some View {
        ExtrasStickyFooter {
            ExtrasSolidButton(
                title: "Join waitlist",
                icon: .userPlus,
                accent: accent,
                isEnabled: viewModel.canJoin,
                isBusy: viewModel.isJoining
            ) {
                Task { await viewModel.join() }
            }
        }
    }

    // MARK: Joined confirmation (Frame 2)

    private var joinedConfirmation: some View {
        VStack(spacing: Spacing.s4) {
            Spacer(minLength: Spacing.s8)
            ExtrasIconDisc(
                icon: .check,
                background: Theme.Color.successBg,
                foreground: Theme.Color.success,
                diameter: 74
            )
            VStack(spacing: Spacing.s2) {
                Text("You're on the waitlist")
                    .font(.system(size: 17.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("We'll text you if a spot frees up.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
            }
            // Position badge — shown only when the backend returns a queue rank.
            // Currently the join API never returns a position field (backend gap);
            // the badge is designed (Frame 2: "#N in line" on accentBg) and will
            // appear automatically once the backend populates it.
            positionBadge(position: nil, accentBg: accent.opacity(0.12))
            Spacer()
            // Design (Frame 2): "Leave waitlist" ghost CTA. There is no leave
            // endpoint yet (backend gap); the button closes the sheet for now.
            ExtrasGhostButton(title: "Leave waitlist") { onClose() }
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s5)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s5)
    }

    // MARK: Already on waitlist (Frame 3)

    private var alreadyJoinedConfirmation: some View {
        VStack(spacing: Spacing.s4) {
            Spacer(minLength: Spacing.s8)
            // Clock disc on accentBg (pillar tint), per design Frame 3.
            ZStack {
                Circle()
                    .fill(accent.opacity(0.12))
                    .frame(width: 74, height: 74)
                Icon(.clock, size: 32, color: accent)
            }
            .accessibilityHidden(true)
            VStack(spacing: Spacing.s2) {
                Text("You're already waiting")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(alreadySubtitle)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
            }
            // Position badge — same design token as Frame 2; backend gap applies.
            positionBadge(position: nil, accentBg: accent.opacity(0.12))
            Spacer()
            // Design (Frame 3): "Leave waitlist" ghost CTA. No leave endpoint
            // yet (backend gap); closes the sheet for now.
            ExtrasGhostButton(title: "Leave waitlist") { onClose() }
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s5)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s5)
    }

    /// Subtitle for Frame 3. Includes the formatted join date when available.
    private var alreadySubtitle: String {
        if let joinedAt = viewModel.joinedAt,
           let formatted = BookingsExtrasFormatting.shortDay(
               utcISO: joinedAt,
               tz: SchedulingTime.deviceTimeZoneIdentifier
           ) {
            return "You joined this waitlist on \(formatted). We'll text you the moment a seat opens."
        }
        return "We'll text you the moment a seat opens."
    }

    // MARK: Shared sub-views

    /// "#N in line" pill on pillar-tint background (Frames 2 + 3).
    /// Nil position → returns EmptyView (backend gap: API never populates it).
    @ViewBuilder
    private func positionBadge(position: Int?, accentBg: Color) -> some View {
        if let position {
            HStack(spacing: Spacing.s2) {
                Text("#\(position)")
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(accent)
                Text("in line")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .background(accentBg)
            .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
        }
    }
}

#if DEBUG
#Preview {
    Color.black.sheet(isPresented: .constant(true)) {
        WaitlistJoinSheet(
            viewModel: WaitlistJoinViewModel(
                slug: "acme-studio",
                eventTypeSlug: "group-class",
                windowLabel: "Sat, Jun 14 · 10:00 AM",
                timeZoneLabel: "Pacific Time",
                client: .shared
            ),
            accent: Theme.Color.business
        ) {}
    }
}
#endif
