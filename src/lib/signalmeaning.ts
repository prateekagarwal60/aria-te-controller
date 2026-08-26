/* Why this step exists.
 *
 * The policy tells you whether spend is allowed. It does not tell you whether the
 * spend happened the way it is described. Those are different questions and a
 * charge can pass the first and fail the second: a duplicate is in policy, a split
 * purchase is in policy piece by piece, a reused receipt is in policy, and a claim
 * with no card record behind it is in policy right up until you ask what evidence
 * there is that any money left anyone's pocket.
 *
 * So the Corroborate step asks a different question from the Decide step. Not "is
 * this allowed" but "did this happen as described, and does anything the claimant
 * does not control say so".
 *
 * Every check is a SQL query across the whole corpus rather than a look at the one
 * charge. That is the part a person sampling two percent of charges cannot do, and
 * it is why several of these only mean anything at volume.
 */

export const SIGNAL_GROUPS: { question: string; why: string; codes: string[] }[] = [
  {
    question: "Is this the same spend twice?",
    why: "Duplicates are the most common finding in any expense audit, and most are honest.",
    codes: ["NEAR_DUPLICATE", "RECEIPT_REUSED"],
  },
  {
    question: "Was one purchase broken into pieces?",
    why: "Splitting to stay under an approval limit is usually a violation in itself, whatever the spend was for.",
    codes: ["SAME_DAY_SPLIT"],
  },
  {
    question: "Is there any evidence the spend happened?",
    why: "The question a generated receipt cannot answer, because it is the one thing a claimant cannot manufacture.",
    codes: ["NO_INDEPENDENT_RECORD", "NO_RECEIPT"],
  },
  {
    question: "Does the paperwork agree with the money?",
    why: "Where the document and the card feed disagree, one of them is wrong and it matters which.",
    codes: ["RECEIPT_AMOUNT_MISMATCH", "RECEIPT_MERCHANT_MISMATCH"],
  },
  {
    question: "Does anything place this person there?",
    why: "Records made before the spend, usually by other people, and therefore hard to arrange after the fact.",
    codes: ["IN_TRIP_WINDOW", "OUTSIDE_TRIP_WINDOW", "CALENDAR_MATCH"],
  },
  {
    question: "Is this normal for this company?",
    why: "Weak individually and worth almost nothing on one charge. Meaningful only against everyone else's.",
    codes: ["UNSEEN_MERCHANT", "HIGH_VELOCITY", "ROUND_AMOUNT"],
  },
];

/** What each signal is looking for, and what it means when it fires. Shown in the
 *  product so nobody has to read the source to understand a flag. */
export const SIGNAL_MEANING: Record<string, { asks: string; means: string }> = {
  NEAR_DUPLICATE: {
    asks: "Has this person charged the same merchant the same amount within four days?",
    means: "Usually a receipt submitted twice, or a charge captured twice by the feed. Occasionally deliberate.",
  },
  SAME_DAY_SPLIT: {
    asks: "Are there several charges at one merchant on one day?",
    means: "One purchase broken into pieces small enough to clear an approval limit. A violation in itself under most policies, whatever the spend was for.",
  },
  UNSEEN_MERCHANT: {
    asks: "Has anyone in the company ever charged this merchant before?",
    means: "Weak on its own, since every merchant is new once. Meaningful next to anything else.",
  },
  IN_TRIP_WINDOW: {
    asks: "Does an approved trip cover this date?",
    means: "Corroboration. Somebody approved travel before the money was spent.",
  },
  OUTSIDE_TRIP_WINDOW: {
    asks: "This person has approved trips on file. Does one cover this date?",
    means: "No. Travel spend outside an approved window, or ordinary local spend miscategorised.",
  },
  CALENDAR_MATCH: {
    asks: "Was there a diary entry on the day?",
    means: "Corroboration from a record made before the spend, usually by other people too.",
  },
  NO_RECEIPT: {
    asks: "Did anything match this charge?",
    means: "Not a problem by itself. Whether one was required is a question for the policy, answered at the Decide step.",
  },
  RECEIPT_AMOUNT_MISMATCH: {
    asks: "Does the receipt total match what the card was charged?",
    means: "A tip added after the receipt printed, a currency conversion, the wrong receipt matched, or an altered document.",
  },
  RECEIPT_MERCHANT_MISMATCH: {
    asks: "Does the receipt name the same merchant as the card feed?",
    means: "Often a trading name against a registered name. Sometimes the wrong receipt.",
  },
  RECEIPT_REUSED: {
    asks: "Has this exact receipt content been submitted before?",
    means: "The same document claimed twice, matched on content rather than filename so re-scanning does not hide it.",
  },
  NO_INDEPENDENT_RECORD: {
    asks: "A reimbursement claim. Is there any card or bank record of this spend?",
    means: "No. The claimant's own document is the only evidence the spend happened. The single most important signal in the set.",
  },
  ROUND_AMOUNT: {
    asks: "Is the amount an exact multiple of a hundred?",
    means: "Very weak alone; real bills rarely land round. Worth a point only alongside something else.",
  },
  HIGH_VELOCITY: {
    asks: "Six or more charges at this merchant in the trailing month?",
    means: "Often legitimate, such as a daily commute. Worth surfacing because a pattern is invisible one charge at a time.",
  },
};
