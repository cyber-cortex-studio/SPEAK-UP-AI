export interface RepeatMatchResult {
  matched: boolean
  score: number
}

const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "he's": 'he is',
  "she's": 'she is',
  "it's": 'it is',
  "that's": 'that is',
  "there's": 'there is',
  "let's": 'let us',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'cannot',
  "won't": 'will not',
  "wouldn't": 'would not',
  "couldn't": 'could not',
  "shouldn't": 'should not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "i've": 'i have',
  "i'd": 'i would',
  "i'll": 'i will',
}

function normalizeWords(input: string): string[] {
  const lowered = input
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .trim()

  if (!lowered) return []

  const rawTokens = lowered.split(/\s+/)
  const words: string[] = []

  for (const token of rawTokens) {
    const cleanedToken = token.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '')
    if (!cleanedToken) continue

    const expanded = CONTRACTIONS[cleanedToken] ?? cleanedToken
    for (const part of expanded.split(/\s+/)) {
      const alphaNum = part.replace(/[^a-z0-9]/g, '')
      if (alphaNum) {
        words.push(alphaNum)
      }
    }
  }

  return words
}

export function evaluateRepeatMatch(
  targetSentence: string,
  spokenTranscript: string,
  threshold = 60,
): RepeatMatchResult {
  const targetWords = normalizeWords(targetSentence)
  if (targetWords.length === 0) {
    return { matched: true, score: 100 }
  }

  const spokenWords = normalizeWords(spokenTranscript)
  if (spokenWords.length === 0) {
    return { matched: false, score: 0 }
  }

  const spokenCounts = new Map<string, number>()
  for (const word of spokenWords) {
    spokenCounts.set(word, (spokenCounts.get(word) ?? 0) + 1)
  }

  let matchedCount = 0
  for (const targetWord of targetWords) {
    const remaining = spokenCounts.get(targetWord) ?? 0
    if (remaining > 0) {
      matchedCount += 1
      spokenCounts.set(targetWord, remaining - 1)
    }
  }

  const score = Math.round((matchedCount / targetWords.length) * 100)
  return {
    matched: score >= threshold,
    score,
  }
}
