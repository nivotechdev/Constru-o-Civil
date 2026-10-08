// Shared by the tests: the demo database exactly as the store starts with it.
import * as seed from '../data/seed';
import type { Database } from '../types/models';

export const seedDatabase = (): Database =>
  structuredClone({
    accounts: seed.ACCOUNTS,
    companies: seed.COMPANIES,
    workers: seed.WORKERS,
    jobs: seed.JOBS,
    applications: seed.APPLICATIONS,
    savedJobIds: seed.SAVED_JOB_IDS,
    deletedJobIds: [],
    workerPosts: seed.WORKER_POSTS,
    notifications: seed.NOTIFICATIONS,
    boostPayments: seed.BOOST_PAYMENTS
  });
