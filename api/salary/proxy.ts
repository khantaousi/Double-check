import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-API-KEY, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  const {
    apiUrl,
    apiKey,
    authHeaderType,
    customHeaderName,
    queryParamName,
    paramName = 'employee_id',
    httpMethod = 'GET',
    employeeId,
    month,
    year,
    body: extraBody
  } = req.body || {};

  if (!apiUrl) {
    return res.status(400).json({
      ok: false,
      error: 'API URL is required'
    });
  }

  const sanitizeHeaderName = (name: string, fallback: string) => {
    if (!name || typeof name !== 'string') return fallback;
    const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '').trim();
    return sanitized || fallback;
  };

  const executeRequest = async (authMode: 'all' | 'x-api-key' | 'bearer' | 'custom' | 'query') => {
    let targetUrl = String(apiUrl).trim()
      .replace(/EMPLOYEE_ID/gi, String(employeeId || ''))
      .replace(new RegExp(`\\{${paramName}\\}`, 'gi'), String(employeeId || ''))
      .replace(new RegExp(`:${paramName}\\b`, 'gi'), String(employeeId || ''));

    const cleanedKey = (apiKey || '').trim();
    const qParamKey = (queryParamName || 'api_key').trim() || 'api_key';
    const method = (httpMethod || 'GET').toUpperCase();

    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'DA-Team-Intelligence/2.0 (Vercel Serverless Proxy)'
    };

    if (cleanedKey) {
      if (authMode === 'x-api-key') {
        headers['X-API-KEY'] = cleanedKey;
        headers['x-api-key'] = cleanedKey;
      } else if (authMode === 'bearer') {
        headers['Authorization'] = cleanedKey.toLowerCase().startsWith('bearer ') ? cleanedKey : `Bearer ${cleanedKey}`;
      } else if (authMode === 'custom' && customHeaderName) {
        const customName = sanitizeHeaderName(customHeaderName, 'X-API-KEY');
        headers[customName] = cleanedKey;
      } else if (authMode === 'all') {
        const bearerVal = cleanedKey.toLowerCase().startsWith('bearer ') ? cleanedKey : `Bearer ${cleanedKey}`;
        headers['Authorization'] = bearerVal;
        headers['X-API-KEY'] = cleanedKey;
        headers['x-api-key'] = cleanedKey;
        headers['api-key'] = cleanedKey;
        headers['apikey'] = cleanedKey;

        if (customHeaderName && customHeaderName.trim()) {
          const customName = sanitizeHeaderName(customHeaderName, 'X-API-KEY');
          headers[customName] = cleanedKey;
        }
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers
    };

    const isQueryKey = (authMode === 'query' || authHeaderType === 'QueryParam') && Boolean(cleanedKey);

    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
      const postBody: Record<string, any> = {
        [paramName]: employeeId,
        month,
        year,
        ...(extraBody || {})
      };
      if (isQueryKey) {
        postBody[qParamKey] = cleanedKey;
        postBody['apiKey'] = cleanedKey;
        postBody['api_key'] = cleanedKey;
      }
      fetchOptions.body = JSON.stringify(postBody);

      if (isQueryKey) {
        try {
          const parsedUrl = new URL(targetUrl);
          parsedUrl.searchParams.set(qParamKey, cleanedKey);
          targetUrl = parsedUrl.toString();
        } catch {
          const sep = targetUrl.includes('?') ? '&' : '?';
          targetUrl += `${sep}${encodeURIComponent(qParamKey)}=${encodeURIComponent(cleanedKey)}`;
        }
      }
    } else {
      try {
        const parsedUrl = new URL(targetUrl);
        if (employeeId !== undefined && employeeId !== null && employeeId !== '') {
          parsedUrl.searchParams.set(paramName, String(employeeId));
        }
        if (month) parsedUrl.searchParams.set('month', String(month));
        if (year) parsedUrl.searchParams.set('year', String(year));
        if (isQueryKey) {
          parsedUrl.searchParams.set(qParamKey, cleanedKey);
          parsedUrl.searchParams.set('api_key', cleanedKey);
        }
        targetUrl = parsedUrl.toString();
      } catch {
        const separator = targetUrl.includes('?') ? '&' : '?';
        const params: string[] = [];
        if (employeeId !== undefined && employeeId !== null && employeeId !== '') {
          params.push(`${encodeURIComponent(paramName)}=${encodeURIComponent(String(employeeId))}`);
        }
        if (month) params.push(`month=${encodeURIComponent(String(month))}`);
        if (year) params.push(`year=${encodeURIComponent(String(year))}`);
        if (isQueryKey) {
          params.push(`${encodeURIComponent(qParamKey)}=${encodeURIComponent(cleanedKey)}`);
        }
        if (params.length > 0) {
          targetUrl += `${separator}${params.join('&')}`;
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(targetUrl, {
        ...fetchOptions,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      let parsedData: any = null;
      try {
        parsedData = JSON.parse(text);
      } catch {
        parsedData = null;
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType,
        data: parsedData || text,
        urlUsed: targetUrl
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return {
        ok: false,
        status: 500,
        statusText: 'Fetch Error',
        error: err.name === 'AbortError' ? 'Target external API timed out after 20 seconds' : (err.message || 'Network request failed'),
        urlUsed: targetUrl
      };
    }
  };

  try {
    let modeToTry: 'all' | 'x-api-key' | 'bearer' | 'custom' | 'query' = 'x-api-key';
    if (authHeaderType === 'Bearer') modeToTry = 'bearer';
    else if (authHeaderType === 'Custom') modeToTry = 'custom';
    else if (authHeaderType === 'QueryParam') modeToTry = 'query';
    else if (authHeaderType === 'All') modeToTry = 'all';

    let result = await executeRequest(modeToTry);

    if (!result.ok && (result.status === 401 || result.status === 403)) {
      // Try with query parameter and all headers combined
      const fallbackResult = await executeRequest('all');
      if (fallbackResult.ok) {
        result = fallbackResult;
      }
    }

    return res.status(result.ok ? 200 : (result.status >= 200 && result.status < 600 ? result.status : 502)).json({
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal proxy execution failed'
    });
  }
}
