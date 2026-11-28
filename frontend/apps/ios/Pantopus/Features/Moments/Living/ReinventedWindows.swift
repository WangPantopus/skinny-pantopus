//
//  ReinventedWindows.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 4, homes talk to homes (PHASE-4 piece 7; CONTRACT 9f), as the web's (`Windows.tsx`): a
//  circle member who lives at a home may show a window for it to that circle (their own choice, per circle, off by
//  default); it lights when they shared something today, and never says what, where, how many or when. Nothing about
//  the home itself (its place, address, name, who lives there) is read or shown. In Close circle the windows of the
//  person's circles show as a row; on a circle's page the person picks whether to show their own.
//

import Observation
import SwiftUI

struct ReinventedWindowDTO: Decodable, Identifiable {
    let circleId: String
    let circle: String
    let label: String
    let lit: Bool
    var id: String {
        "\(circleId)/\(label)"
    }

    private enum CodingKeys: String, CodingKey {
        case circle, label, lit
        case circleId = "circle_id"
    }
}

private struct ReinventedWindowsAnswer: Decodable {
    let windows: [ReinventedWindowDTO]
}

/// The person's own window on one circle, from the circles list (`my_window`).
private struct ReinventedMyWindows: Decodable {
    struct Circle: Decodable {
        struct Window: Decodable {
            let label: String
        }

        let id: String
        let myWindow: Window?

        private enum CodingKeys: String, CodingKey {
            case id
            case myWindow = "my_window"
        }
    }

    let circles: [Circle]
}

private struct ReinventedWindowBody: Encodable {
    struct Window: Encodable {
        let label: String
    }

    let window: Window?

    func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        // `null` stops showing it, so the key is always sent.
        try c.encode(window, forKey: .window)
    }

    private enum CodingKeys: String, CodingKey {
        case window
    }
}

private extension ReinventedEndpoints {
    static var windows: Endpoint {
        Endpoint(method: .get, path: "/api/reinvented/windows", cachePolicy: .reloadIgnoringLocalCacheData)
    }

    static var circlesForWindows: Endpoint {
        Endpoint(method: .get, path: "/api/reinvented/circles", cachePolicy: .reloadIgnoringLocalCacheData)
    }

    static func window(_ circleId: String, label: String?) -> Endpoint {
        let part = circleId
            .addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/"))) ?? circleId
        return Endpoint(
            method: .post,
            path: "/api/reinvented/circles/\(part)/me",
            body: ReinventedWindowBody(window: label.map(ReinventedWindowBody.Window.init(label:)))
        )
    }
}

/// In Close circle: the windows the person's circles show, lit when someone there shared today. Nothing with none.
struct ReinventedWindowsRow: View {
    @State private var windows: [ReinventedWindowDTO] = []

    var body: some View {
        // A stack, not a Group: with nothing in it yet a Group never appears, so its task would never read.
        VStack(alignment: .leading, spacing: 0) {
            if !windows.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text("Windows")
                        .pulseFont(15, weight: .bold)
                        .foregroundStyle(Theme.Color.appText)
                        .padding(.horizontal, Spacing.s4)
                    // A 16 pt gutter, scrolling from it (PHASE-6 A3).
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Spacing.s2) {
                            ForEach(windows) { window in
                                ReinventedWindowTile(window: window)
                            }
                        }
                    }
                    .contentMargins(.horizontal, Spacing.s4, for: .scrollContent)
                }
                .accessibilityIdentifier("reinventedWindows")
            }
        }
        .task {
            let read: ReinventedWindowsAnswer? = try? await APIClient.shared.request(ReinventedEndpoints.windows)
            windows = read?.windows ?? []
        }
    }
}

private struct ReinventedWindowTile: View {
    let window: ReinventedWindowDTO

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(window.lit ? ReinventedLivingPalette.lantern : Color(red: 0.16, green: 0.20, blue: 0.27))
                .frame(width: 44, height: 34)
                .overlay {
                    // The window's cross bars.
                    ZStack {
                        Rectangle().frame(width: 2)
                        Rectangle().frame(height: 2)
                    }
                    .foregroundStyle(Color.black.opacity(0.35))
                }
                .shadow(color: window.lit ? ReinventedLivingPalette.lantern.opacity(0.8) : .clear, radius: 10)
            Text(window.label)
                .pulseFont(13, weight: .semibold)
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
            Text(window.lit ? "Shared today" : window.circle)
                .pulseFont(12)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
        }
        .padding(10)
        .frame(width: 130, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(window.label), \(window.circle)" + (window.lit ? ", shared today" : ""))
    }
}

/// On a circle's page: "Show a window for my home to this circle", and its label.
struct ReinventedCircleWindowChoice: View {
    let circleId: String
    @State private var label: String?
    @State private var read = false
    @State private var writing = ""
    @State private var editing = false
    @State private var error: String?
    @State private var saving = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Toggle(isOn: Binding(get: { label != nil || editing }, set: { on in
                if on { editing = true } else { send(nil) }
            })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Show a window for my home to this circle")
                        .pulseFont(13.5)
                        .foregroundStyle(Theme.Color.appText)
                    Text("It lights when I share something, and never says what or where.")
                        .pulseFont(12)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .tint(Theme.Color.primarySolid)
            .disabled(!read || saving)
            .accessibilityIdentifier("reinventedWindows.choice")
            if editing {
                HStack(spacing: Spacing.s2) {
                    TextField("Its name, like Mom and Dad's", text: $writing)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityIdentifier("reinventedWindows.label")
                    Button("Show it") { send(String(writing.trimmingCharacters(in: .whitespaces).prefix(30))) }
                        .disabled(writing.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                        .accessibilityIdentifier("reinventedWindows.show")
                }
            } else if let label {
                Text("Shown as \u{201C}\(label)\u{201D}")
                    .pulseFont(12)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            if let error {
                Text(error)
                    .pulseFont(12, weight: .semibold)
                    .foregroundStyle(Theme.Color.error)
            }
        }
        .task { await load() }
    }

    private func load() async {
        let mine: ReinventedMyWindows? = try? await APIClient.shared.request(ReinventedEndpoints.circlesForWindows)
        label = mine?.circles.first { $0.id == circleId }?.myWindow?.label
        read = true
    }

    private func send(_ next: String?) {
        saving = true
        error = nil
        Task {
            do {
                _ = try await APIClient.shared.request(ReinventedEndpoints.window(circleId, label: next), as: EmptyResponse.self)
                editing = false
                writing = ""
                await load()
            } catch {
                if case let .clientError(_, message) = error as? APIError, message?.contains("home") == true {
                    self.error = "Only someone who lives at a home can show a window."
                } else {
                    self.error = "That didn't save. Try again."
                }
                editing = false
            }
            saving = false
        }
    }
}
