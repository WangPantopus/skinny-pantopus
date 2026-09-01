//
//  TasksNearMeWidget.swift
//  PantopusWidgets
//
//  Phase 6c — home-screen timeline widget showing up to 3 nearby open
//  tasks from the App Group snapshot the app writes after each gigs-feed
//  fetch (`GigWidgetSnapshotContract`). Stale (>6h) or missing data
//  renders the "Open Pantopus" placeholder. Rows deep-link into the gig
//  detail via the `pantopus://gigs/:id` route the app's DeepLinkRouter
//  already resolves. Category accents reuse the extension-local
//  `GigActivityPalette` hex map (no app-module import here).
//

import SwiftUI
import WidgetKit

struct TasksNearMeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: GigWidgetSnapshotContract.widgetKind,
            provider: TasksNearMeProvider()
        ) { entry in
            TasksNearMeView(entry: entry)
                .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName("Tasks near me")
        .description("Open tasks posted near you, straight from the Gigs feed.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Timeline

struct TasksNearMeEntry: TimelineEntry {
    let date: Date
    /// nil → no fresh snapshot; render the placeholder.
    let snapshot: GigWidgetSnapshot?
}

struct TasksNearMeProvider: TimelineProvider {
    func placeholder(in _: Context) -> TasksNearMeEntry {
        TasksNearMeEntry(date: Date(), snapshot: Self.sampleSnapshot)
    }

    func getSnapshot(in context: Context, completion: @escaping (TasksNearMeEntry) -> Void) {
        if context.isPreview {
            completion(TasksNearMeEntry(date: Date(), snapshot: Self.sampleSnapshot))
        } else {
            completion(TasksNearMeEntry(date: Date(), snapshot: Self.loadFreshSnapshot()))
        }
    }

    func getTimeline(in _: Context, completion: @escaping (Timeline<TasksNearMeEntry>) -> Void) {
        let entry = TasksNearMeEntry(date: Date(), snapshot: Self.loadFreshSnapshot())
        // Re-evaluate periodically so a snapshot crossing the 6h staleness
        // line falls back to the placeholder without an app launch.
        let refresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date())
            ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }

    /// Snapshot from the shared suite, nil when absent, empty, or stale.
    static func loadFreshSnapshot(now: Date = Date()) -> GigWidgetSnapshot? {
        guard let snapshot = GigWidgetSnapshotContract.load(),
              GigWidgetSnapshotContract.isFresh(snapshot, now: now),
              !snapshot.tasks.isEmpty
        else { return nil }
        return snapshot
    }

    static let sampleSnapshot = GigWidgetSnapshot(
        generatedAt: Date(),
        totalNearby: 7,
        tasks: [
            GigWidgetTask(id: "s1", title: "Hang 3 floating shelves", price: "$60", distance: "0.2mi", categoryKey: "handyman"),
            GigWidgetTask(id: "s2", title: "Deep clean 2BR apartment", price: "$180", distance: "0.5mi", categoryKey: "cleaning"),
            GigWidgetTask(id: "s3", title: "30 min dog walk", price: "$20", distance: "0.8mi", categoryKey: "petcare")
        ]
    )
}

// MARK: - Views

struct TasksNearMeView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TasksNearMeEntry

    var body: some View {
        if let snapshot = entry.snapshot, let top = snapshot.tasks.first {
            switch family {
            case .systemSmall:
                SmallTasksView(snapshot: snapshot, top: top)
            default:
                MediumTasksView(snapshot: snapshot)
            }
        } else {
            PlaceholderTasksView()
        }
    }
}

/// "N tasks nearby" header shared by both families.
private struct TasksHeader: View {
    let count: Int

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "mappin.and.ellipse")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(GigWidgetPalette.brand)
            Text("\(count) task\(count == 1 ? "" : "s") nearby")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.primary)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
    }
}

/// systemSmall — count header + the top task. The whole widget links to
/// that task's detail.
private struct SmallTasksView: View {
    let snapshot: GigWidgetSnapshot
    let top: GigWidgetTask

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            TasksHeader(count: snapshot.totalNearby)
            Spacer(minLength: 0)
            HStack(spacing: 5) {
                Circle()
                    .fill(GigActivityPalette.color(for: top.categoryKey))
                    .frame(width: 7, height: 7)
                Text(top.price)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(GigWidgetPalette.brand)
            }
            Text(top.title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.primary)
                .lineLimit(2)
            if let distance = top.distance {
                Text(distance)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(GigWidgetPalette.gigURL(top.id))
    }
}

/// systemMedium — header + up to 3 task rows, each deep-linking to its
/// gig detail.
private struct MediumTasksView: View {
    let snapshot: GigWidgetSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            TasksHeader(count: snapshot.totalNearby)
            ForEach(snapshot.tasks.prefix(3)) { task in
                if let url = GigWidgetPalette.gigURL(task.id) {
                    Link(destination: url) { TaskRow(task: task) }
                } else {
                    TaskRow(task: task)
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct TaskRow: View {
    let task: GigWidgetTask

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(GigActivityPalette.color(for: task.categoryKey))
                .frame(width: 7, height: 7)
            Text(task.title)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
            Spacer(minLength: 4)
            if let distance = task.distance {
                Text(distance)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
            }
            Text(task.price)
                .font(.system(size: 12.5, weight: .bold))
                .foregroundStyle(GigWidgetPalette.brand)
        }
    }
}

/// No snapshot, empty snapshot, or one older than 6 hours.
private struct PlaceholderTasksView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "briefcase")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(GigWidgetPalette.brand)
            Text("Open Pantopus to see tasks near you")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Extension-local accents for this widget. The brand tint mirrors the
/// app's `primary600`; per-category dots reuse `GigActivityPalette`.
enum GigWidgetPalette {
    static let brand = Color(
        red: Double(0x02) / 255,
        green: Double(0x84) / 255,
        blue: Double(0xC7) / 255
    )

    /// `pantopus://gigs/:id` — resolved by the app's `DeepLinkRouter`
    /// (`Core/Routing/DeepLinkRouter.swift`, case "gig"/"gigs").
    static func gigURL(_ id: String) -> URL? {
        URL(string: "pantopus://gigs/\(id)")
    }
}
