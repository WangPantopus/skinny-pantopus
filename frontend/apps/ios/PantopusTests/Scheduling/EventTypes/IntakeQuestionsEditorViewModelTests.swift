//
//  IntakeQuestionsEditorViewModelTests.swift
//  PantopusTests
//
//  Stream I2 — B3 intake-questions load / validation / save tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class IntakeQuestionsEditorViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeClient() -> SchedulingClient {
        SchedulingClient(client: APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        ))
    }

    private static let detail = """
    {"eventType":{"id":"e1","name":"Intro","slug":"intro","durations":[30]},
     "assignees":[],
     "questions":[{"label":"Phone number","field_type":"phone","required":true,"sort_order":0}]}
    """

    private static let emptyDetail = """
    {"eventType":{"id":"e1","name":"x","slug":"x","durations":[30]},"questions":[],"assignees":[]}
    """

    private static let savedQuestions = """
    {"questions":[{"label":"Topic","field_type":"text","required":false,"sort_order":0}]}
    """

    private func makeVM() -> IntakeQuestionsEditorViewModel {
        IntakeQuestionsEditorViewModel(owner: .personal, eventTypeId: "e1", client: makeClient())
    }

    func testLoadMapsQuestions() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.detail)]
        let viewModel = makeVM()
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.questions.count, 1)
        XCTAssertEqual(viewModel.questions.first?.fieldType, .phone)
        XCTAssertTrue(viewModel.questions.first?.required ?? false)
        XCTAssertFalse(viewModel.isDirty)
    }

    func testEmptyQuestionBlocksSave() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.emptyDetail)]
        let viewModel = makeVM()
        await viewModel.load()
        viewModel.addQuestion()
        XCTAssertFalse(viewModel.isValid, "A blank label must be invalid")
    }

    func testSaveReplacesSet() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.detail),
            .status(200, body: Self.savedQuestions)
        ]
        let viewModel = makeVM()
        await viewModel.load()
        viewModel.questions[0].label = "Topic"
        viewModel.questions[0].fieldType = .text
        let ok = await viewModel.save()
        XCTAssertTrue(ok)
    }
}
