import { z } from 'zod';

const text = z.string().trim().min(1).max(1000);
const id = z.string().trim().min(1).max(80);
const timestamp = z.number().min(0).max(3600);
const observation = z.object({
  status: z.enum(['pass', 'fail', 'unclear']),
  fromSeconds: timestamp,
  toSeconds: timestamp.optional(),
  detail: text,
}).refine((value) => value.toSeconds === undefined || value.toSeconds >= value.fromSeconds, {
  message: 'Evidence must end at or after its start.',
});

const requirement = z.object({
  id,
  description: text,
  observation: observation.optional(),
  edit: z.object({ action: text, availableAsset: text, reason: text }).optional(),
  retry: z.object({
    action: text,
    reason: text,
    exactPromptChange: text.optional(),
    preserve: text,
    successCondition: text,
  }).optional(),
  alternative: text.optional(),
});

const priorAttempt = z.object({
  take: id,
  requirementId: id,
  change: text,
  outcome: z.enum(['same_failure', 'improved', 'passed', 'unclear']),
  evidence: observation,
});

const normalize = (value) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export const retryInputBase = z.object({
  take: id,
  brief: text,
  promptUsed: text.optional(),
  model: id.optional(),
  historyComplete: z.boolean(),
  retryPrice: z.object({ amount: z.number().min(0).max(10000), currency: z.string().regex(/^[A-Z]{3}$/) }).optional(),
  requirements: z.array(requirement).min(1).max(8),
  previousAttempts: z.array(priorAttempt).max(24),
});

export const retryInput = retryInputBase.superRefine((input, context) => {
  const ids = new Set(input.requirements.map((item) => item.id));
  if (ids.size !== input.requirements.length) {
    context.addIssue({ code: 'custom', path: ['requirements'], message: 'Requirement IDs must be unique.' });
  }
  const pairs = new Set();
  for (const [index, attempt] of input.previousAttempts.entries()) {
    const pair = JSON.stringify([attempt.take, attempt.requirementId]);
    if (!ids.has(attempt.requirementId) || pairs.has(pair) || attempt.take === input.take) {
      context.addIssue({ code: 'custom', path: ['previousAttempts', index], message: 'Use one entry per prior take and known requirement.' });
    }
    pairs.add(pair);
    if ((attempt.outcome === 'same_failure' && attempt.evidence.status !== 'fail')
      || (attempt.outcome === 'passed' && attempt.evidence.status !== 'pass')) {
      context.addIssue({ code: 'custom', path: ['previousAttempts', index], message: 'Prior outcome must agree with the observed evidence.' });
    }
  }
});

function decideRequirement(item, input) {
  const evidence = item.observation;
  if (!evidence || evidence.status === 'unclear') {
    return { action: 'review', reason: 'Get clear evidence for this requirement before authorizing another render.' };
  }
  if (evidence.status === 'pass') return { action: 'keep', reason: 'The supplied observation passes this requirement.' };
  if (item.edit) {
    return {
      action: 'edit',
      reason: item.edit.reason,
      nextStep: item.edit.action,
      asset: item.edit.availableAsset,
    };
  }
  const previous = input.previousAttempts.filter((attempt) => attempt.requirementId === item.id);
  const proposedChanges = item.retry ? [item.retry.action, item.retry.exactPromptChange].filter(Boolean).map(normalize) : [];
  const repeated = previous.some((attempt) => proposedChanges.includes(normalize(attempt.change)));
  // A prior pass or improvement breaks a sequence of stalled attempts.
  const lastProgress = previous.findLastIndex((attempt) => attempt.outcome === 'passed' || attempt.outcome === 'improved');
  const recentStalls = previous.slice(lastProgress + 1).filter((attempt) => attempt.outcome === 'same_failure');
  const stalledChanges = new Set(recentStalls.map((attempt) => normalize(attempt.change)));
  if (stalledChanges.size >= 2 || repeated) {
    return {
      action: 'change_approach',
      reason: stalledChanges.size >= 2
        ? 'Two distinct changes since the last observed progress still produced this failure. Pause retries with this setup.'
        : 'The proposed change already appears in the attempt history. Review that result before paying to repeat it.',
      nextStep: item.alternative ?? 'Plan an edit, a new reference, or a different way to produce just this shot.',
      priorEvidence: (stalledChanges.size >= 2 ? recentStalls : previous.filter((attempt) => proposedChanges.includes(normalize(attempt.change))))
        .map(({ take, change, evidence }) => ({ take, change, evidence })),
    };
  }
  if (!input.historyComplete || !input.promptUsed || !item.retry) {
    return { action: 'review', reason: 'A targeted retry needs the original prompt, attempt history, and a specific change to try.' };
  }
  return {
    action: 'retry_once',
    reason: item.retry.reason,
    nextStep: item.retry.action,
    exactPromptChange: item.retry.exactPromptChange,
    preserve: item.retry.preserve,
    stopIf: `Stop and reassess if the next take does not satisfy this condition: ${item.retry.successCondition}`,
  };
}

export function decideRetry(input) {
  const requirements = input.requirements.map((item) => ({
    id: item.id,
    requirement: item.description,
    evidence: item.observation ?? null,
    ...decideRequirement(item, input),
  }));
  const actions = new Set(requirements.map((item) => item.action));
  let decision;
  if (actions.has('change_approach')) decision = 'change_approach';
  else if (actions.has('review')) decision = 'review';
  else if (actions.size === 1 && actions.has('keep')) decision = 'keep';
  else if (actions.has('edit')) decision = 'edit_first';
  else if (!input.retryPrice || requirements.filter((item) => item.action === 'retry_once').length > 1) decision = 'review';
  else decision = 'propose_one_retry';

  return {
    take: input.take,
    decision,
    retryPrice: input.retryPrice ?? null,
    spendApproved: false,
    reason: {
      change_approach: 'Change the production method for the unresolved requirement before spending again.',
      review: 'Resolve missing evidence, the retry price, or competing changes with the reviewer first.',
      keep: 'All supplied observations pass the listed requirements.',
      edit_first: 'Try the available edit first and review the result before proposing a full rerender.',
      propose_one_retry: 'One targeted change is available for the reviewer to consider at the quoted price.',
    }[decision],
    requirements,
    evidenceSource: 'Observations and proposed fixes supplied by the calling agent or reviewer.',
  };
}
