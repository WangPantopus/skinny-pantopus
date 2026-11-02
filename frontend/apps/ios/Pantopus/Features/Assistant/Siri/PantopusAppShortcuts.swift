//
//  PantopusAppShortcuts.swift
//  Pantopus
//
//  Siri and Shortcuts (`docs/product/ai-assistant-phase3-contract-2026-10-22.md`
//  §8.1, §8.3): five App Shortcuts in the app target, working as soon as the
//  app is installed. Three read and answer in Siri without opening the app
//  (never on a locked phone); two draft, asking for the words, then open the
//  assistant with them sent, where nothing changes until the person taps the
//  card. Phrases carry the app's name and no personal data.
//

import AppIntents

struct PantopusAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: NextPickupIntent(),
            phrases: [
                "When's my next pickup in \(.applicationName)",
                "Next pickup in \(.applicationName)"
            ],
            shortTitle: "Next pickup",
            systemImageName: "trash"
        )
        AppShortcut(
            intent: WhatsOnTodayIntent(),
            phrases: ["What's on today in \(.applicationName)"],
            shortTitle: "What's on today",
            systemImageName: "sun.max"
        )
        AppShortcut(
            intent: CatchMeUpNearbyIntent(),
            phrases: [
                "Catch me up on \(.applicationName)",
                "What's new nearby in \(.applicationName)"
            ],
            shortTitle: "Catch me up nearby",
            systemImageName: "map"
        )
        AppShortcut(
            intent: StartPlanIntent(),
            phrases: ["Start a plan in \(.applicationName)"],
            shortTitle: "Start a plan",
            systemImageName: "calendar.badge.plus"
        )
        AppShortcut(
            intent: RemindHouseholdIntent(),
            phrases: ["Remind my household in \(.applicationName)"],
            shortTitle: "Remind my household",
            systemImageName: "checklist"
        )
    }
}
