import SafariServices
import SwiftUI

/// Uses the same URL detector as chat; user text is never interpreted as markup.
struct PostLinkText: View {
    let text: String
    @State private var openedURL: URL?
    @State private var showsBrowser = false

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(linkedText)
            .tint(Theme.Color.primary600)
            .environment(\.openURL, OpenURLAction { url in
                guard ["https", "http"].contains(url.scheme?.lowercased() ?? "") else { return .discarded }
                openedURL = url
                showsBrowser = true
                return .handled
            })
            .sheet(isPresented: $showsBrowser) {
                if let openedURL { PostLinkBrowser(url: openedURL).ignoresSafeArea() }
            }
    }

    private var linkedText: AttributedString {
        var result = AttributedString(text)
        for match in ChatLinkDetection.linkMatches(in: text) {
            if let range = Range(match.range, in: result) {
                result[range].link = match.url
            }
        }
        return result
    }
}

private struct PostLinkBrowser: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context _: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_: SFSafariViewController, context _: Context) {}
}
