//
//  AppDelegate.swift
//  Pantopus
//
//  Minimal UIApplicationDelegate bridge for things SwiftUI doesn't expose:
//  push notification token registration, background task handling.
//

import Logging
import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate {
    private let logger = Logger(label: "app.pantopus.ios.AppDelegate")

    /// Configure SwiftLog. Called once from `didFinishLaunching` (which runs
    /// once per process). Debug builds keep verbose `.debug` output;
    /// Release/Staging raise the floor to `.notice` so `.info`/`.debug`
    /// chatter (APNs tokens, deep-link paths, analytics breadcrumbs) never
    /// reaches the device console of a shipped build.
    private static func bootstrapLogging() {
        LoggingSystem.bootstrap { label in
            var handler = StreamLogHandler.standardError(label: label)
            #if DEBUG
            handler.logLevel = .debug
            #else
            handler.logLevel = .notice
            #endif
            return handler
        }
    }

    func application(
        _: UIApplication,
        didFinishLaunchingWithOptions _: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        Self.bootstrapLogging()
        try? HomeDocumentTemporaryFiles.clearPreviousLaunch()
        MainActor.assumeIsolated {
            Observability.shared.start(environment: AppEnvironment.current)
            // Product analytics (PostHog). No-ops until POSTHOG_API_KEY is set,
            // so dev / CI builds send nothing. Matches Android's vendor + names.
            Analytics.start(environment: AppEnvironment.current)
            // Phase 3 (3A) — configure the Stripe SDK once at launch with the
            // publishable key resolved from Info.plist (xcconfig / .env). The
            // SDK is already linked (project.yml); we only set the key here.
            StripeBootstrap.configure(publishableKey: AppEnvironment.current.stripePublishableKey)
        }
        registerReminderCategories()
        UNUserNotificationCenter.current().delegate = self
        registerAuthorizedPushNotifications()
        return true
    }

    // MARK: - Push notifications

    private func registerReminderCategories() {
        let pickup = UNNotificationCategory(
            identifier: "PICKUP_REMINDER",
            actions: [UNNotificationAction(identifier: "BINS_OUT", title: "Bins out", options: [])],
            intentIdentifiers: [],
            options: []
        )
        let task = UNNotificationCategory(
            identifier: "TASK_REMINDER",
            actions: [
                UNNotificationAction(identifier: "TASK_DONE", title: "Done", options: [.authenticationRequired]),
                UNNotificationAction(identifier: "TASK_NOT_NOW", title: "Not now", options: [.foreground])
            ],
            intentIdentifiers: [],
            options: []
        )
        let taskDoneOnly = UNNotificationCategory(
            identifier: "TASK_REMINDER_DONE_ONLY",
            actions: [UNNotificationAction(identifier: "TASK_DONE", title: "Done", options: [.authenticationRequired])],
            intentIdentifiers: [],
            options: []
        )
        UNUserNotificationCenter.current().setNotificationCategories([pickup, task, taskDoneOnly])
    }

    private func registerAuthorizedPushNotifications() {
        if ProcessInfo.processInfo.environment["UI_TESTS_DISABLE_NOTIFICATIONS"] == "1" {
            return
        }

        // The existing primer and Settings choices own first-time permission prompts.
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            guard [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) else { return }
            DispatchQueue.main.async {
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    func application(
        _: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let tokenString = deviceToken.map { String(format: "%02x", $0) }.joined()
        logger.info("APNs token received")
        Task {
            // POST the APNs device token to /api/notifications/register with
            // platform=ios. The backend stores it as an APNs provider token
            // and delivers via APNs directly (no Expo). See
            // docs/push-native-migration.md.
            //
            // Persistent login (CONTRACT "Client behaviour"): the body also
            // carries `deviceId` so the backend links the token to the
            // `AuthDevice` row, and a token change re-runs
            // `POST /api/auth/devices/register` — both inside
            // `registerPushToken` → `AuthManager.pushTokenDidChange`.
            await APIClient.shared.registerPushToken(tokenString, platform: "ios")
        }
    }

    func application(
        _: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: any Error
    ) {
        logger.error("APNs registration failed", metadata: ["error": .string(error.localizedDescription)])
        Task { @MainActor in Observability.shared.capture(error) }
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
    /// Show banner + play sound even when app is in foreground — except
    /// chat pushes for the conversation the user is currently viewing.
    /// The backend's chat push carries `type: "chat_message"` and
    /// `room_id` at the top level of the APNs payload
    /// (`backend/routes/chats.js:1837`, flattened by
    /// `backend/services/push/apnsClient.js:buildPayload`); when that
    /// room is registered as on-screen we suppress the banner entirely —
    /// the socket already rendered the message in place.
    nonisolated func userNotificationCenter(
        _: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        // Extract only Sendable strings before hopping to the main actor —
        // `UNNotification` must not cross.
        let userInfo = notification.request.content.userInfo
        let type = userInfo["type"] as? String
        let roomId = userInfo["room_id"] as? String
        if type == "chat_message", let roomId {
            let isViewingThread = await MainActor.run {
                ActiveChatThreadTracker.shared.isViewingRoom(roomId)
            }
            if isViewingThread { return [] }
        }
        // First-launch scope: a push for a feature hidden for the first
        // launch shows no banner while the app is open (its tap would land nowhere).
        let link = HomeTaskNotificationRoute.pushPath(userInfo)
            ?? (userInfo["link"] as? String)
            ?? (userInfo["deepLink"] as? String)
        let launchAvailable = await MainActor.run {
            DeepLinkRouter.shared.isLaunchAvailable(notificationType: type, link: link)
        }
        if !launchAvailable { return [] }
        return [.banner, .list, .sound, .badge]
    }

    private struct ReminderPayload {
        let category: String
        let recipient: String?
        let date: String?
        let homeId: String?
        let taskId: String?
        let taskPath: String?
    }

    @MainActor
    private func handleBackgroundReminder(_ action: String, payload: ReminderPayload) async {
        let auth = AuthManager.shared
        if auth.state == .unknown { await auth.restoreSession() }
        guard let recipient = payload.recipient, case let .signedIn(user) = auth.state, user.id == recipient else { return }
        AppLockManager.shared.configure(userID: user.id)
        guard !AppLockManager.shared.isLocked else { return }
        let scope = HomeClaimSessionScope(api: .shared)
        guard scope.isCurrent else { return }
        if action == "BINS_OUT" {
            guard payload.category == "PICKUP_REMINDER", let date = payload.date,
                  date.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options: .regularExpression) != nil else { return }
            await PilotEvents.shared.send(
                .reminderAction,
                meta: ["kind": "pickup", "action": "bins_out", "date": date],
                scope: scope
            )
        } else {
            guard ["TASK_REMINDER", "TASK_REMINDER_DONE_ONLY"].contains(payload.category ?? ""),
                  let homeId = payload.homeId, let taskId = payload.taskId,
                  payload.taskPath != nil else { return }
            do {
                let dispatchGuard: @MainActor @Sendable () throws -> Void = {
                    try scope.requireCurrent()
                    guard !AppLockManager.shared.isLocked else { throw CancellationError() }
                }
                _ = try await HomeTaskAccess(homeId: homeId, dispatchGuard: dispatchGuard)
                    .complete(taskId: taskId, status: "done", beforeDispatch: dispatchGuard)
                guard scope.isCurrent else { return }
                await PilotEvents.shared.send(.reminderAction, meta: ["kind": "task", "action": "done"], scope: scope)
            } catch {
                // Keep the original task and notification usable after denial
                // or an uncertain response; never claim a local completion.
            }
        }
    }

    /// Handle taps on notifications — route to the relevant deep link.
    nonisolated func userNotificationCenter(
        _: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping @Sendable () -> Void
    ) {
        // The backend attaches the destination under `link` (the unified
        // notification payload key — see backend pushService); older Expo
        // payloads used `deepLink`. Read both so a tap routes regardless of
        // which key the sender used. Only the resolved `String` is captured
        // across the actor hop, so we never smuggle the non-Sendable
        // `UNNotification` onto the main actor.
        let userInfo = response.notification.request.content.userInfo
        let action = response.actionIdentifier
        let category = response.notification.request.content.categoryIdentifier
        let type = userInfo["type"] as? String
        let recipient = userInfo["recipient_user_id"] as? String
        let date = userInfo["pickupDate"] as? String ?? userInfo["date"] as? String
        let taskPath = HomeTaskNotificationRoute.pushPath(userInfo)
        let homeId = userInfo["homeId"] as? String ?? userInfo["home_id"] as? String
        let taskId = userInfo["taskId"] as? String ?? userInfo["task_id"] as? String
        let deepLink = HomeTaskNotificationRoute.pushPath(userInfo)
            ?? DeepLinkRouter.notificationPath(type: userInfo["type"] as? String, link: userInfo["link"] as? String)
            ?? (userInfo["deepLink"] as? String)
            // Briefing / monthly-receipt pushes carry no `link` — compose one
            // from `type` + `briefingKind` + `briefingDeliveryId`.
            ?? DeepLinkRouter.pushFallbackPath(userInfo: userInfo)
        let reminder = ReminderPayload(
            category: category,
            recipient: recipient,
            date: date,
            homeId: homeId,
            taskId: taskId,
            taskPath: taskPath
        )
        logger.info("Notification tapped")
        // Route and complete on the main actor. The async delegate variant
        // completed on a background executor, and UIKit's state-restoration
        // snapshot taken on completion asserts main-thread — a background
        // (HOME) banner tap crashed the app with SIGABRT (2026-09-22).
        Task { @MainActor in
            defer { completionHandler() }
            if action == UNNotificationDismissActionIdentifier { return }
            if action == "TASK_NOT_NOW" {
                guard category == "TASK_REMINDER", let recipient, UUID(uuidString: recipient) != nil,
                      let taskPath else { return }
                PilotEvents.shared.notificationOpened(type: type)
                DeepLinkRouter.shared.handle(path: taskPath + "?edit=due_date", expectedUserID: recipient)
                PilotEvents.shared.reminderOpened(recipient: recipient, meta: ["kind": "task", "action": "not_now"])
                return
            }
            if action == "BINS_OUT" || action == "TASK_DONE" {
                await handleBackgroundReminder(action, payload: reminder)
                return
            }
            guard action == UNNotificationDefaultActionIdentifier else { return }
            PilotEvents.shared.notificationOpened(type: type)
            if let deepLink, !deepLink.isEmpty {
                // `link` is a path like `/chat/42`; handle(path:) normalises it
                // to the pantopus:// scheme, matching the Android dispatcher.
                DeepLinkRouter.shared.handle(path: deepLink)
            }
        }
    }
}
