import { execFile } from 'child_process';

export type BrowserAuthenticatedRequest = {
  baseUrl: string;
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export type BrowserAuthenticatedResponse = {
  status: number;
  statusText: string;
  text: string;
  headers: Record<string, string>;
};

function runOsaScript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function executeBrowserAuthenticatedRequest(
  request: BrowserAuthenticatedRequest
): Promise<BrowserAuthenticatedResponse> {
  const baseUrl = new URL(request.baseUrl);
  const targetUrl = request.path.startsWith('http')
    ? request.path
    : `${baseUrl.origin}${request.path.startsWith('/') ? request.path : `/${request.path}`}`;
  const hostHint = baseUrl.host;

  const js = `
    (function () {
      var xhr = new XMLHttpRequest();
      xhr.open(${JSON.stringify(request.method.toUpperCase())}, ${JSON.stringify(targetUrl)}, false);
      var headers = ${JSON.stringify(request.headers || {})};
      var payload = ${request.body === undefined ? 'null' : JSON.stringify(request.body)};
      Object.keys(headers).forEach(function (key) {
        xhr.setRequestHeader(key, headers[key]);
      });
      xhr.send(payload === null ? null : JSON.stringify(payload));
      var headerLines = xhr.getAllResponseHeaders().trim().split(/\\r?\\n/).filter(Boolean);
      var headerMap = {};
      headerLines.forEach(function (line) {
        var idx = line.indexOf(':');
        if (idx <= 0) return;
        var key = line.slice(0, idx).trim().toLowerCase();
        var value = line.slice(idx + 1).trim();
        headerMap[key] = value;
      });
      return JSON.stringify({
        status: xhr.status,
        statusText: xhr.statusText,
        text: xhr.responseText || '',
        headers: headerMap
      });
    })();
  `.replace(/\n\s+/g, ' ');

  const script = `
    tell application "Safari"
      repeat with w in windows
        repeat with t in tabs of w
          if (URL of t contains ${JSON.stringify(hostHint)}) then
            set current tab of w to t
            return do JavaScript ${JSON.stringify(js)} in document 1
          end if
        end repeat
      end repeat
    end tell
  `;

  const stdout = await runOsaScript(script);
  const parsed = JSON.parse(stdout.trim() || '{}') as BrowserAuthenticatedResponse;
  return {
    status: Number(parsed.status || 0),
    statusText: parsed.statusText || '',
    text: parsed.text || '',
    headers: parsed.headers || {},
  };
}

export function parseBrowserAuthenticatedJson<T>(response: BrowserAuthenticatedResponse): T {
  const contentType = response.headers['content-type'] || '';
  if (contentType.includes('application/json') && response.text.trim()) {
    return JSON.parse(response.text) as T;
  }
  if (!response.text.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(response.text) as T;
  } catch {
    return response.text as T;
  }
}
