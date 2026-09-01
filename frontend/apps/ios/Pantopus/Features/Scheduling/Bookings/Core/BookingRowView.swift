//
//  BookingRowView.swift
//  Pantopus
//
//  Stream I8 — the E1 inbox booking row: verified pillar avatar, invitee + event
//  + tz-aware time, the Foundation status pill, an owner glyph, and a kebab
//  overflow menu. Pending rows add an inline Decline / Approve footer for the
//  quick-action path. Tokens only.
//

import SwiftUI

/// One overflow-menu action for a booking row / detail screen. The handler is
/// `@MainActor` because it drives the (MainActor) view-model directly.
struct BookingRowAction: Identifiable {
    let id = UUID()
    let title: String
    let icon: PantopusIcon
    var isDestructive = false
    let handler: @MainActor () -> Void
}

/// A verified, pillar-tinted avatar circle with up to two initials.
struct BookingAvatar: View {
    let ownerType: String?
    let name: String?
    var size: CGFloat = 34

    private var colors: [Color] {
        switch BookingsPillar.owner(forType: ownerType) {
        case .home: [Theme.Color.home, Theme.Color.homeDark]
        case .business: [Theme.Color.business, Theme.Color.businessDark]
        case .personal: [Theme.Color.primary400, Theme.Color.primary700]
        }
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
                .frame(width: size, height: size)
                .clipShape(Circle())
                .overlay(
                    Text(BookingsAvatar.initials(from: name))
                        .font(.system(size: size * 0.34, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                )
            Icon(.badgeCheck, size: size * 0.42, color: BookingsPillar.accent(forType: ownerType))
                .background(Circle().fill(Theme.Color.appSurface).frame(width: size * 0.46, height: size * 0.46))
                .offset(x: 2, y: 2)
        }
        .accessibilityHidden(true)
    }
}

/// A small dot + owner label ("● Personal" / "● Home" / "● Business").
struct BookingOwnerGlyph: View {
    let ownerType: String?

    var body: some View {
        let accent = BookingsPillar.accent(forType: ownerType)
        HStack(spacing: Spacing.s1) {
            Circle().fill(accent).frame(width: 6, height: 6)
            Text(BookingsPillar.label(forType: ownerType))
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(accent)
        }
        .accessibilityLabel(BookingsPillar.label(forType: ownerType))
    }
}

struct BookingRowView: View {
    let booking: BookingDTO
    /// Resolved event-type name (the list endpoint omits it; the inbox supplies
    /// it from a best-effort event-types map). Nil hides the subtitle.
    var eventName: String?
    var showQuickActions = false
    let onTap: () -> Void
    var onApprove: (() -> Void)?
    var onDecline: (() -> Void)?
    var actions: [BookingRowAction] = []

    var body: some View {
        VStack(spacing: showQuickActions ? Spacing.s3 : Spacing.s0) {
            Button(action: onTap) { rowBody }
                .buttonStyle(.plain)
            if showQuickActions {
                quickActions
            }
        }
        .padding(Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .fill(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                )
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("scheduling.bookingRow")
    }

    private var rowBody: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            BookingAvatar(ownerType: booking.ownerType, name: booking.inviteeName)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s1) {
                    if showQuickActions {
                        Circle().fill(Theme.Color.warning).frame(width: 7, height: 7)
                    }
                    Text(booking.inviteeName ?? "Guest")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                }
                if let eventName {
                    Text(eventName)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Text(BookingsTime.relativeWhen(startUTC: booking.startAt))
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.top, 1)
                BookingOwnerGlyph(ownerType: booking.ownerType)
                    .padding(.top, Spacing.s1)
            }
            Spacer(minLength: Spacing.s2)
            VStack(alignment: .trailing, spacing: Spacing.s2) {
                SchedulingStatusPill(status: booking.status)
                if !actions.isEmpty {
                    overflowMenu
                }
            }
        }
        .contentShape(Rectangle())
    }

    private var overflowMenu: some View {
        Menu {
            ForEach(actions) { action in
                Button(role: action.isDestructive ? .destructive : nil) {
                    action.handler()
                } label: {
                    Label { Text(action.title) } icon: { Icon(action.icon, size: 16) }
                }
            }
        } label: {
            Icon(.moreVertical, size: 18, color: Theme.Color.appTextMuted)
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
        .accessibilityLabel("More actions")
    }

    private var quickActions: some View {
        HStack(spacing: Spacing.s2) {
            Button { onDecline?() } label: {
                HStack(spacing: Spacing.s1) {
                    Icon(.x, size: 14, color: Theme.Color.appTextSecondary)
                    Text("Decline").font(.system(size: 13, weight: .bold))
                }
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, minHeight: 36)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("scheduling.bookingRow.decline")
            Button { onApprove?() } label: {
                HStack(spacing: Spacing.s1) {
                    Icon(.check, size: 14, color: Theme.Color.appTextInverse)
                    Text("Approve").font(.system(size: 13, weight: .bold))
                }
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity, minHeight: 36)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("scheduling.bookingRow.approve")
        }
        .padding(.top, Spacing.s3)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }
}

#if DEBUG
#Preview {
    ScrollView {
        VStack(spacing: Spacing.s2) {
            BookingRowView(
                booking: .preview(status: "confirmed", ownerType: "user"),
                eventName: "30-min intro call",
                onTap: {},
                actions: [BookingRowAction(title: "View details", icon: .arrowUpRight) {}]
            )
            BookingRowView(
                booking: .preview(status: "pending", ownerType: "business"),
                eventName: "Studio consultation",
                showQuickActions: true,
                onTap: {},
                onApprove: {},
                onDecline: {}
            )
        }
        .padding()
    }
    .background(Theme.Color.appBg)
}
#endif
