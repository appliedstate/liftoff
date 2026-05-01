import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type LocalMeetingReport = {
  window: {
    since: string;
    through: string;
    days: number;
  };
  summary: {
    recentMeetingCount: number;
    recentDecisionCount: number;
    recentActionCount: number;
    openActionCount: number;
    overdueActionCount: number;
    dueSoonActionCount: number;
    unassignedActionCount: number;
    heaviestOwner: string | null;
    heaviestOwnerOpenActionCount: number;
    dominantTheme: string | null;
  };
  recentMeetings: Array<{
    slug: string;
    meetingDate: string;
    title: string;
    participantCount: number;
    decisionCount: number;
    actionCount: number;
  }>;
  highPriorityOpenActions: Array<{
    slug: string;
    meetingDate: string;
    title: string;
    description: string;
    ownerName: string;
    dueAt: string | null;
    priority: string;
    status: string;
  }>;
  ownerQueues: Array<{
    ownerName: string;
    openActionCount: number;
    highPriorityCount: number;
  }>;
  recurringThemes: Array<{
    theme: string;
    mentionCount: number;
  }>;
  operatorRead: string;
};

type LocalMeetingBootstrapResult = {
  db_path: string;
  meeting_count: number;
  overview: Array<{
    slug: string;
    meeting_date: string;
    title: string;
    participant_count: number;
    decision_count: number;
    action_count: number;
  }>;
};

function repoScriptPath(scriptName: string) {
  return path.resolve(__dirname, '../../../scripts', scriptName);
}

async function runPythonJson<T>(scriptName: string, args: string[] = []): Promise<T> {
  const scriptPath = repoScriptPath(scriptName);
  const { stdout, stderr } = await execFileAsync('python3', [scriptPath, ...args], {
    cwd: path.resolve(__dirname, '../../..'),
    maxBuffer: 1024 * 1024 * 8,
  });

  if (stderr?.trim()) {
    console.warn(`[localMeetingReport] ${scriptName} stderr:`, stderr.trim());
  }

  return JSON.parse(stdout) as T;
}

export async function getLocalMeetingReport(options?: {
  days?: number;
  limitActions?: number;
  limitOwners?: number;
  limitThemes?: number;
}): Promise<LocalMeetingReport> {
  const args = ['--format', 'json'];
  if (options?.days) args.push('--days', String(options.days));
  if (options?.limitActions) args.push('--limit-actions', String(options.limitActions));
  if (options?.limitOwners) args.push('--limit-owners', String(options.limitOwners));
  if (options?.limitThemes) args.push('--limit-themes', String(options.limitThemes));
  return runPythonJson<LocalMeetingReport>('report_local_meeting_db.py', args);
}

export async function rebuildLocalMeetingReport(options?: {
  days?: number;
  limitActions?: number;
  limitOwners?: number;
  limitThemes?: number;
}): Promise<{ bootstrap: LocalMeetingBootstrapResult; report: LocalMeetingReport }> {
  const bootstrap = await runPythonJson<LocalMeetingBootstrapResult>('bootstrap_local_meeting_db.py');
  const report = await getLocalMeetingReport(options);
  return { bootstrap, report };
}
