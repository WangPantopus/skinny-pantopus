//
//  BookingLandingView.swift
//  Pantopus
//
//  C5 Booking Landing / Booker Profile (Stream I5). Public, full-screen invitee
//  landing built to the Calendarly design: a host-pillar gradient banner with an
//  overlapping avatar + verified check + share action, a pillar-colored headline,
//  an "Open in app" banner, a "Book a time" event-type list, and a
//  view-profile / Powered-by footer. Renders loading / loaded / paused / empty /
//  error, wrapped in the offline banner. Tapping an event type hands off to C6.
//

import SwiftUI

// swiftlint:disable:next type_body_length
struct BookingLandingView: View {
    @State private var viewModel: BookingLandingViewModel
    @State private var openInAppDismissed = false
    @Environment(\.dismiss) private var dismiss

    init(viewModel: BookingLandingViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .background(Theme.Color.appBg)
            .navigationBarBackButtonHidden(true)
            .toolbar(.hidden, for: .navigationBar)
            .task { await viewModel.load() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("scheduling.bookingLanding")
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingScroll
        case let .loaded(view):
            landing(view.page) {
                if view.eventTypes.count > 1, !openInAppDismissed { openInAppBanner }
                eventTypeSection(view.eventTypes, single: view.eventTypes.count == 1)
            }
        case let .paused(view):
            landing(view.page) { pausedCard(hostFirstName(view.page)) }
        case let .empty(view):
            landing(view.page) { emptyCard(hostFirstName(view.page)) }
        case let .error(message):
            errorScroll(message)
        }
    }

    // MARK: - Landing scaffold (banner + header + middle + footer)

    private func landing(_ page: PublicPageView, @ViewBuilder middle: () -> some View) -> some View {
        let ownerType = page.ownerType
        return ScrollView {
            VStack(spacing: Spacing.s0) {
                banner(ownerType)
                VStack(spacing: Spacing.s3) {
                    headerCard(page, ownerType: ownerType)
                    middle()
                    footer(hostFirstName(page))
                }
                .padding(.horizontal, 14)
                .padding(.top, -34) // overlap the banner
            }
        }
        .ignoresSafeArea(edges: .top)
        .overlay(alignment: .topLeading) { backButton }
    }

    private func banner(_ ownerType: String?) -> some View {
        LinearGradient(
            colors: DiscoveryTheme.bannerColors(forOwnerType: ownerType),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .frame(height: 96 + 44) // extend under the status bar
        .frame(maxWidth: .infinity)
    }

    // MARK: - Header card

    private func headerCard(_ page: PublicPageView, ownerType: String?) -> some View {
        let accent = DiscoveryTheme.accent(forOwnerType: ownerType)
        return VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(alignment: .top) {
                HostAvatar(
                    urlString: page.avatarURL,
                    initials: String((page.title ?? "·").prefix(2)),
                    colors: DiscoveryTheme.avatarColors(forOwnerType: ownerType)
                )
                .offset(y: -36)
                .padding(.bottom, -28)
                Spacer(minLength: Spacing.s0)
                shareButton
            }
            Text(page.title ?? "Booking")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .padding(.top, Spacing.s2)
            if let tagline = page.tagline, !tagline.isEmpty {
                Text(tagline)
                    .pantopusTextStyle(.small)
                    .fontWeight(.semibold)
                    .foregroundStyle(accent)
                    .padding(.top, Spacing.s1)
            }
            if let intro = page.intro, !intro.isEmpty {
                Text(intro)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .padding(.top, Spacing.s2)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(card())
    }

    private var shareButton: some View {
        Button {} label: {
            Icon(.share, size: 15, color: Theme.Color.appTextStrong)
                .frame(width: 32, height: 32)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Share")
    }

    // MARK: - Open-in-app banner

    private var openInAppBanner: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.smartphone, size: 16, color: Theme.Color.primary600)
                .frame(width: 30, height: 30)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            Text("Get a faster booking experience")
                .pantopusTextStyle(.caption)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {} label: {
                Text("Open")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            Button { openInAppDismissed = true } label: {
                Icon(.x, size: 14, color: Theme.Color.appTextMuted)
                    .frame(width: 22, height: 22)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.primary50)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.primary100, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    // MARK: - Event-type list

    private func eventTypeSection(_ eventTypes: [PublicEventTypeView], single: Bool) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionLabel("Book a time")
            ForEach(eventTypes) { eventType in
                EventTypeCardRow(eventType: eventType) { viewModel.selectEventType(eventType) }
            }
            if single {
                inlineNote("Going straight to pick a time.")
            }
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .pantopusTextStyle(.overline)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.horizontal, Spacing.s1)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func inlineNote(_ text: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.arrowRightCircle, size: 14, color: Theme.Color.primary600)
            Text(text)
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.primary700)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.primary50)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.primary100, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    // MARK: - Calm state cards (paused / empty)

    private func pausedCard(_ firstName: String) -> some View {
        DiscoveryNotice(
            icon: .moon,
            title: "This page isn't taking bookings right now",
            message: "Check back later, or reach out to \(firstName) directly."
        )
    }

    private func emptyCard(_ firstName: String) -> some View {
        DiscoveryNotice(
            icon: .calendarOff,
            title: "No times are set up yet",
            message: "\(firstName) hasn't added any availability. Check back soon.",
            dashed: true,
            iconRounded: true
        )
    }

    // MARK: - Footer

    private func footer(_ firstName: String) -> some View {
        VStack(spacing: Spacing.s3) {
            if !firstName.isEmpty {
                Button {} label: {
                    HStack(spacing: Spacing.s1) {
                        Text("View \(firstName)'s profile")
                            .pantopusTextStyle(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(Theme.Color.primary600)
                        Icon(.arrowUpRight, size: 13, strokeWidth: 2.4, color: Theme.Color.primary600)
                    }
                }
                .buttonStyle(.plain)
            }
            HStack(spacing: Spacing.s1) {
                Icon(.calendarClock, size: 12, color: Theme.Color.appTextMuted)
                Text("Powered by Pantopus")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s5)
        .padding(.bottom, Spacing.s6)
    }

    // MARK: - Loading + error

    private var loadingScroll: some View {
        ScrollView {
            VStack(spacing: Spacing.s0) {
                Color(Theme.Color.appSurfaceSunken)
                    .frame(height: 96 + 44)
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    VStack(alignment: .leading, spacing: Spacing.s0) {
                        Circle().fill(Theme.Color.appSurfaceSunken)
                            .frame(width: 64, height: 64)
                            .offset(y: -36)
                            .padding(.bottom, -28)
                        Shimmer(width: 150, height: 16).padding(.top, Spacing.s3)
                        Shimmer(width: 120, height: 12).padding(.top, Spacing.s2)
                        Shimmer(height: 11).padding(.top, Spacing.s2)
                    }
                    .padding(14)
                    .background(card())
                    ForEach(0..<3, id: \.self) { _ in Shimmer(height: 64, cornerRadius: Radii.xl) }
                }
                .padding(.horizontal, 14)
                .padding(.top, -34)
            }
        }
        .ignoresSafeArea(edges: .top)
        .accessibilityLabel("Loading booking page")
    }

    private func errorScroll(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer(minLength: Spacing.s0)
            Icon(.link2Off, size: 26, strokeWidth: 1.75, color: Theme.Color.appTextSecondary)
                .frame(width: 60, height: 60)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Circle())
            Text(message)
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text("It may have been turned off or moved. Double-check the link with whoever sent it.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 240)
            Button { Task { await viewModel.refresh() } } label: {
                Text("Try again").pantopusTextStyle(.small).fontWeight(.bold).foregroundStyle(Theme.Color.primary600)
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.s2)
            Spacer(minLength: Spacing.s0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s8)
        .overlay(alignment: .topLeading) { backButton }
    }

    // MARK: - Shared chrome

    private var backButton: some View {
        Button { dismiss() } label: {
            Icon(.chevronLeft, size: 18, color: Theme.Color.appText)
                .frame(width: 34, height: 34)
                .background(Theme.Color.appSurface)
                .clipShape(Circle())
                .shadow(color: .black.opacity(0.12), radius: 4, y: 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Back")
        .padding(.leading, Spacing.s4)
        .padding(.top, Spacing.s2)
    }

    private func card() -> some View {
        RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
            .fill(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
            )
    }

    private func hostFirstName(_ page: PublicPageView) -> String {
        DiscoveryTheme.firstName(from: page.title)
    }
}

// MARK: - Host avatar

private struct HostAvatar: View {
    let urlString: String?
    let initials: String
    let colors: [Color]

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
                if let urlString, let url = URL(string: urlString) {
                    AsyncImage(url: url) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        initialsText
                    }
                } else {
                    initialsText
                }
            }
            .frame(width: 64, height: 64)
            .clipShape(Circle())
            .overlay(Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 3))

            verifiedCheck
                .offset(x: 2, y: 2)
        }
    }

    private var initialsText: some View {
        Text(initials)
            .font(.system(size: 23, weight: .bold))
            .foregroundStyle(Theme.Color.appTextInverse)
    }

    private var verifiedCheck: some View {
        Icon(.check, size: 10, strokeWidth: 4, color: Theme.Color.appTextInverse)
            .frame(width: 18, height: 18)
            .background(Theme.Color.success)
            .clipShape(Circle())
            .overlay(Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 2.5))
    }
}

// MARK: - Event-type card row

struct EventTypeCardRow: View {
    let eventType: PublicEventTypeView
    let action: () -> Void

    private var durationLabel: String? {
        (eventType.defaultDuration ?? eventType.durations?.first).map { "\($0) min" }
    }

    private var locationLabel: String? {
        DiscoveryLocation.label(mode: eventType.locationMode, detail: eventType.locationDetail)
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(DiscoveryLocation.icon(mode: eventType.locationMode), size: 18, color: Theme.Color.appTextStrong)
                    .frame(width: 38, height: 38)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(eventType.name)
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: Spacing.s2) {
                        if let durationLabel {
                            HStack(spacing: Spacing.s1) {
                                Icon(.clock, size: 11, color: Theme.Color.appTextSecondary)
                                Text(durationLabel)
                                    .pantopusTextStyle(.caption)
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                            }
                        }
                        if let locationLabel {
                            modeChip(locationLabel, icon: DiscoveryLocation.icon(mode: eventType.locationMode))
                        }
                    }
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 18, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .fill(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                            .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel([eventType.name, durationLabel, locationLabel].compactMap { $0 }.joined(separator: ", "))
        .accessibilityIdentifier("scheduling.bookingLanding.eventType")
    }

    private func modeChip(_ text: String, icon: PantopusIcon) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(icon, size: 10, strokeWidth: 2.4, color: Theme.Color.primary700)
            Text(text)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.primary700)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }
}

#if DEBUG
#Preview("Loaded") {
    NavigationStack { BookingLandingView(viewModel: .previewLoaded()) }
}

#Preview("Paused") {
    NavigationStack { BookingLandingView(viewModel: .previewPaused()) }
}

#Preview("Empty") {
    NavigationStack { BookingLandingView(viewModel: .previewEmpty()) }
}

#Preview("Error") {
    NavigationStack { BookingLandingView(viewModel: .previewError()) }
}
#endif
