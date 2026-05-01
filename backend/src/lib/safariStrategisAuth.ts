import { execFile } from 'child_process';

function runOsaScript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function getSafariStrategisAuthToken(): Promise<string | null> {
  const script = `
    tell application "Safari"
      repeat with w in windows
        repeat with t in tabs of w
          if (URL of t contains "strategis.lincx.la") then
            set current tab of w to t
            return do JavaScript "localStorage.getItem('_aui_authToken')" in current tab of w
          end if
        end repeat
      end repeat
    end tell
  `;

  try {
    const raw = (await runOsaScript(script)).trim();
    if (!raw || raw === 'null') return null;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
    } catch {
      // Safari sometimes returns the raw string directly.
    }
    return raw;
  } catch {
    return null;
  }
}
