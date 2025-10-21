import axios from 'axios';

export async function resolveFinalUrl(url: string, timeoutMs = 15000): Promise<string> {
  try {
    const resp = await axios.get(url, {
      maxRedirects: 10,
      timeout: timeoutMs,
      validateStatus: (s) => s >= 200 && s < 400 // allow 3xx
    });
    const anyReq: any = resp.request;
    const finalUrl = anyReq?.res?.responseUrl || resp.config?.url || url;
    return finalUrl;
  } catch {
    return url;
  }
}


