import { prisma } from '@arxion/database';
import { addFinding } from './review-findings.service.js';
import { detectContractRisks } from '../coordination/coordination.service.js';

/**
 * Run an AI-assisted review.
 *
 * The AI review analyses:
 * - acceptance criteria coverage
 * - contract impact
 * - scope deviations
 * - test failures
 * - known issues
 * - dependency impact
 *
 * AI review NEVER approves the review by itself.
 * It only creates SYSTEM/AI findings to assist the human reviewer.
 */
export async function runAiReview(reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      task: {
        include: {
          contracts: true,
          workIntents: true,
          dependencies: { include: { dependsOn: true } },
        },
      },
      snapshot: true,
      findings: true,
    },
  });
  if (!review) throw Object.assign(new Error(`Review not found: ${reviewId}`), { statusCode: 404 });

  if (review.status !== 'IN_REVIEW' && review.status !== 'PENDING') {
    throw Object.assign(
      new Error(`AI review can only run on reviews in IN_REVIEW or PENDING status (current: ${review.status}).`),
      { statusCode: 422 },
    );
  }

  const findings: Awaited<ReturnType<typeof addFinding>>[] = [];

  // 1. Completion report analysis
  const completionReport = await prisma.taskCompletionReport.findFirst({
    where: { taskId: review.taskId },
    orderBy: { createdAt: 'desc' },
  });

  if (!completionReport) {
    findings.push(
      await addFinding(reviewId, {
        source: 'AI',
        category: 'GENERAL',
        severity: 'HIGH',
        title: 'No completion report found',
        description: 'A completion report with evidence (files changed, tests, revision) is required before this work can be reviewed.',
        isBlocking: true,
      }),
    );
  } else {
    // Test failures
    if (completionReport.testsFailed > 0) {
      findings.push(
        await addFinding(reviewId, {
          source: 'AI',
          category: 'TEST',
          severity: completionReport.testsFailed > 0 ? 'HIGH' : 'MEDIUM',
          title: `${completionReport.testsFailed} test(s) failed`,
          description: `The completion report shows ${completionReport.testsFailed} test(s) failed out of ${completionReport.testsRun} run. All tests should pass before merging.`,
          isBlocking: completionReport.testsFailed > 0,
        }),
      );
    }

    // Known issues
    if (completionReport.knownIssues) {
      findings.push(
        await addFinding(reviewId, {
          source: 'AI',
          category: 'GENERAL',
          severity: 'LOW',
          title: 'Known issues reported',
          description: `The agent reported known issues: ${completionReport.knownIssues}`,
          isBlocking: false,
        }),
      );
    }

    // Scope deviations
    const workIntent = review.task.workIntents[0];
    if (workIntent) {
      const declared = new Set(workIntent.files);
      const actual = new Set(completionReport.filesChanged);
      const undeclared = completionReport.filesChanged.filter((f) => !declared.has(f));

      if (undeclared.length > 0) {
        findings.push(
          await addFinding(reviewId, {
            source: 'AI',
            category: 'SCOPE',
            severity: 'MEDIUM',
            title: `${undeclared.length} undeclared file(s) modified`,
            description: `Files were modified that were not declared in the work intent: ${undeclared.join(', ')}`,
            isBlocking: false,
          }),
        );
      }

      const notInReport = workIntent.files.filter((f) => !actual.has(f));
      if (notInReport.length > 0) {
        findings.push(
          await addFinding(reviewId, {
            source: 'AI',
            category: 'SCOPE',
            severity: 'LOW',
            title: `${notInReport.length} declared file(s) not in completion report`,
            description: `Files declared in work intent were not listed in the completion report: ${notInReport.join(', ')}`,
            isBlocking: false,
          }),
        );
      }
    }
  }

  // 2. Contract impact analysis
  const contractRisks = await detectContractRisks(review.taskId, review.task.projectId);
  if (contractRisks.length > 0) {
    for (const risk of contractRisks) {
      findings.push(
        await addFinding(reviewId, {
          source: 'AI',
          category: 'CONTRACT',
          severity: 'MEDIUM',
          title: `Contract change affects task ${risk.affectedTaskDisplayId}`,
          description: `This task ${risk.sourceRelationship} "${risk.contractName}" (${risk.contractType}), which task ${risk.affectedTaskDisplayId} ${risk.affectedRelationship}. Verify the contract change is backward-compatible or coordinate with the affected task.`,
          contractName: risk.contractName,
          isBlocking: false,
        }),
      );
    }
  }

  // 3. Dependency completeness check
  type DepRow = (typeof review.task.dependencies)[number];
  const blockedDeps = review.task.dependencies.filter(
    (d: DepRow) => d.dependsOn.status !== 'DONE',
  );
  if (blockedDeps.length > 0) {
    findings.push(
      await addFinding(reviewId, {
        source: 'AI',
        category: 'DEPENDENCY',
        severity: 'HIGH',
        title: `${blockedDeps.length} dependency(ies) not yet DONE`,
        description: `The following dependencies are not complete: ${blockedDeps.map((d: DepRow) => `${d.dependsOn.displayId} (${d.dependsOn.status})`).join(', ')}`,
        isBlocking: true,
      }),
    );
  }

  // 4. Task description / acceptance criteria
  if (!review.task.description) {
    findings.push(
      await addFinding(reviewId, {
        source: 'AI',
        category: 'GENERAL',
        severity: 'INFO',
        title: 'No task description or acceptance criteria',
        description: 'The task has no description. Consider adding acceptance criteria for future reviews.',
        isBlocking: false,
      }),
    );
  }

  await prisma.taskActivity.create({
    data: {
      projectId: review.task.projectId,
      taskId: review.taskId,
      type: 'review.started',
      message: `AI review completed for Review v${review.reviewVersion}: ${findings.length} finding(s) created.`,
      metadata: { reviewId: review.id, findingsCreated: findings.length },
    },
  });

  return { findings, reviewId, findingsCreated: findings.length };
}
