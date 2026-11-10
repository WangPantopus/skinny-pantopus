package app.pantopus.android.ui.screens.mailbox.cards.table

/**
 * A letter's words on the table (plan Part 10, the welcome letter): turn it over, open it, take the letter out; out of
 * its envelope it opens as the letter page ("Read the letter"). The same moves as a card, in a letter's words.
 */
internal data class LetterWords(
    val words: String,
    val primary: String,
    val hint: String,
) {
    companion object {
        fun of(
            step: TableStep,
            from: String,
        ): LetterWords =
            when (step) {
                TableStep.Front -> LetterWords("A letter from $from.", "Turn it over", "or swipe it, the way you'd turn it in your hand")
                TableStep.Back -> LetterWords("", "Open it", "or pull the flap up with your finger")
                TableStep.Flap -> LetterWords("", "Take the letter out", "or pull it out with your finger")
                TableStep.Out -> LetterWords("", "Read the letter", "")
                TableStep.Pulling -> LetterWords("", "", "")
            }
    }
}
