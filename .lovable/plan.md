# Fix generation credits, survivable jobs, and make failures rare

Three problems today: a failed generation still burns a monthly generation credit, a run only lives inside the open page (navigate away and it is lost; fail and it is gone with no retry), and the self-repair loop gives the model weak, repetitive feedback so a bad first draft often stays bad.

## 1. Only charge for successful generations

Right now the usage counter is incremented before the model is called, and nothing gives it back if the run fails.

- Add a "release" path to usage metering that decrements the `generations` counter (never below 0) for the current billing period.
- In the generation server function, wrap the model call: if the job ends in `error` (model failure, rate limit, credits exhausted, or 3 failed repair attempts), release the credit before returning.
- Keep the pre-check so an over-limit creator is still blocked up front — the change is purely "failed runs don't count".
- Surface it in the UI: when a generation fails, the error panel says the attempt was not counted against the plan.

## 2. Make the repair loop actually recover

Changes in the generation logic:

- **Targeted repair instead of a full rewrite.** Send back only the failing paths plus the offending values, with a short "how to fix" line per error class (band-name mismatch, subscale not in `meta.subscales`, range/scale inconsistency, bad `results.style`, non-hex colour, missing attention check). Ask for the corrected complete JSON but with an explicit instruction to keep everything that already validated unchanged.
- **Attempt budget of 4 with a strategy per attempt:** (1) normal draft, (2) targeted repair at the same temperature, (3) targeted repair with temperature forced low (0.1–0.2) and the failing sections restated, (4) last-resort repair on a strong fallback model (GPT-5.4) rather than the same model that already failed twice.
- **Auto-fix the deterministic errors in code instead of asking the model.** Several recurring failures are mechanical and can be repaired locally before validation: normalising hex colours, clamping `results.style` to the allowed list (and downgrading radar to bars when fewer than 3 subscales), renaming interpretation band keys to match the scoring band names, dropping items whose subscale is unknown or adding the subscale, and deriving missing ranges from the response scale. This alone removes most of the 3-attempt failures.
- **Separate transport errors from schema errors.** A 429/5xx is retried with backoff and does not consume a repair attempt; a 402/403/400 is terminal and fails fast with a clear message (and, per point 1, no credit charged).
- **Persist attempt history** on the job's `errors` field (per-attempt error lists) so the failure panel can show what was wrong and what the retries changed.

Same treatment for the visuals generation loop, which has the identical weak-feedback pattern.

## 3. A run must survive navigation and be retryable

Today the request only exists inside the open Generate page: leaving it loses the run, and a failure leaves nothing to act on.

- **Recent runs panel on the Generate page.** The job row already exists in the database from the moment generation starts, so list the creator's recent jobs (status, request, model, time) above the form. A running job shows a live status that keeps polling; a done job links to its test; a failed job shows what went wrong.
- **Resume on return.** Remember the in-flight job id locally so reopening the page reattaches to it instead of showing a blank form, and mark jobs left in `running` past a sane age as timed out (rather than spinning forever).
- **Retry and edit-and-retry.** Each failed job gets "Try again" (same request, same settings) and "Edit request" (prefills the form with the original request, path hint, model, temperature so it can be adjusted). Retries of a failed run are not charged an extra credit.
- **Better in-progress copy.** Replace the long paragraph with a short line plus a visible stage indicator (drafting → validating → repairing attempt N → building visuals) and a note that it is safe to leave the page.

## Technical notes

- `src/lib/usage.server.ts`: add `releaseGeneration(userId)` using the existing period logic and a guarded decrement.
- `src/lib/generation.functions.ts`: call the release in the `catch` branch and in the "no spec produced" branch; include `counted: false` in the returned payload; add a `retryGeneration({ jobId })` function that re-runs a failed job's stored request without recounting, and stage/attempt info on the job row.
- `src/lib/llm.server.ts`: split `callModel` errors into retryable vs terminal, add `coerceSpec()` for the mechanical fixes, build a structured repair message from validation issue paths, and add the low-temperature + fallback-model escalation.
- `src/routes/_authenticated/generate.tsx`: recent-jobs list backed by the existing `listGenerationJobs`, polling via `getGenerationJob` while a job is running, retry/edit actions, per-attempt errors, and the "this attempt was not charged" note.
- No database schema change needed — `generation_jobs.errors` is already JSON and can hold stage plus per-attempt history.

## Verification

Run a real generation against the gateway (success path), then force a failure by requesting an impossible spec and confirm the job records `error`, the usage counter is unchanged, the failed job appears in the recent list after a reload, and retry works from there.
