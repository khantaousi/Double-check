import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage & { body?: any; query?: any }, res: ServerResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-API-KEY, Authorization, x-api-key, api-key'
  );
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // Helper to read request body stream if not parsed
  let bodyData: any = {};
  if (req.body && typeof req.body === 'object') {
    bodyData = req.body;
  } else {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const dataStr = Buffer.concat(buffers).toString();
      if (dataStr) {
        bodyData = JSON.parse(dataStr);
      }
    } catch {
      bodyData = {};
    }
  }

  const {
    apiUrl,
    apiKey,
    paramName = 'employee_id',
    httpMethod = 'GET',
    employeeId,
    month,
    year,
    body: extraBody
  } = bodyData || {};

  if (!apiUrl) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: 'API URL is required' }));
    return;
  }

  const cleanKey = String(apiKey || '').trim();
  let targetUrl = String(apiUrl).trim()
    .replace(/EMPLOYEE_ID/gi, String(employeeId || ''))
    .replace(new RegExp(`\\{${paramName}\\}`, 'gi'), String(employeeId || ''))
    .replace(new RegExp(`:${paramName}\\b`, 'gi'), String(employeeId || ''));

  // Ensure employee_id query param
  try {
    const parsedUrl = new URL(targetUrl);
    if (employeeId !== undefined && employeeId !== null && employeeId !== '') {
      parsedUrl.searchParams.set(paramName, String(employeeId));
    }
    if (month) parsedUrl.searchParams.set('month', String(month));
    if (year) parsedUrl.searchParams.set('year', String(year));
    if (cleanKey) {
      parsedUrl.searchParams.set('api_key', cleanKey);
    }
    targetUrl = parsedUrl.toString();
  } catch {
    const sep = targetUrl.includes('?') ? '&' : '?';
    targetUrl += `${sep}${encodeURIComponent(paramName)}=${encodeURIComponent(String(employeeId || ''))}`;
    if (cleanKey) {
      targetUrl += `&api_key=${encodeURIComponent(cleanKey)}`;
    }
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DA-Intelligence/2.0'
  };

  if (cleanKey) {
    headers['X-API-KEY'] = cleanKey;
    headers['x-api-key'] = cleanKey;
    headers['api-key'] = cleanKey;
    headers['apikey'] = cleanKey;
    headers['Authorization'] = cleanKey.toLowerCase().startsWith('bearer ') ? cleanKey : `Bearer ${cleanKey}`;
  }

  const fetchOptions: RequestInit = {
    method: (httpMethod || 'GET').toUpperCase(),
    headers
  };

  if (fetchOptions.method === 'POST') {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify({
      [paramName]: employeeId,
      api_key: cleanKey,
      month,
      year,
      ...(extraBody || {})
    });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(targetUrl, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(timer);

    const rawText = await response.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = rawText;
    }

    res.statusCode = response.ok ? 200 : (response.status >= 200 && response.status < 600 ? response.status : 502);
    res.end(
      JSON.stringify({
        ok: response.ok,
        status: response.status,
        data: parsed,
        urlUsed: targetUrl,
        timestamp: new Date().toISOString()
      })
    );
  } catch (err: any) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        ok: false,
        status: 500,
        error: err.name === 'AbortError' ? 'Target API request timed out (25s)' : (err.message || 'Fetch failed'),
        urlUsed: targetUrl
      })
    );
  }
}
