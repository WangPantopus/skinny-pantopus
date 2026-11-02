//
//  TodayNeedsYou.swift
//  Pantopus
//
//  "Needs you" on the Today tab
//  (`docs/product/ai-assistant-phase3-contract-2026-10-22.md` §6.4, placed by
//  the phase 3 brief under the sky and its hourly strip, above "Coming up at
//  home"): what waits on the person, from `GET /api/ai/needs-you`. Three rows,
//  "Show all (N)" expands in place, and it is hidden when nothing waits. It
//  shows the last list at once and refreshes when Today appears, comes back
//  and on pull to refresh; a failed refresh keeps the last list, and with no
//  list yet it shows nothing. Each row opens its link through the deep-link
//  router (a task opens over Today, as the agenda's do). Parity twin of
//  Android's Today Needs you card.
//

import Observation
import SwiftUI

/// The Today tab's one Needs you list, shared by its loaded, no-place and
/// couldn't-load views.
@Observable
@MainActor
final class TodayNeedsYouModel {
    /// The server's items, most urgent first (at most 20).
    private(set) var items: [AINeedsYouItemDTO] = []
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// The saved list at once, then the server's.
    func load() async {
        let store = ScreenStore.store(for: api)
        let endpoint = AIEndpoints.needsYou()
        if items.isEmpty, let saved = store.peek(endpoint, as: AINeedsYouResponse.self) {
            items = saved.value.items
        }
        do {
            let fresh = try await store.load(endpoint, as: AINeedsYouResponse.self, kind: .notifications, force: true)
            items = fresh.value.items
        } catch APIError.notFound {
            // A server without the route: nothing to show.
            items = []
        } catch {
            // Offline, a server error or a sign-in change: the last list stays (or nothing).
        }
    }

    /// The rows the card shows: a household task already on "Coming up at home" is left out.
    func shown(hidingTaskIds taskIds: Set<String>) -> [AINeedsYouItemDTO] {
        guard !taskIds.isEmpty else { return items }
        return items.filter { item in
            guard item.type == "task_overdue" || item.type == "task_assigned", let id = item.subject?.id else { return true }
            return !taskIds.contains(id.lowercased())
        }
    }
}

struct TodayNeedsYouCard: View {
    let model: TodayNeedsYouModel
    /// Tasks "Coming up at home" already shows on this screen.
    var hiddenTaskIds: Set<String> = []
    /// Opens a task over Today, so Back comes back here.
    var onOpenTask: ((_ homeId: String, _ taskId: String) -> Void)?
    @State private var showsAll = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private static let firstRows = 3

    var body: some View {
        let rows = model.shown(hidingTaskIds: hiddenTaskIds)
        if !rows.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                PlaceSectionHeading(title: "Needs you")
                PlaceGroupSurface {
                    let visible = showsAll ? rows : Array(rows.prefix(Self.firstRows))
                    ForEach(Array(visible.enumerated()), id: \.element.id) { index, item in
                        if index > 0 { PlaceRowDivider() }
                        row(item)
                    }
                    if rows.count > Self.firstRows {
                        PlaceRowDivider()
                        PlaceInlineAction(
                            title: showsAll ? "Show fewer" : "Show all (\(rows.count))",
                            identifier: "needsYou.showAll"
                        ) {
                            withAnimation(reduceMotion ? nil : .snappy(duration: 0.25)) { showsAll.toggle() }
                        }
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("needsYou.card")
        }
    }

    private func row(_ item: AINeedsYouItemDTO) -> some View {
        let look = Self.look(item.type)
        return Button { open(item) } label: {
            HStack(alignment: .center, spacing: 12) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(look.background)
                    .frame(width: 36, height: 36)
                    .overlay(Icon(look.icon, size: 17, strokeWidth: 2.2, color: look.tint))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                    if let subtitle = item.subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 16, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, 12)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("needsYou.row.\(item.type)")
    }

    /// A task opens over Today; everything else through the deep-link router.
    private func open(_ item: AINeedsYouItemDTO) {
        if let onOpenTask, let subject = item.subject, subject.type == "task",
           let homeId = subject.homeId, let taskId = subject.id {
            onOpenTask(homeId, taskId)
            return
        }
        guard let link = item.link, !link.isEmpty else { return }
        DeepLinkRouter.shared.handle(path: link)
    }

    private struct Look {
        let icon: PantopusIcon
        let tint: Color
        let background: Color
    }

    private static func look(_ type: String) -> Look {
        switch type {
        case "still_coming": Look(icon: .calendarCheck, tint: Theme.Color.primaryInk, background: Theme.Color.primary50)
        case "plan_requests": Look(icon: .users, tint: Theme.Color.primaryInk, background: Theme.Color.primary50)
        case "task_overdue": Look(icon: .clockAlert, tint: Theme.Color.warning, background: Theme.Color.warningBg)
        case "task_assigned": Look(icon: .listChecks, tint: Theme.Color.home, background: Theme.Color.homeBg)
        case "home_invite", "household_request": Look(icon: .home, tint: Theme.Color.home, background: Theme.Color.homeBg)
        case "connection_request": Look(icon: .userPlus, tint: Theme.Color.primaryInk, background: Theme.Color.primary50)
        case "question_answered": Look(icon: .messageSquare, tint: Theme.Color.primaryInk, background: Theme.Color.primary50)
        default: Look(icon: .sparkles, tint: Theme.Color.magic, background: Theme.Color.magicBg)
        }
    }
}
