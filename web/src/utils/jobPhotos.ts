import type { Job } from '../types/models';

/** A job's photos (a job may have none). */
export function jobPhotos(job: Pick<Job, 'photos'>): string[] {
  return job.photos ?? [];
}
