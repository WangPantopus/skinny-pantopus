//
//  ResourceDetailView.swift
//  Pantopus
//
//  Stream I12 — F11 Resource Detail / Booking Calendar. Header rules + the
//  resource's upcoming bookings (day-sectioned) + an approval queue, with a
//  sticky "Book this" CTA.
//

import SwiftUI

struct ResourceDetailView: View {
    @State private var viewModel: ResourceDetailViewModel

    init(viewModel: ResourceDetailViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                loadingBody
            case .loaded:
                loadedBody
            case let .error(message):
                errorBody(message)
            }
        }
        .background(Theme.Color.appBg)
        .navigationTitle(viewModel.resourceName.isEmpty ? "Resource" : viewModel.resourceName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if case .loaded = viewModel.state {
                    Button("Edit") { viewModel.edit() }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.home)
                        .accessibilityIdentifier("scheduling.resourceDetail.edit")
                }
            }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.resourceDetail")
        .task { await viewModel.load() }
        .alert("Couldn't update", isPresented: actionErrorPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.actionError ?? "")
        }
    }

    // MARK: Loaded

    private var loadedBody: some View {
        VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    headerCard
                    if viewModel.isFullyBooked {
                        fullyBookedBanner
                    }
                    if !viewModel.approvals.isEmpty {
                        approvalQueueCard
                    }
                    bookingsSection
                }
                .padding(Spacing.s3)
                .padding(.bottom, Spacing.s10)
            }
            .refreshable { await viewModel.refresh() }
            stickyFooter
        }
    }

    private var headerCard: some View {
        SectionCard {
            HStack(spacing: Spacing.s3) {
                Icon(viewModel.kind.icon, size: 23, color: Theme.Color.home)
                    .frame(width: 46, height: 46)
                    .background(Theme.Color.homeBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(viewModel.resourceName)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    TypeBadge(text: viewModel.kind.label)
                }
                Spacer()
            }
            if !viewModel.ruleChips.isEmpty {
                FlexChipRow(chips: viewModel.ruleChips)
            }
            if viewModel.pendingApprovalCount > 0 {
                pendingApprovalBadge
            }
        }
    }

    /// Amber "Pending approval (N)" badge button inside the header card
    /// (F11 approval-pending frame).
    private var pendingApprovalBadge: some View {
        Button {
            viewModel.openApprovalQueue()
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.clock, size: 15, color: Theme.Color.warning)
                Text("Pending approval (\(viewModel.pendingApprovalCount))")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.warning)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 15, color: Theme.Color.warning)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.warningBg)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.warningLight, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.resourceDetail.pendingApprovalBadge")
    }

    private var approvalQueueCard: some View {
        SectionCard {
            HStack(spacing: Spacing.s2) {
                Icon(.clock, size: 13, color: Theme.Color.warning)
                Text("Approval queue · \(viewModel.approvals.count)".uppercased())
                    .font(.system(size: 10.5, weight: .bold))
                    .tracking(0.6)
                    .foregroundStyle(Theme.Color.warning)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
            }
            VStack(spacing: Spacing.s3) {
                ForEach(Array(viewModel.approvals.enumerated()), id: \.element.id) { index, approval in
                    VStack(spacing: Spacing.s2) {
                        HStack(spacing: Spacing.s2) {
                            avatar(approval.member, fallback: approval.who)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(approval.who)
                                    .font(.system(size: 12.5, weight: .bold))
                                    .foregroundStyle(Theme.Color.appText)
                                Text(approval.when)
                                    .pantopusTextStyle(.caption)
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                            }
                            Spacer()
                        }
                        HStack(spacing: Spacing.s2) {
                            InlineHomeButton(title: "Approve", icon: .check, filled: true) {
                                Task { await viewModel.approve(approval.id) }
                            }
                            InlineHomeButton(title: "Decline", icon: .x, filled: false) {
                                Task { await viewModel.decline(approval.id) }
                            }
                        }
                    }
                    if index < viewModel.approvals.count - 1 {
                        Divider().background(Theme.Color.appBorder)
                    }
                }
            }
        }
    }

    @ViewBuilder private var bookingsSection: some View {
        // When the approval queue is shown above (F11 approval-pending frame),
        // the remaining list is the confirmed subset → label it "Confirmed";
        // otherwise the full upcoming list → "Upcoming bookings".
        let bookingsLabel = viewModel.approvals.isEmpty ? "Upcoming bookings" : "Confirmed"
        if viewModel.sections.isEmpty {
            ResourceOverlineLabel(text: bookingsLabel)
                .padding(.top, Spacing.s1)
            SectionCard {
                HStack(spacing: Spacing.s2) {
                    Icon(.calendar, size: 16, color: Theme.Color.appTextMuted)
                    Text("No upcoming bookings yet.")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Spacer()
                }
            }
        } else {
            ResourceOverlineLabel(text: bookingsLabel)
                .padding(.top, Spacing.s1)
            ForEach(viewModel.sections) { section in
                Text(section.title)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, Spacing.s1)
                ForEach(section.rows) { row in
                    bookingRow(row)
                }
            }
        }
    }

    private func bookingRow(_ row: ResourceDetailViewModel.BookingRowModel) -> some View {
        HStack(spacing: Spacing.s3) {
            Circle()
                .fill(row.isPending ? Theme.Color.warning : Theme.Color.success)
                .frame(width: 5, height: 5)
            VStack(alignment: .leading, spacing: 2) {
                Text(row.timeRange)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("For: \(row.who)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
            avatar(row.member, fallback: row.who, size: 26)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    @ViewBuilder private func avatar(_ member: ResourceHomeMember?, fallback: String, size: CGFloat = 30) -> some View {
        if let member {
            ResourceHomeMemberAvatar(member: member, size: size)
        } else {
            ResourceHomeMemberAvatar(member: ResourceHomeMember(id: fallback, name: fallback), size: size)
        }
    }

    /// Amber "Fully booked through …" banner (F11 fully-booked frame).
    private var fullyBookedBanner: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.calendarX, size: 15, strokeWidth: 2.2, color: Theme.Color.warning)
            VStack(alignment: .leading, spacing: 2) {
                Text(viewModel.fullyBookedThroughLabel ?? "Fully booked")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.warning)
                if let opening = viewModel.nextOpeningLabel {
                    Text("Next opening is \(opening). You can still book that.")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("scheduling.resourceDetail.fullyBookedBanner")
    }

    private var stickyFooter: some View {
        Group {
            if viewModel.isFullyBooked, let opening = viewModel.nextOpeningLabel {
                HomePrimaryButton(title: "Book next opening · \(opening)", icon: .calendarClock) {
                    viewModel.bookNextOpening()
                }
            } else {
                HomePrimaryButton(title: "Book this", icon: .plus) {
                    viewModel.bookThis()
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    // MARK: Loading / error

    private var loadingBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(height: 120, cornerRadius: Radii.lg)
                Shimmer(width: 140, height: 12)
                ForEach(0..<3, id: \.self) { _ in
                    Shimmer(height: 60, cornerRadius: Radii.lg)
                }
            }
            .padding(Spacing.s3)
        }
    }

    private func errorBody(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Icon(.cloudOff, size: 40, color: Theme.Color.error)
            Text("Couldn't load this resource")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            HomePrimaryButton(title: "Retry", icon: .refreshCw) {
                Task { await viewModel.load() }
            }
            .frame(maxWidth: 200)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var actionErrorPresented: Binding<Bool> {
        Binding(get: { viewModel.actionError != nil }, set: { if !$0 { viewModel.actionError = nil } })
    }
}

/// Wrapping row of rule chips (home-tone) for the resource header.
struct FlexChipRow: View {
    let chips: [ResourceDetailViewModel.RuleChipModel]

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 96), spacing: Spacing.s2)],
            alignment: .leading,
            spacing: Spacing.s2
        ) {
            ForEach(chips) { chip in
                RuleChip(icon: chip.icon, text: chip.text, tone: .home)
            }
        }
    }
}
