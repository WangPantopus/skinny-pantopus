//
//  AssistantSiriIntents.swift
//  Pantopus
//
//  The five Siri actions (`docs/product/ai-assistant-phase3-contract-2026-10-22.md`
//  §8.3). They run in the app's process, with its sign-in.
//
//  - Next pickup, What's on today and Catch me up nearby read
//    `GET /api/ai/glance/:topic` and answer in Siri (the server's sentences,
//    and its rows in a small card) without opening the app. They need the
//    phone unlocked. Signed out, behind App Lock, or with no home, Siri says
//    so and offers to open Pantopus.
//  - Start a plan and Remind my household ask for the words, then open the
//    assistant with them sent as the next message; the card comes back there
//    for a tap. The words are handed over in the app's memory, never in a link.
//
//  Xcode 16.4 APIs only (`openAppWhenRun`, `ForegroundContinuableIntent`); both
//  are deprecated in the iOS 26 SDK, where `supportedModes` replaces them.
//

import AppIntents
import SwiftUI

// MARK: - Reads

struct NextPickupIntent: AppIntent, ForegroundContinuableIntent {
    static var title: LocalizedStringResource {
        "Next pickup"
    }

    static var description: IntentDescription? {
        IntentDescription("When your garbage, recycling and yard waste go out next.")
    }

    /// Household details: never on a locked phone.
    static var authenticationPolicy: IntentAuthenticationPolicy {
        .requiresAuthentication
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        try await AssistantGlance.answer("pickup", for: self)
    }
}

struct WhatsOnTodayIntent: AppIntent, ForegroundContinuableIntent {
    static var title: LocalizedStringResource {
        "What's on today"
    }

    static var description: IntentDescription? {
        IntentDescription("The weather, alerts, your plans, tasks due and a pickup tonight.")
    }

    static var authenticationPolicy: IntentAuthenticationPolicy {
        .requiresAuthentication
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        try await AssistantGlance.answer("today", for: self)
    }
}

struct CatchMeUpNearbyIntent: AppIntent, ForegroundContinuableIntent {
    static var title: LocalizedStringResource {
        "Catch me up nearby"
    }

    static var description: IntentDescription? {
        IntentDescription("What's been posted near you since you last looked.")
    }

    static var authenticationPolicy: IntentAuthenticationPolicy {
        .requiresAuthentication
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        try await AssistantGlance.answer("nearby", for: self)
    }
}

/// Reads one glance answer as the signed-in person.
@MainActor
enum AssistantGlance {
    static let signInLine: LocalizedStringResource = "Open Pantopus to sign in."

    /// Siri's line when the answer couldn't be read (offline, a server error).
    struct Unavailable: Error, CustomLocalizedStringResourceConvertible {
        var localizedStringResource: LocalizedStringResource {
            "Pantopus couldn\u{2019}t check that just now. Try again in a moment."
        }
    }

    static func answer(
        _ topic: String,
        for intent: some ForegroundContinuableIntent
    ) async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        guard await AssistantIntentSession.isReady() else {
            throw intent.needsToContinueInForegroundError(IntentDialog(signInLine), continuation: nil)
        }
        let response: APIClient.DataResponse
        do {
            // A 404 carries the server's sentence and the screen that fixes it.
            response = try await APIClient.shared.requestDataResponse(AIEndpoints.glance(topic: topic), includingNotFound: true)
        } catch APIError.unauthorized {
            throw intent.needsToContinueInForegroundError(IntentDialog(signInLine), continuation: nil)
        } catch {
            throw Unavailable()
        }
        if response.response.statusCode == 404 {
            // No home, no pickup days, no place: say so, then open the screen it names.
            let refusal = try? JSONDecoder().decode(AIGlanceRefusal.self, from: response.data)
            let link = refusal?.link
            throw intent.needsToContinueInForegroundError(IntentDialog(stringLiteral: refusal?.speech ?? "Open Pantopus to see it.")) {
                if let link { DeepLinkRouter.shared.handle(path: link) }
            }
        }
        guard (200..<300).contains(response.response.statusCode),
              let glance = try? JSONDecoder().decode(AIGlanceResponse.self, from: response.data) else { throw Unavailable() }
        return .result(
            dialog: IntentDialog(stringLiteral: glance.speech),
            view: AssistantGlanceSnippet(title: glance.title, lines: glance.lines)
        )
    }
}

/// The answer's rows in the app's card style, under Siri's spoken line. With no rows ("Nothing new
/// near Camas"), there is no card: the spoken line says it all.
struct AssistantGlanceSnippet: View {
    let title: String
    let lines: [AIGlanceResponse.Line]

    var body: some View {
        if !lines.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text(title.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .kerning(0.6)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                    HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                        if let label = line.label, !label.isEmpty {
                            Text(label)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                                .frame(minWidth: 72, alignment: .leading)
                        }
                        Text(line.value)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextStrong)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Writes

struct StartPlanIntent: AppIntent {
    static var title: LocalizedStringResource {
        "Start a plan"
    }

    static var description: IntentDescription? {
        IntentDescription("Tell Pantopus the plan; it drafts it for you to post.")
    }

    static var openAppWhenRun: Bool {
        true
    }

    @Parameter(title: "Plan", requestValueDialog: IntentDialog("What\u{2019}s the plan?"))
    var words: String

    @MainActor
    func perform() async throws -> some IntentResult {
        await AIAssistantLaunchInbox.shared.openFromSiri(AIAssistantLaunch.startPlan(words: words))
        return .result()
    }
}

struct RemindHouseholdIntent: AppIntent {
    static var title: LocalizedStringResource {
        "Remind my household"
    }

    static var description: IntentDescription? {
        IntentDescription("Tell Pantopus the reminder; it drafts a household task for you to add.")
    }

    static var openAppWhenRun: Bool {
        true
    }

    @Parameter(title: "Reminder", requestValueDialog: IntentDialog("What should I remind them?"))
    var words: String

    @MainActor
    func perform() async throws -> some IntentResult {
        await AIAssistantLaunchInbox.shared.openFromSiri(AIAssistantLaunch.remindHousehold(words: words))
        return .result()
    }
}

/// Whether the app can act as the person now: signed in (a saved sign-in restored when the app
/// was launched for Siri) and not behind App Lock.
@MainActor
enum AssistantIntentSession {
    static func isReady() async -> Bool {
        let auth = AuthManager.shared
        if auth.state == .unknown { await auth.restoreSession() }
        guard case let .signedIn(user) = auth.state else { return false }
        AppLockManager.shared.configure(userID: user.id)
        return !AppLockManager.shared.isLocked
    }
}
