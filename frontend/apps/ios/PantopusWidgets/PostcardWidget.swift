//
//  PostcardWidget.swift
//  PantopusWidgets
//
//  "Pulse, reinvented" phase 3 (PHASE-3 piece 9; board B11; CONTRACT 8j): the newest postcard in the Mail tab on the
//  home screen: a morning postcard from someone close, or a Moment mailed to the person ("A postcard from Dana"), with
//  its picture. It draws what the app last read from the Mail tab (`MomentPostcardWidget.swift` writes it into the app
//  group); it fetches nothing itself. **It is in the widget gallery only while the app last saw `pulse_reinvented` on
//  for the signed-in person** (the app clears the flag and the snapshot when the switch goes off), the way "Tasks near
//  me" hides with no families when its switch is off. A tap opens the letter.
//

import SwiftUI
import UIKit
import WidgetKit

/// What the app wrote (`PostcardWidgetSnapshot` in the app; the same keys, read here).
struct PostcardWidgetEntryData: Decodable {
    let mailId: String
    let from: String
    let deliveredAt: Date
    let hasPicture: Bool
    /// The app's own lock is on: only "A postcard is waiting".
    let locked: Bool?
}

enum PostcardWidgetStorage {
    static let kind = "PantopusPostcard"
    static let appGroupId = "group.app.pantopus.ios"
    static let snapshotKey = "pantopus.widget.postcard.v1"
    static let onKey = "pantopus.widget.postcard.on"
    static let pictureName = "postcard-widget.jpg"

    static var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    /// The app last saw the switch on for the signed-in person.
    static var isOn: Bool {
        defaults?.bool(forKey: onKey) ?? false
    }

    static func load() -> PostcardWidgetEntryData? {
        guard isOn, let data = defaults?.data(forKey: snapshotKey) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(PostcardWidgetEntryData.self, from: data)
    }

    static func picture() -> UIImage? {
        guard let folder = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else { return nil }
        return UIImage(contentsOfFile: folder.appendingPathComponent(pictureName).path)
    }
}

struct PostcardWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: PostcardWidgetStorage.kind, provider: PostcardProvider()) { entry in
            PostcardWidgetView(entry: entry)
        }
        .configurationDisplayName("Postcards")
        .description("The newest postcard from the people closest to you, from your Mail.")
        .supportedFamilies(PostcardWidgetStorage.isOn ? [.systemSmall, .systemMedium] : [])
        .contentMarginsDisabled()
    }
}

struct PostcardEntry: TimelineEntry {
    let date: Date
    let postcard: PostcardWidgetEntryData?
    let picture: UIImage?
    /// False once the app saw the switch off: a widget placed before shows only "Open Pantopus".
    let isOn: Bool
}

struct PostcardProvider: TimelineProvider {
    func placeholder(in _: Context) -> PostcardEntry {
        PostcardEntry(date: Date(), postcard: nil, picture: nil, isOn: true)
    }

    func getSnapshot(in _: Context, completion: @escaping (PostcardEntry) -> Void) {
        completion(Self.entry())
    }

    /// One entry: the app reloads this widget whenever it reads a newer postcard (or the switch goes off).
    func getTimeline(in _: Context, completion: @escaping (Timeline<PostcardEntry>) -> Void) {
        completion(Timeline(entries: [Self.entry()], policy: .never))
    }

    private static func entry() -> PostcardEntry {
        let postcard = PostcardWidgetStorage.load()
        let picture = postcard?.hasPicture == true && postcard?.locked != true ? PostcardWidgetStorage.picture() : nil
        return PostcardEntry(date: Date(), postcard: postcard, picture: picture, isOn: PostcardWidgetStorage.isOn)
    }
}

struct PostcardWidgetView: View {
    let entry: PostcardEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        content
            .widgetURL(URL(string: entry.isOn ? entry.postcard
                    .map { "pantopus://mailbox/\($0.mailId)" } ?? "pantopus://mailbox" : "pantopus://"))
            .containerBackground(for: .widget) { background }
    }

    @ViewBuilder private var background: some View {
        if let picture = entry.picture {
            Image(uiImage: picture).resizable().scaledToFill().privacySensitive()
        } else {
            LinearGradient(
                colors: [Color(red: 0.93, green: 0.89, blue: 0.82), Color(red: 0.86, green: 0.80, blue: 0.70)],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }

    @ViewBuilder private var content: some View {
        if !entry.isOn {
            Text("Open Pantopus")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color(red: 0.25, green: 0.2, blue: 0.15))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let postcard = entry.postcard, postcard.locked == true {
            Text("A postcard is waiting")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color(red: 0.25, green: 0.2, blue: 0.15))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                .padding(12)
        } else if let postcard = entry.postcard {
            VStack(alignment: .leading, spacing: 2) {
                Spacer(minLength: 0)
                Text("A postcard from \(postcard.from)")
                    .font(.system(size: family == .systemSmall ? 13 : 15, weight: .bold))
                    .lineLimit(2)
                    .privacySensitive()
                Text(Self.when(postcard.deliveredAt))
                    .font(.system(size: 11.5, weight: .semibold))
                    .opacity(0.9)
            }
            .foregroundStyle(entry.picture == nil ? Color(red: 0.25, green: 0.2, blue: 0.15) : .white)
            .shadow(color: entry.picture == nil ? .clear : .black.opacity(0.6), radius: 3, y: 1)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
            .padding(12)
            .background(alignment: .bottom) {
                if entry.picture != nil {
                    LinearGradient(colors: [.clear, .black.opacity(0.55)], startPoint: .top, endPoint: .bottom)
                        .frame(height: 70)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Text("Postcards")
                    .font(.system(size: 15, weight: .bold))
                Text("Postcards from the people closest to you show here.")
                    .font(.system(size: 12))
                    .opacity(0.85)
            }
            .foregroundStyle(Color(red: 0.25, green: 0.2, blue: 0.15))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(12)
        }
    }

    /// "Today, 7:00 AM", "Yesterday", or "Nov 26".
    private static func when(_ date: Date) -> String {
        let calendar = Calendar.autoupdatingCurrent
        if calendar.isDateInToday(date) { return "Today, \(date.formatted(date: .omitted, time: .shortened))" }
        if calendar.isDateInYesterday(date) { return "Yesterday" }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }
}
