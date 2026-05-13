import type { GenerateJob, GenerateJobStatus } from "./generation-types";

type JobStoreGlobal = typeof globalThis & {
  prompterGenerateJobs?: Map<string, GenerateJob>;
};

const store = ((globalThis as JobStoreGlobal).prompterGenerateJobs ??= new Map<string, GenerateJob>());

export function createGenerateJob() {
  const now = new Date().toISOString();
  const job: GenerateJob = {
    id: crypto.randomUUID(),
    status: "queued",
    createdAt: now,
    updatedAt: now,
    message: "Queued"
  };

  store.set(job.id, job);
  return job;
}

export function getGenerateJob(jobId: string) {
  return store.get(jobId) ?? null;
}

export function updateGenerateJob(
  jobId: string,
  update: Partial<Omit<GenerateJob, "id" | "createdAt" | "updatedAt">> & { status?: GenerateJobStatus }
) {
  const current = store.get(jobId);
  if (!current) return null;

  const next: GenerateJob = {
    ...current,
    ...update,
    updatedAt: new Date().toISOString()
  };

  store.set(jobId, next);
  return next;
}
