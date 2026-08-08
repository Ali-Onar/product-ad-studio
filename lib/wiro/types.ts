/**
 * Wiro API contract.
 * Docs: https://wiro.ai/docs/introduction, https://wiro.ai/docs/tasks
 */

/** Statuses that mean the task is still moving — keep polling. */
export const WIRO_RUNNING_STATUSES = [
  "task_queue",
  "task_accept",
  "task_assign",
  "task_preprocess_start",
  "task_preprocess_end",
  "task_start",
  "task_output",
] as const;

/** Statuses that mean the task will not change again — stop polling. */
export const WIRO_TERMINAL_STATUSES = ["task_postprocess_end", "task_cancel", "task_error"] as const;

export type WiroTaskStatus =
  | (typeof WIRO_RUNNING_STATUSES)[number]
  | (typeof WIRO_TERMINAL_STATUSES)[number];

export interface WiroError {
  code: number;
  message: string;
  time?: number;
}

/** Every Wiro endpoint wraps its payload in these two fields. */
export interface WiroResponse {
  result: boolean;
  errors: WiroError[];
}

export interface WiroRunResponse extends WiroResponse {
  taskid?: string;
  socketaccesstoken?: string;
}

export interface WiroTaskOutput {
  id: string;
  name: string;
  contenttype: string;
  size: string;
  url: string;
  /** Needed to fetch protected output files from the CDN. */
  accesskey?: string;
}

export interface WiroTask {
  id: string;
  socketaccesstoken: string;
  status: WiroTaskStatus;
  /** Process exit code as a string. "0" means success; anything else failed. */
  pexit?: string;
  outputs?: WiroTaskOutput[];
  debugoutput?: string;
  starttime?: string;
  endtime?: string;
  elapsedseconds?: string;
  totalcost?: string;
}

export interface WiroTaskDetailResponse extends WiroResponse {
  total?: string;
  tasklist?: WiroTask[];
}

export function isTerminalWiroStatus(status: WiroTaskStatus) {
  return (WIRO_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/**
 * A task only counts as successful when it reached the end of postprocessing
 * with a zero exit code and actually produced files.
 */
export function isSuccessfulWiroTask(task: WiroTask) {
  return (
    task.status === "task_postprocess_end" &&
    task.pexit === "0" &&
    (task.outputs?.length ?? 0) > 0
  );
}
