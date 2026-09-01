//
//  HomeCalendarCreateMenu.swift
//  Pantopus
//
//  Stream I10 — the Home Calendar FAB "create" menu. A bottom sheet that fans
//  out into Add event · Find a time · Book a resource · Schedule a visit.
//  Lifted from `home-calendar-frames.jsx` (`FrameCreateMenu`).
//

import SwiftUI

/// One create-menu action. "Add event" stays in this stream; the rest fan out
/// to other streams' screens (presented locally through the router).
public enum HomeCreateAction: CaseIterable, Hashable {
    case addEvent
    case findATime
    case bookResource
    case scheduleVisit

    var icon: PantopusIcon {
        switch self {
        case .addEvent: .calendarPlus
        case .findATime: .users
        case .bookResource: .package
        case .scheduleVisit: .doorOpen
        }
    }

    var title: String {
        switch self {
        case .addEvent: "Add event"
        case .findATime: "Find a time"
        case .bookResource: "Book a resource"
        case .scheduleVisit: "Schedule a visit"
        }
    }

    var subtitle: String {
        switch self {
        case .addEvent: "A one-off or repeating event"
        case .findATime: "Pick a slot that works for everyone"
        case .bookResource: "Guest room, EV charger, tools"
        case .scheduleVisit: "Offer a vendor or guest a window"
        }
    }
}

/// The create-menu sheet content (presented via `.sheet`).
struct HomeCalendarCreateMenu: View {
    let onSelect: @MainActor (HomeCreateAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("Create")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s2)
                .padding(.top, Spacing.s2)
                .padding(.bottom, Spacing.s2)
            ForEach(HomeCreateAction.allCases, id: \.self) { action in
                Button {
                    onSelect(action)
                } label: {
                    HStack(spacing: Spacing.s3) {
                        Icon(action.icon, size: 19, color: Theme.Color.home)
                            .frame(width: 38, height: 38)
                            .background(Theme.Color.homeBg)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(action.title)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(Theme.Color.appText)
                            Text(action.subtitle)
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Spacer(minLength: 0)
                        Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                    }
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, Spacing.s3)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("homeCreateMenu_\(action)")
            }
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.bottom, Spacing.s4)
        .presentationDetents([.height(340)])
        .presentationDragIndicator(.visible)
    }
}
