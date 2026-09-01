//
//  BookingDetailSections.swift
//  Pantopus
//
//  E2 Booking Detail (Stream I8) — the section cards, status banners, status
//  timeline, location presentation, and card chrome, split out of
//  `BookingDetailView.swift` as an extension. View-model access is read-only.
//

import SwiftUI

extension BookingDetailView {
    // MARK: - Status banners

    @ViewBuilder
    func statusBanner(_ booking: BookingDTO) -> some View {
        switch viewModel.status {
        case .cancelled, .declined:
            VStack(spacing: Spacing.s2) {
                // Design frame 4: "Cancelled by host on Jun 11 · '<reason>'"
                // (circle-slash, neutral sunken chip).
                banner(viewModel.cancelledBannerText, icon: .circleSlash, tone: .neutral)
                if booking.refundIssued == true {
                    refundLine
                }
            }
        case .noShow:
            // Design frame 5: "Marked no-show · <name> didn't attend" (user-x).
            banner(noShowBannerText, icon: .userX, tone: .error)
        case .completed, .past:
            // Design frame 3: blue "Send a follow-up" promo (sparkles), not a
            // success "complete" line.
            followUpPromoBanner
        default:
            EmptyView()
        }
    }

    /// "Marked no-show · <first name> didn't attend" — design no-show banner.
    var noShowBannerText: String {
        let first = (viewModel.booking?.inviteeName ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(separator: " ")
            .first
            .map(String.init)
        if let first, !first.isEmpty {
            return "Marked no-show · \(first) didn't attend"
        }
        return "Marked no-show · the invitee didn't attend"
    }

    /// Design frame 3 — blue `sparkles` promo above the past-booking dock.
    var followUpPromoBanner: some View {
        let first = (viewModel.booking?.inviteeName ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(separator: " ")
            .first
            .map(String.init)
        let subject = first.flatMap { $0.isEmpty ? nil : $0 } ?? "them"
        return HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.sparkles, size: 16, color: Theme.Color.primary600)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 2) {
                Text("Send a follow-up")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Thank \(subject) and offer a time to book again.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.primary50)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.primary200, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    var refundLine: some View {
        detailCard(overline: "Refund", icon: .receipt) {
            HStack {
                Text("Refunded to card")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                Text("Issued")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.success)
            }
        }
    }

    // MARK: - Section cards

    /// Design uses "Requester" while a booking is live (confirmed/pending) and
    /// "Attendee" once it's in a terminal/past state (frames 3/4/5).
    var requesterOverline: String {
        switch viewModel.status {
        case .completed, .past, .noShow, .cancelled, .declined: "Attendee"
        default: "Requester"
        }
    }

    func requesterCard(_ booking: BookingDTO) -> some View {
        detailCard(overline: requesterOverline, icon: .user) {
            HStack(spacing: Spacing.s3) {
                BookingAvatar(ownerType: booking.ownerType, name: booking.inviteeName, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(booking.inviteeName ?? "Guest")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    if let email = booking.inviteeEmail {
                        Text(email)
                            .font(.system(size: 11.5))
                            .foregroundStyle(Theme.Color.appTextMuted)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: Spacing.s0)
                // Design `AttendeeRow`: trailing 36×36 outlined `message-circle`
                // icon button in the brand blue. Routes to the (deferred) message
                // handler.
                Button { viewModel.message() } label: {
                    Icon(.messageCircle, size: 17, color: Theme.Color.primary600)
                        .frame(width: 36, height: 36)
                        .background(Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Message")
                .accessibilityIdentifier("scheduling.bookingDetail.message")
            }
        }
    }

    @ViewBuilder
    var locationCard: some View {
        if let label = locationLabel {
            detailCard(overline: "Location", icon: locationIcon) {
                infoRow(icon: locationIcon, value: label.title, sub: label.detail)
            }
        }
    }

    @ViewBuilder
    func assignedMemberCard(_ booking: BookingDTO) -> some View {
        if viewModel.canReassign, booking.hostUserId != nil {
            detailCard(overline: "Assigned member", icon: .userRound) {
                HStack(spacing: Spacing.s3) {
                    ZStack {
                        Circle().fill(viewModel.owner.theme.accentBg).frame(width: 30, height: 30)
                        Icon(.userRound, size: 15, color: viewModel.accent)
                    }
                    Text("Team member")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer()
                    Button { viewModel.presentReschedule() } label: {
                        Text("Reassign")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(viewModel.accent)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("scheduling.bookingDetail.reassign")
                }
            }
        }
    }

    @ViewBuilder
    func intakeCard(_ booking: BookingDTO) -> some View {
        if booking.intakeAnswers?.dictValue?.isEmpty == false {
            detailCardPlain {
                IntakeAnswersDisclosure(answers: booking.intakeAnswers)
            }
        }
    }

    var timelineCard: some View {
        detailCard(overline: "Status", icon: .activity) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                ForEach(Array(viewModel.timelineSteps.enumerated()), id: \.element.id) { index, step in
                    HStack(alignment: .top, spacing: Spacing.s3) {
                        VStack(spacing: 0) {
                            ZStack {
                                Circle()
                                    .fill(step.done ? Theme.Color.success : Theme.Color.appSurface)
                                    .frame(width: 18, height: 18)
                                if step.done {
                                    Icon(.check, size: 11, strokeWidth: 3, color: Theme.Color.appTextInverse)
                                } else {
                                    Circle().strokeBorder(Theme.Color.appBorderStrong, lineWidth: 2).frame(width: 18, height: 18)
                                }
                            }
                            if index < viewModel.timelineSteps.count - 1 {
                                Rectangle()
                                    .fill(step.done ? Theme.Color.successLight : Theme.Color.appBorder)
                                    .frame(width: 2, height: 22)
                            }
                        }
                        VStack(alignment: .leading, spacing: 1) {
                            Text(step.label)
                                .font(.system(size: 12.5, weight: .semibold))
                                .foregroundStyle(step.done ? Theme.Color.appText : Theme.Color.appTextMuted)
                            if let time = step.time {
                                Text(time)
                                    .font(.system(size: 10.5))
                                    .foregroundStyle(Theme.Color.appTextMuted)
                            }
                        }
                        .padding(.bottom, index < viewModel.timelineSteps.count - 1 ? Spacing.s2 : 0)
                        Spacer(minLength: Spacing.s0)
                    }
                }
            }
        }
    }

    // MARK: - Card helpers

    func detailCard(overline: String, icon: PantopusIcon, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            BookingOverline(icon: icon, text: overline, accent: viewModel.accent)
            content()
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardBackground)
    }

    func detailCardPlain(@ViewBuilder content: () -> some View) -> some View {
        content()
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(cardBackground)
    }

    var cardBackground: some View {
        RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
            .fill(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
            )
    }

    func infoRow(icon: PantopusIcon, value: String, sub: String?) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(icon, size: 16, color: viewModel.accent)
                .frame(width: 34, height: 34)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(value)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                if let sub {
                    Text(sub)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    // MARK: - Banner / states

    enum BannerTone { case error, neutral, success, info }

    func banner(_ message: String, icon: PantopusIcon = .alertCircle, tone: BannerTone) -> some View {
        let fg: Color
        let bg: Color
        switch tone {
        case .error: fg = Theme.Color.error
            bg = Theme.Color.errorBg
        case .neutral: fg = Theme.Color.appTextSecondary
            bg = Theme.Color.appSurfaceSunken
        case .success: fg = Theme.Color.success
            bg = Theme.Color.successBg
        case .info: fg = Theme.Color.primary600
            bg = Theme.Color.primary50
        }
        return HStack(spacing: Spacing.s2) {
            Icon(icon, size: 16, color: fg)
            Text(message)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(fg)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(bg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    // MARK: - Location presentation

    var locationLabel: (title: String, detail: String?)? {
        switch (viewModel.locationMode ?? "").lowercased() {
        case "video", "google_meet", "zoom", "meet", "teams":
            ("Pantopus Video", "Video call · link sent on confirm")
        case "in_person", "in-person", "inperson":
            ("In person", "Location shared with the invitee")
        case "phone", "phone_call":
            ("Phone call", "We'll connect you at the scheduled time")
        case "":
            nil
        default:
            ("Custom", nil)
        }
    }

    var locationIcon: PantopusIcon {
        switch (viewModel.locationMode ?? "").lowercased() {
        case "video", "google_meet", "zoom", "meet", "teams": .video
        case "in_person", "in-person", "inperson": .mapPin
        case "phone", "phone_call": .phone
        default: .calendar
        }
    }
}
