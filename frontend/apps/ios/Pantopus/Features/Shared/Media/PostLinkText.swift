import SafariServices
import SwiftUI

/// Uses the same URL detector as chat; user text is never interpreted as markup.
struct PostLinkText: View {
    let text: String
    @State private var openedLink: BrowserLink?

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(linkedText)
            .tint(Theme.Color.primary600)
            .environment(\.openURL, OpenURLAction { url in
                guard ["https", "http"].contains(url.scheme?.lowercased() ?? "") else { return .discarded }
                openedLink = BrowserLink(url: url)
                return .handled
            })
            .sheet(item: $openedLink) { link in
                PostLinkBrowser(url: link.url).ignoresSafeArea()
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

    private struct BrowserLink: Identifiable {
        let url: URL
        var id: String {
            url.absoluteString
        }
    }
}

private struct PostLinkBrowser: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context _: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_: SFSafariViewController, context _: Context) {}
}
