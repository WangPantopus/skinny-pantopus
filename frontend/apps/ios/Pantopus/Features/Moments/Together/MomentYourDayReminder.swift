//
//  MomentYourDayReminder.swift
//  Pantopus
//
//  "Your day" at 8 pm, the reminder ("Pulse, reinvented" phase 3, PHASE-3 piece 10; CONTRACT 8k: "No push: the 8 pm
//  nudge is the app's own local reminder"). One reminder on the phone for the next 8 pm, set again each time Pulse reads
//  the day with the switch on, and taken away at once when the switch reads off (`PulseTrackSwitch`), at sign-out, or
//  when the person turns off its Settings row "Your day at 8 pm" (on unless they turn it off). It asks for nothing:
//  without the person's own notification permission nothing shows. A tap opens Pulse, where the card is.
//

import Foundation
import UserNotifications

/// The phone's own reminder at 8 pm (no push): one at a time, for the next 8 pm only.
enum YourDayReminder {
    static let identifier = "pantopus.yourDay.reminder"
    /// The person's own choice, per account on this phone; on unless they turned it off.
    @MainActor
    private static var key: String? {
        MomentsComposerModel.account.map { "pantopus.yourDay.reminderOn.\($0)" }
    }

    @MainActor
    static var isOn: Bool {
        guard let key else { return false }
        return UserDefaults.standard.object(forKey: key) as? Bool ?? true
    }

    @MainActor
    static func set(_ on: Bool) async {
        guard let key else { return }
        UserDefaults.standard.set(on, forKey: key)
        await arm()
    }

    /// The switch read off, or nobody is signed in: no reminder waits.
    static func cancel() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
    }

    /// Sets the next 8 pm (today's if it is still ahead and today's card wasn't decided), or takes it away. Asks for
    /// nothing: without the person's notification permission nothing shows.
    @MainActor
    static func arm() async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        guard PulseReinventedFlags.shared.isOn, isOn else { return }
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
        let calendar = Calendar.current
        let now = Date()
        var when = calendar.date(bySettingHour: YourDayModel.opensAtHour, minute: 0, second: 0, of: now) ?? now
        if when <= now || YourDayModel.shared.decidedToday { when = calendar.date(byAdding: .day, value: 1, to: when) ?? when }
        let content = UNMutableNotificationContent()
        content.title = "Your day"
        content.body = "The photos you took today, along your path. Only you see them until you share."
        content.sound = .default
        content.userInfo = ["link": "/pulse"]
        let parts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: when)
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
        )
        try? await center.add(request)
    }
}

extension SettingsIndexViewModel {
    static let yourDayReminderRow = "yourDayReminder"

    /// "Your day at 8 pm", after the strands row; nothing with the switch off.
    var yourDayReminderRows: [GroupedListRow] {
        guard PulseReinventedFlags.shared.isOn else { return [] }
        return [
            GroupedListRow(
                id: Self.yourDayReminderRow,
                label: "Your day at 8 pm",
                subtext: "A reminder on this phone to look at the photos you took that day. Nothing is shared until you say so.",
                control: .toggle(isOn: YourDayReminder.isOn),
                accessibilityIdentifier: "settings.yourDayReminder"
            )
        ]
    }

    func toggleYourDayReminder(_ rowId: String, isOn: Bool) async -> Bool {
        guard rowId == Self.yourDayReminderRow else { return false }
        await YourDayReminder.set(isOn)
        return true
    }
}
