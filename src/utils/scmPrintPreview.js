const DEFAULT_STATION_URL = 'http://127.0.0.1:5050/';
const LAST_PRINT_JOB_KEY = 'envaperu_scm_last_pending_print_job';

export const buildScmPrelabelPreviewUrl = (printJobId) => {
  const configured = String(
    import.meta.env.VITE_SCM_WEIGHING_STATION_URL || DEFAULT_STATION_URL,
  ).trim();
  const base = configured || DEFAULT_STATION_URL;
  const url = new URL(
    base.endsWith('/') ? base : `${base}/`,
    globalThis.location?.origin || DEFAULT_STATION_URL,
  );
  url.searchParams.set('tab', 'scm-prelabels');
  url.searchParams.set('job', String(printJobId || '').trim());
  return url.toString();
};

export const loadLastPendingPrintJob = () => {
  try {
    const stored = globalThis.sessionStorage?.getItem(LAST_PRINT_JOB_KEY);
    if (!stored) return null;
    const job = JSON.parse(stored);
    return job?.print_job_id ? job : null;
  } catch {
    return null;
  }
};

export const storeLastPendingPrintJob = (job) => {
  if (!job?.print_job_id) return;
  try {
    globalThis.sessionStorage?.setItem(LAST_PRINT_JOB_KEY, JSON.stringify(job));
  } catch {
    // La navegación sigue funcionando aunque el navegador bloquee storage.
  }
};
