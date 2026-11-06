import Foundation
import PDFKit
// pdftext.swift FILE.pdf: print the PDF's text (PDFKit), so documents are read as text, not page images
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let doc = PDFDocument(url: url) else { print("cannot open"); exit(1) }
print(doc.string ?? "")
