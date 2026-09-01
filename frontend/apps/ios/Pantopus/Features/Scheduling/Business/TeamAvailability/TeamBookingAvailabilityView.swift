//
//  TeamBookingAvailabilityView.swift
//  Pantopus
//
//  G3 Team Booking Availability (Stream I13). Business-pillar roster of who is
//  bookable + week coverage. Matches `teamavail-frames.jsx`. Member rows open
//  G4 (member hours: editable for yourself, read-only for teammates). A top-bar
//  assignment action opens the round-robin (G1) / collective (G2) sheets for a
//  chosen service (the canonical entry is the I2 event-type editor, not yet
//  built). Tokens only.
//

import SwiftUI

struct TeamBookingAvailabilityView: View {
    @State private var model: TeamBookingAvailabilityViewModel
    @Environment(\.dismiss) private var dismiss

    init(
        owner: SchedulingOwner,
        tz: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        _model = State(wrappedValue: TeamBookingAvailabilityViewModel(
            owner: owner, tz: tz, push: push, client: client
        ))
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            BizTopBar(title: "Booking availability", trailing: assignmentAction) { dismiss() }
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .task { await model.load() }
        .sheet(item: Binding(get: { model.memberSheet }, set: { model.memberSheet = $0 })) { target in
            MemberWorkingHoursSheet(
                mode: target.isSelf ? .editSelf : .readOnly(memberName: target.name),
                accent: model.accent,
                onNavigate: { route in
                    model.memberSheet = nil
                    model.push(route)
                },
                onClose: { model.memberSheet = nil }
            )
        }
        .sheet(isPresented: $model.showAssignmentPicker) {
            AssignmentPickerSheet(
                eventTypes: model.eventTypes,
                accent: model.accent,
                onSelect: { model.chooseAssignment($0) },
                onClose: { model.showAssignmentPicker = false }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(item: Binding(get: { model.assignmentTarget }, set: { model.assignmentTarget = $0 })) { target in
            if target.collective {
                CollectiveEventSetupSheet(owner: model.owner, eventTypeId: target.id) { model.assignmentTarget = nil }
            } else {
                RoundRobinAssignmentSheet(owner: model.owner, eventTypeId: target.id) { model.assignmentTarget = nil }
            }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
    }

    private var assignmentAction: AnyView? {
        guard model.hasAssignableServices, !model.isGated, case .loaded = model.phase else { return nil }
        return AnyView(
            Button { model.openAssignmentPicker() } label: {
                Icon(.slidersHorizontal, size: 19, color: Theme.Color.appText).frame(width: 36, height: 36)
            }
            .accessibilityLabel("Assignment")
        )
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            loadingBody
        case .loaded:
            loadedBody
        case .empty:
            EmptyState(
                icon: .usersRound,
                headline: "No team members yet",
                subcopy: "Invite teammates to your business to share bookings across the team.",
                tint: Theme.Color.businessBg,
                accent: Theme.Color.business
            )
        case .businessOnly:
            businessOnlyBody
        case let .error(message):
            errorBody(message)
        }
    }

    // MARK: Loaded

    private var loadedBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                BizNote(
                    tone: .info,
                    icon: .info,
                    text: "Bookings use each member's personal availability. Edit a member's hours to change when they can be booked."
                )

                VStack(alignment: .leading, spacing: Spacing.s2) {
                    BizOverline(text: "Team")
                    BizCard {
                        VStack(spacing: Spacing.s0) {
                            ForEach(Array(model.rows.enumerated()), id: \.element.id) { idx, row in
                                rosterRow(row)
                                if idx < model.rows.count - 1 { BizRowDivider() }
                            }
                        }
                    }
                }

                coverageView

                if model.isGated {
                    HStack(spacing: 7) {
                        Icon(.lock, size: 13, color: Theme.Color.appTextMuted)
                        Text("Only admins can change booking hours (team.manage).")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    .padding(.horizontal, Spacing.s1)
                }

                Color.clear.frame(height: Spacing.s6)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
        }
    }

    private func rosterRow(_ row: TeamBookingAvailabilityViewModel.MemberRow) -> some View {
        Button { model.tapMember(row) } label: {
            HStack(spacing: 11) {
                BizAvatar(name: row.name, tintKey: row.id, imageURL: row.avatarURL, size: 36)
                VStack(alignment: .leading, spacing: 1) {
                    Text(row.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(row.summary)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                    if row.usesPersonalHours {
                        BizChip(tone: .biz, icon: .user, text: "Personal hours")
                            .padding(.top, 5)
                    } else {
                        BizChip(tone: .neutral, icon: .building2, text: "Business hours")
                            .padding(.top, 5)
                    }
                }
                Spacer(minLength: Spacing.s2)
                if !model.isGated {
                    TeamBookableToggle(on: row.bookable)
                }
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.vertical, Spacing.s3)
            .opacity(row.bookable ? 1 : 0.55)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(row.name), \(row.summary), \(row.bookable ? "bookable" : "off")")
    }

    @ViewBuilder
    private var coverageView: some View {
        switch model.coverage {
        case let .ok(text):
            HStack(spacing: Spacing.s2) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Theme.Color.appSurfaceSunken)
                    Icon(.calendarX, size: 16, color: Theme.Color.appTextSecondary)
                }
                .frame(width: 32, height: 32)
                Text(text)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            .pantopusShadow(.sm)
        case let .warning(text):
            BizNote(tone: .warning, icon: .calendarX, text: text)
        case nil:
            EmptyView()
        }
    }

    // MARK: Loading

    private var loadingBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                BizNote(
                    tone: .info,
                    icon: .info,
                    text: "Bookings use each member's personal availability. Edit a member's hours to change when they can be booked."
                )
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    BizOverline(text: "Team")
                    BizCard {
                        VStack(spacing: Spacing.s0) {
                            ForEach(0..<4, id: \.self) { idx in
                                BizShimmerRow(showTrailingPill: true)
                                if idx < 3 { BizRowDivider() }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
        }
    }

    // MARK: Business-only / error

    private var businessOnlyBody: some View {
        EmptyState(
            icon: .building2,
            headline: "Switch to a business",
            subcopy: "Team booking availability is only available for business accounts with a team.",
            tint: Theme.Color.businessBg,
            accent: Theme.Color.business
        )
    }

    private func errorBody(_ message: String) -> some View {
        VStack(spacing: Spacing.s4) {
            Spacer()
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 64, height: 64)
                Icon(.cloudOff, size: 28, strokeWidth: 1.8, color: Theme.Color.appTextSecondary)
            }
            Text("Couldn't load your team").font(.system(size: 18, weight: .semibold)).foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Button { Task { await model.load() } } label: {
                HStack(spacing: 6) {
                    Icon(.refreshCw, size: 14, color: Theme.Color.appTextStrong)
                    Text("Try again").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appTextStrong)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, Spacing.s8)
        .background(Theme.Color.appBg)
    }
}

// MARK: - Bookable toggle

/// iOS 46×28 switch mirroring the design's `IToggle` (violet when on). Reflects
/// the member's derived bookability — the row tap opens G4, where the member's
/// hours (and thus bookability) are actually edited; the backend exposes no
/// per-member bookable WRITE, so this is a status indicator, not a control.
private struct TeamBookableToggle: View {
    let on: Bool

    var body: some View {
        ZStack(alignment: on ? .trailing : .leading) {
            Capsule()
                .fill(on ? Theme.Color.business : Theme.Color.appBorder)
                .frame(width: 46, height: 28)
            Circle()
                .fill(Theme.Color.appSurface)
                .frame(width: 24, height: 24)
                .padding(.horizontal, 2)
                .pantopusShadow(.sm)
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Assignment picker

/// Lightweight picker that lists the business's services so the owner can open
/// the round-robin (G1) / collective (G2) sheet for one. (Canonical entry is the
/// I2 event-type editor; this is the I13 local entry until that ships.)
struct AssignmentPickerSheet: View {
    let eventTypes: [EventTypeDTO]
    var accent: Color = Theme.Color.business
    let onSelect: (EventTypeDTO) -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            BizSheetHeader(title: "Assignment", subhead: "Choose a service to set how it assigns to members.", onClose: onClose)
            ScrollView {
                VStack(spacing: Spacing.s2) {
                    ForEach(eventTypes) { type in
                        Button { onSelect(type) } label: {
                            HStack(spacing: 11) {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(type.name).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                                    Text(Self.modeLabel(type.assignmentMode))
                                        .font(.system(size: 11)).foregroundStyle(Theme.Color.appTextSecondary)
                                }
                                Spacer(minLength: Spacing.s2)
                                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                            }
                            .padding(.horizontal, 13)
                            .padding(.vertical, Spacing.s3)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.Color.appSurface)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(
                                Theme.Color.appBorder,
                                lineWidth: 1
                            ))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s3)
            }
        }
        .background(Theme.Color.appBg)
    }

    private static func modeLabel(_ mode: String?) -> String {
        switch mode {
        case "collective": "Collective · everyone required"
        case "round_robin": "Round-robin"
        case "group": "Group event"
        default: "One-on-one"
        }
    }
}
