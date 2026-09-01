//
//  BookingPagePreviewView.swift
//  Pantopus
//
//  C2 Public Booking Page Preview · Stream I4. A read-only render of the
//  public /book/:slug page wrapped in dark "preview chrome" with an exit x.
//  The whole render is non-interactive (the "Pick a time" affordance is
//  shown but inert). Honest paused / all-hidden frames. Tokens only.
//

import SwiftUI

public struct BookingPagePreviewView: View {
    @State private var viewModel: BookingPagePreviewViewModel
    @Environment(\.dismiss) private var dismiss

    public init(owner: SchedulingOwner, slug: String) {
        _viewModel = State(initialValue: BookingPagePreviewViewModel(owner: owner, slug: slug))
    }

    init(viewModel: BookingPagePreviewViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            BookingPreviewBar { dismiss() }
            previewPill
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg.ignoresSafeArea())
        .background(Theme.Color.appText.ignoresSafeArea(edges: .top))
        .toolbar(.hidden, for: .navigationBar)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .accessibilityIdentifier("bookingPagePreview.screen")
    }

    private var previewPill: some View {
        HStack(spacing: 5) {
            Icon(.eyeOff, size: 11, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
            Text("Preview only. Nothing here is bookable.")
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .padding(.vertical, Spacing.s2)
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            PreviewLoadingView()
        case let .rendered(page, eventTypes):
            publicRender(page: page, eventTypes: eventTypes)
        case let .pageOff(page, status):
            PageOffNotice(page: page, status: status)
        case let .allHidden(page):
            AllHiddenNotice(page: page, accent: viewModel.theme.accent)
        case let .error(message):
            PreviewErrorView(message: message) { Task { await viewModel.refresh() } }
        }
    }

    // MARK: - Public render (non-interactive)

    private func publicRender(page: PublicPageView, eventTypes: [PublicEventTypeView]) -> some View {
        ScrollView {
            VStack(spacing: Spacing.s4) {
                PublicHeader(page: page, accent: viewModel.theme.accent)
                VStack(spacing: Spacing.s4) {
                    ForEach(Array(eventTypes.enumerated()), id: \.element.id) { index, eventType in
                        PublicEventTypeCard(
                            eventType: eventType,
                            isSelected: index == 0
                        )
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            // Clear the sticky "Pick a time" bar (design render bottom inset).
            .padding(.bottom, Spacing.s16 + Spacing.s5)
            .allowsHitTesting(false) // affordances are inert; the ScrollView still scrolls
        }
        // Sticky bottom CTA bar — translucent backdrop + top hairline, inert.
        .overlay(alignment: .bottom) {
            BookingMgmtStickyCTA()
                .allowsHitTesting(false)
        }
        .accessibilityIdentifier("bookingPagePreview.rendered")
    }
}

// MARK: - Preview chrome

private struct BookingPreviewBar: View {
    let onExit: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.eye, size: 16, color: Theme.Color.appTextInverse)
            // JSX PreviewBar label: fontSize 12.5 / weight 600.
            Text("Previewing your booking page")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
            Spacer()
            Button(action: onExit) {
                Icon(.x, size: 15, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    .frame(width: 26, height: 26)
                    .background(Theme.Color.appTextInverse.opacity(0.12))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Exit preview")
            .accessibilityIdentifier("bookingPagePreview.exit")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appText)
    }
}

// MARK: - Public header

private struct PublicHeader: View {
    let page: PublicPageView
    let accent: Color

    var body: some View {
        VStack(spacing: Spacing.s1) {
            BookingPageAvatar(name: page.title ?? "Host", imageURLString: page.avatarURL, size: 64, accent: accent)
                .padding(.bottom, Spacing.s1)
            // JSX PublicHeader name: fontSize 18 / weight 700 (not h3=20).
            Text(page.title ?? "Host")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            if let tagline = page.tagline, !tagline.isEmpty {
                // JSX headline: fontSize 12.5 / weight 600 / color blue700.
                Text(tagline)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary700)
                    .multilineTextAlignment(.center)
            }
            if let intro = page.intro, !intro.isEmpty {
                Text(intro)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 230)
                    .padding(.top, Spacing.s1)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Event-type card

private struct PublicEventTypeCard: View {
    let eventType: PublicEventTypeView
    var isSelected: Bool = false

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Icon(
                BookingLocationMode.icon(eventType.locationMode),
                size: 18,
                // JSX unselected tile glyph uses fg2 (appTextStrong), not fg3.
                color: isSelected ? Theme.Color.primary600 : Theme.Color.appTextStrong
            )
            .frame(width: 38, height: 38)
            .background(isSelected ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: Spacing.s1) {
                // JSX event-type name: fontSize 14 / weight 600 (not body=16).
                Text(eventType.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                HStack(spacing: Spacing.s2) {
                    BookingMgmtDurationLabel(eventType: eventType)
                    LocationChip(mode: eventType.locationMode)
                }
            }
            Spacer(minLength: Spacing.s2)
            Icon(.chevronRight, size: 18, color: Theme.Color.appTextMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        // JSX selected border + ring are fixed sky (blue600), not the pillar
        // accent — the public render uses brand sky regardless of owner pillar.
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(isSelected ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: isSelected ? 1.5 : 1)
        )
        // 3px sky ring on the selected card (design boxShadow ring).
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.primary600.opacity(0.10), lineWidth: 3)
                .opacity(isSelected ? 1 : 0)
        )
        .pantopusShadow(.sm)
    }
}

private struct BookingMgmtDurationLabel: View {
    let eventType: PublicEventTypeView
    var body: some View {
        // JSX duration line: fontSize 11.5 / weight 500 / color fg3, gap 4, clock 11.
        HStack(spacing: Spacing.s1) {
            Icon(.clock, size: 11, color: Theme.Color.appTextSecondary)
            Text(BookingDuration.label(eventType.defaultDuration ?? eventType.durations?.first ?? 30))
                .font(.system(size: 11.5, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }
}

private struct LocationChip: View {
    let mode: String?

    var body: some View {
        // JSX ModeChip: gap 4, icon 10 / strokeWidth 2.4, padding 3px 8px.
        HStack(spacing: Spacing.s1) {
            Icon(BookingLocationMode.icon(mode), size: 10, strokeWidth: 2.4, color: Theme.Color.primary700)
            Text(BookingLocationMode.label(mode))
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.primary700)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }
}

/// Sticky bottom "Pick a time" CTA — translucent backdrop, top hairline, a
/// sky-filled 44pt button with a trailing arrow. Inert in preview. JSX fixes
/// the button to blue600 (brand sky), independent of the owner pillar.
private struct BookingMgmtStickyCTA: View {
    var body: some View {
        HStack(spacing: 7) {
            Text("Pick a time")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
            Icon(.arrowRight, size: 16, color: Theme.Color.appTextInverse)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 44)
        .background(Theme.Color.primary600)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .pantopusShadow(.primary)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s4)
        .frame(maxWidth: .infinity)
        .background(alignment: .top) {
            ZStack(alignment: .top) {
                Rectangle().fill(.thinMaterial)
                Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            }
            .ignoresSafeArea(edges: .bottom)
        }
    }
}

// MARK: - Off / empty / loading / error

private struct PageOffNotice: View {
    let page: PublicPageView
    let status: SchedulingStatus

    var body: some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 60, height: 60)
                Icon(icon, size: 26, strokeWidth: 1.75, color: Theme.Color.appTextSecondary)
            }
            // JSX NoticeCard title: fontSize 16 / weight 600.
            Text(headline)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            // JSX NoticeCard body: fontSize 12.5 / color fg3 / maxWidth 220.
            Text(caption)
                .font(.system(size: 12.5, weight: .regular))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 220)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("bookingPagePreview.pageOff")
    }

    /// JSX FramePaused uses `moon` for the paused state; expired/unavailable
    /// are honest extra states for the same notice card.
    private var icon: PantopusIcon {
        switch status {
        case .expired: .calendarClock
        case .unavailable: .calendarCheck
        default: .moon
        }
    }

    private var headline: String {
        switch status {
        case .expired: "This link has expired"
        case .unavailable: "Fully booked right now"
        default: "Your page is paused"
        }
    }

    private var caption: String {
        switch status {
        case .expired: "Generate a fresh link to keep taking bookings."
        case .unavailable: "There are no open times at the moment."
        default: "Turn it back on in Booking link to take bookings."
        }
    }
}

private struct AllHiddenNotice: View {
    let page: PublicPageView
    let accent: Color

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.s4) {
                PublicHeader(page: page, accent: accent)
                VStack(spacing: Spacing.s2) {
                    // JSX FrameHidden tile glyph is `calendar-off`.
                    Icon(.calendarOff, size: 20, strokeWidth: 1.9, color: Theme.Color.appTextSecondary)
                        .frame(width: 42, height: 42)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    // JSX: fontSize 14 / weight 600.
                    Text("No services are visible yet")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Turn one on so people see something to book.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 210)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s6)
                .padding(.horizontal, Spacing.s5)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .stroke(
                            Theme.Color.appBorderStrong,
                            style: StrokeStyle(lineWidth: 1, dash: [4])
                        )
                )
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
        }
        .accessibilityIdentifier("bookingPagePreview.allHidden")
    }
}

private struct PreviewLoadingView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.s4) {
                // Centered header skeleton (avatar + two text bars).
                VStack(spacing: Spacing.s2) {
                    Shimmer(width: 64, height: 64, cornerRadius: Radii.pill)
                    Shimmer(width: 150, height: 16)
                    Shimmer(width: 110, height: 12)
                }
                .frame(maxWidth: .infinity)
                ForEach(0..<3, id: \.self) { _ in
                    Shimmer(height: 64, cornerRadius: Radii.xl)
                }
            }
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("bookingPagePreview.loading")
    }
}

private struct PreviewErrorView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load this page")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            PrimaryButton(title: "Try again") { await MainActor.run { retry() } }
                .frame(maxWidth: 240)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("bookingPagePreview.error")
    }
}

#if DEBUG
#Preview("Rendered") {
    let viewModel = BookingPagePreviewViewModel(owner: .personal, slug: "maria-k")
    viewModel.setStateForPreview(
        .rendered(page: BookingPageSampleData.publicView.page, eventTypes: BookingPageSampleData.publicView.eventTypes)
    )
    return BookingPagePreviewView(viewModel: viewModel)
}

#Preview("Paused") {
    let viewModel = BookingPagePreviewViewModel(owner: .personal, slug: "maria-k")
    viewModel.setStateForPreview(.pageOff(page: BookingPageSampleData.pausedPublicView.page, status: .paused))
    return BookingPagePreviewView(viewModel: viewModel)
}
#endif
