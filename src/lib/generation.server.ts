import { generateSpec, type GenerationStage } from "./llm.server";
import type { TestSpec } from "./spec";

export type JobProgress = {
  stage: string;
  attempt: number;
  history: string[][];
  message?: string;
  details?: string[];
  counted?: boolean;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function stageLabel(stage: GenerationStage): string {
  if (stage.kind === "drafting") return stage.attempt === 1 ? "Drafting the questionnaire" : `Redrafting (attempt ${stage.attempt})`;
  if (stage.kind === "validating") return "Validating the spec";
  return `Repairing validation issues (attempt ${stage.attempt})`;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function writeProgress(jobId: string, progress: JobProgress, status?: string) {
  const client = await db();
  await client
    .from("generation_jobs")
    .update({ errors: JSON.parse(JSON.stringify(progress)), ...(status ? { status } : {}) })
    .eq("id", jobId);
}

export type RunResult =
  | { ok: true; testId: string; attempts: number; errors: string[] }
  | { ok: false; testId: null; errors: string[]; terminal: boolean };

/**
 * Runs one generation job to completion, keeping the job row up to date so the page can
 * be closed and reopened without losing the run.
 */
export async function runGenerationJob(input: {
  jobId: string;
  userId: string;
  request: string;
  pathHint: string;
  model: string;
  temperature: number;
  counted: boolean;
}): Promise<RunResult> {
  const client = await db();
  const history: string[][] = [];

  await writeProgress(input.jobId, { stage: "Starting", attempt: 1, history, counted: input.counted }, "running");

  let spec: TestSpec;
  let attempts = 1;
  try {
    const result = await generateSpec({
      request: input.request,
      pathHint: input.pathHint,
      model: input.model,
      temperature: input.temperature,
      onStage: async (stage) => {
        if (stage.kind === "repairing") history.push(stage.errors);
        await writeProgress(input.jobId, {
          stage: stageLabel(stage),
          attempt: stage.kind === "validating" ? 1 : stage.attempt,
          history,
          counted: input.counted,
        });
      },
    });
    spec = result.spec;
    attempts = result.attempts;
  } catch (err) {
    const message = (err as Error).message;
    const details = (err as Error & { details?: string[] }).details ?? [];
    const terminal = (err as { retryable?: boolean }).retryable === false;
    await writeProgress(
      input.jobId,
      { stage: "Failed", attempt: attempts, history, message, details, counted: false },
      "error",
    );
    return { ok: false, testId: null, errors: [message, ...details], terminal };
  }

  const { data: test, error: testError } = await client
    .from("tests")
    .insert({
      creator_id: input.userId,
      title: spec.instructions.title,
      slug: slugify(spec.instructions.title),
      spec: JSON.parse(JSON.stringify(spec)),
      published: false,
    })
    .select("id")
    .single();

  if (testError || !test) {
    const message = testError?.message ?? "Could not save the generated questionnaire.";
    await writeProgress(
      input.jobId,
      { stage: "Failed", attempt: attempts, history, message, details: [], counted: false },
      "error",
    );
    return { ok: false, testId: null, errors: [message], terminal: true };
  }

  await client
    .from("generation_jobs")
    .update({
      status: "done",
      test_id: test.id,
      errors: JSON.parse(JSON.stringify({ stage: "Done", attempt: attempts, history, counted: input.counted })),
    })
    .eq("id", input.jobId);

  return { ok: true, testId: test.id, attempts, errors: [] };
}
