//
//  PollResponseView.swift
//  Pantopus
//
//  Stream I11 — F6 Find a Time · Member Poll Response. Mark which proposed times
//  Works / If needed / Can't and submit. Unanswered / answered / closed /
//  submitted states are first-class; a closed poll renders its outcome, not an
//  error.
//

import SwiftUI

struct PollResponseView: View {
    @State private var viewModel: PollResponseViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: PollResponseViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .navigationTitle("Respond")
            .navigationBarTitleDisplayMode(.inline)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .task { await viewModel.load() }
            .accessibilityIdentifier("scheduling.pollResponse")
            .alert("Something went wrong", isPresented: actionErrorPresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.actionError ?? "")
            }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .loading:
            loadingSkeleton
        case let .error(message):
            ErrorState(headline: "Couldn't load this poll", message: message) {
                await viewModel.load()
            }
        case .ready:
            readyView
        case .closed:
            closedView
        case .submitted:
            submittedView
        }
    }

    // MARK: Organizer header

    private var organizerHeader: some View {
        FindATimeCard {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    Circle().fill(Theme.Color.homeBg).frame(width: 38, height: 38)
                    Icon(.users, size: 18, color: Theme.Color.home)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(viewModel.title.isEmpty ? "Finding a time" : viewModel.title)
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(viewModel.subtitle)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                HStack(spacing: 3) {
                    Icon(.vote, size: 10, color: Theme.Color.homeDark)
                    Text("POLL")
                }
                .font(.system(size: 9.5, weight: .bold))
                .foregroundStyle(Theme.Color.homeDark)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, 3)
                .background(Theme.Color.homeBg)
                .clipShape(Capsule())
            }
        }
    }

    // MARK: Ready (voting)

    private var readyView: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    organizerHeader
                    // Design Frame 3 pre-fills a "Can't" where the member is busy
                    // and explains it with an info-tone banner above the slots.
                    if viewModel.hasConflicts {
                        conflictPrefillBanner
                    }
                    FindATimeOverline(text: "Mark which times work", color: Theme.Color.appTextSecondary)
                    ForEach(viewModel.options) { option in
                        pollSlot(option)
                    }
                }
                .padding(Spacing.s3)
            }
        }
        .safeAreaInset(edge: .bottom) { submitBar }
    }

    /// Design info Banner (poll-response-frames `Banner tone="info"`): infoBg
    /// wash, info-tone glyph + body. Shown when any slot conflicts with the
    /// member's personal calendar.
    private var conflictPrefillBanner: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.info, size: 15, color: Theme.Color.info)
            Text("We pre-filled a \"Can't\" where you're already busy. Change any you can still make.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.Color.appTextStrong)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.infoBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.info.opacity(0.25), lineWidth: 1)
        }
    }

    /// Design PollSlot: pad 11px/13px, a 9px gap between the label row and the
    /// vote control, and an optional conflict pill + personal-calendar caption.
    /// Hand-rolled rather than `FindATimeCard` so the tighter rhythm holds.
    private func pollSlot(_ option: PollOptionRow) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .center, spacing: Spacing.s2) {
                Text(viewModel.dayTimeLabel(for: option))
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let conflict = option.conflict {
                    conflictPill(conflict)
                }
            }
            voteControl(option)
            if option.conflict != nil {
                HStack(spacing: Spacing.s1) {
                    Icon(.calendar, size: 11, color: Theme.Color.appTextMuted)
                    Text("From your personal calendar")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        }
        // Design dims the whole proposed-slot group (label + control) to 0.55
        // with pointer-events off when the proposal is closed.
        .opacity(viewModel.isClosed ? 0.55 : 1)
        .allowsHitTesting(!viewModel.isClosed)
    }

    /// Design conflict pill: errorBg wash, alert-triangle glyph + "Conflicts: …".
    private func conflictPill(_ title: String) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(.alertTriangle, size: 10, color: Theme.Color.error)
            Text("Conflicts: \(title)")
        }
        .font(.system(size: 9.5, weight: .bold))
        .foregroundStyle(Theme.Color.error)
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(Theme.Color.errorBg)
        .clipShape(Capsule())
    }

    private func voteControl(_ option: PollOptionRow) -> some View {
        let current = viewModel.selection(for: option)
        return HStack(spacing: 3) {
            voteSegment("Works", value: .works, current: current, accent: Theme.Color.home, option: option)
            voteSegment("If needed", value: .ifNeeded, current: current, accent: Theme.Color.warning, option: option)
            voteSegment("Can't", value: .cant, current: current, accent: Theme.Color.error, option: option)
        }
        .padding(3)
        .background(Theme.Color.appSurfaceSunken)
        // Design track radius is 9; nearest token is Radii.md (8) — tighter than
        // the prior Radii.lg (12).
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    private func voteSegment(
        _ label: String,
        value: PollResponseChoice,
        current: PollResponseChoice?,
        accent: Color,
        option: PollOptionRow
    ) -> some View {
        let isOn = current == value
        return Button { viewModel.setVote(value, for: option) } label: {
            Text(label)
                .font(.system(size: 11, weight: isOn ? .bold : .semibold))
                .foregroundStyle(isOn ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity)
                .frame(height: 30)
                .background(isOn ? accent : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isClosed)
        .accessibilityIdentifier("scheduling.pollResponse.vote.\(value.rawValue)")
    }

    private var submitBar: some View {
        // Design StickyFooter is the primary "Submit response" button alone — no
        // answered-count line.
        FindATimePrimaryButton(
            title: "Submit response",
            icon: .send,
            isLoading: viewModel.isSubmitting,
            isEnabled: viewModel.allAnswered
        ) {
            await viewModel.submit()
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s3)
        .background(.ultraThinMaterial)
    }

    // MARK: Closed

    private var closedView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                organizerHeader
                closedBanner
                FindATimeOverline(text: "Proposed times", color: Theme.Color.appTextMuted)
                ForEach(viewModel.options) { option in
                    pollSlot(option)
                }
            }
            .padding(Spacing.s3)
        }
    }

    private var closedBanner: some View {
        // Design home-tone Banner (home-shell.jsx `Banner tone="home"`):
        //   bg  = H.bg50  -> successBg (the soft near-white green wash; the
        //         homeBg green-100 stop is one shade too saturated),
        //   bd  = H.bg200 -> homeBg (closest tonal-green token; the saturated
        //         pillar accent `home` is far too strong for a 1px hairline),
        //   ic  = H.accent -> home, title = H.accent700 -> homeDark, body = N.fg2.
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.checkCircle2, size: 15, color: Theme.Color.home)
            VStack(alignment: .leading, spacing: 2) {
                Text("This proposal closed")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.homeDark)
                Text(closedMessage)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.homeBg, lineWidth: 1)
        }
    }

    private var closedMessage: String {
        if let label = viewModel.finalizedLabel {
            return "\(viewModel.title) was booked for \(label). It's on the family calendar."
        }
        return "Voting is closed for this proposal."
    }

    // MARK: Submitted

    private var submittedView: some View {
        VStack(spacing: Spacing.s4) {
            ZStack {
                Circle().fill(Theme.Color.homeBg).frame(width: 84, height: 84)
                Circle().fill(Theme.Color.home).frame(width: 52, height: 52)
                Icon(.check, size: 28, strokeWidth: 3, color: Theme.Color.appTextInverse)
            }
            VStack(spacing: Spacing.s2) {
                Text("Response submitted")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("We'll let everyone know which times work for you.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 250)
            }
            FindATimePrimaryButton(title: "Done", icon: .check) { dismiss() }
                .padding(.top, Spacing.s2)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Loading

    private var loadingSkeleton: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(height: 64, cornerRadius: Radii.xl)
                ForEach(0..<3, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Shimmer(width: 140, height: 13, cornerRadius: Radii.xs)
                        Shimmer(height: 36, cornerRadius: Radii.lg)
                    }
                    .padding(Spacing.s4)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                }
            }
            .padding(Spacing.s3)
        }
    }

    private var actionErrorPresented: Binding<Bool> {
        Binding(
            get: { viewModel.actionError != nil },
            set: { if !$0 { viewModel.actionError = nil } }
        )
    }
}
