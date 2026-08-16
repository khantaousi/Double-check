import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import cron from "node-cron";
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';

const BANGLADESH_TZ = 'Asia/Dhaka';

// Lazy load config to prevent startup crashes
const getFirebaseConfig = () => {
    try {
        const configPath = path.join(process.cwd(), "firebase-applet-config.json");
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
        console.error("Failed to read firebase-applet-config.json:", err);
        return {};
    }
};

async function getDb() {
  try {
    const admin = await import("firebase-admin");
    const { getFirestore } = await import("firebase-admin/firestore");
    const config = getFirebaseConfig();

    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: config.projectId,
      });
    }

    const dbId = config.firestoreDatabaseId || config.databaseId;
    return getFirestore(admin.app(), dbId);
  } catch (err) {
    console.error("Firebase Admin Error:", err);
    return null;
  }
}

async function runMaintenance() {
  const now = new Date();
  const db = await getDb();
  if (!db) return;

  console.log(`[${now.toISOString()}] Starting daily maintenance...`);
  try {
    const todayStr = formatInTimeZone(now, BANGLADESH_TZ, 'yyyy-MM-dd');
    const tasksSnapshot = await db.collection('tasks').where('isEveryday', '==', true).get();

    const batch = db.batch();
    let count = 0;

    for (const docSnapshot of tasksSnapshot.docs) {
      const task = docSnapshot.data();
      if (task.status !== 'completed' || !task.completedAt) continue;

      const compDate = formatInTimeZone(parseISO(task.completedAt), BANGLADESH_TZ, 'yyyy-MM-dd');
      if (compDate !== todayStr) {
        const archiveId = db.collection('tasks').doc().id;
        batch.set(db.collection('tasks').doc(archiveId), {
          ...task,
          id: archiveId,
          isEveryday: false,
          isHistorySnapshot: true,
          updatedAt: new Date().toISOString()
        });

        batch.update(docSnapshot.ref, {
          status: 'pending',
          startedAt: null,
          completedAt: null,
          isApproved: false,
          assignedAt: new Date().toISOString(),
          history: [...(task.history || []), {
            status: 'created',
            timestamp: new Date().toISOString(),
            performerName: 'Server Automator',
            note: 'Daily Reset'
          }]
        });
        count++;
      }
    }

    if (count > 0) await batch.commit();
    console.log(`Maintenance completed: ${count} tasks reset.`);
  } catch (error: any) {
    console.error("Maintenance Permission Error (Expected in Preview):", error.message);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  
  // Helper to validate and sanitize HTTP header names (RFC 7230/9110 token rule)
  function sanitizeHeaderName(raw: string | undefined, defaultName: string = 'X-API-KEY'): string {
    if (!raw || typeof raw !== 'string') return defaultName;
    const trimmed = raw.trim();
    // Valid HTTP header token characters: letters, numbers, and allowed punctuation without spaces
    const isValid = /^[a-zA-Z0-9!#$%&'*+-.^_`|~]+$/.test(trimmed);
    if (isValid && trimmed.length > 0) {
      return trimmed;
    }
    return defaultName;
  }

  // Server-side proxy for External Salary API to completely bypass CORS & Mixed-Content issues
  app.post("/api/salary/proxy", async (req, res) => {
    try {
      const {
        apiUrl,
        apiKey,
        authHeaderType = 'ApiKey',
        customHeaderName = 'X-API-KEY',
        queryParamName = 'api_key',
        paramName = 'employee_id',
        httpMethod = 'GET',
        employeeId,
        month,
        year,
        extraBody
      } = req.body || {};

      if (!apiUrl) {
        return res.status(400).json({ ok: false, error: "Missing required 'apiUrl' parameter" });
      }

      // Sanitize API key (remove accidental quotes, newlines, or extra whitespace)
      let cleanedKey = (apiKey && typeof apiKey === 'string') ? apiKey.trim() : '';
      if ((cleanedKey.startsWith('"') && cleanedKey.endsWith('"')) || (cleanedKey.startsWith("'") && cleanedKey.endsWith("'"))) {
        cleanedKey = cleanedKey.slice(1, -1).trim();
      }

      // Helper to build request options and URL
      const buildRequest = (authMode: 'standard' | 'query' | 'raw' | 'all') => {
        let targetUrl = apiUrl.trim();

        // Clean template placeholders like EMPLOYEE_ID, {employee_id}, :employee_id, [employee_id]
        if (employeeId !== undefined && employeeId !== null && employeeId !== '') {
          targetUrl = targetUrl
            .replace(/EMPLOYEE_ID/gi, String(employeeId))
            .replace(new RegExp(`\\{${paramName}\\}`, 'gi'), String(employeeId))
            .replace(new RegExp(`:${paramName}\\b`, 'gi'), String(employeeId))
            .replace(new RegExp(`\\[${paramName}\\]`, 'gi'), String(employeeId));
        }

        const headers: Record<string, string> = {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'ParcelIntelligence-PayrollProxy/1.0'
        };

        const method = (httpMethod || 'GET').toUpperCase();
        let qParamKey = queryParamName && queryParamName.trim() ? queryParamName.trim() : 'api_key';

        if (cleanedKey && authHeaderType !== 'None') {
          if (authMode === 'query' || authHeaderType === 'QueryParam') {
            // Apply key as query param
          } else if (authMode === 'raw' || authHeaderType === 'RawAuth') {
            headers['Authorization'] = cleanedKey;
            headers['X-API-KEY'] = cleanedKey;
          } else {
            // Universal Auth Delivery: Send standard headers together so any server implementation accepts it
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
          // GET method: Attach params cleanly without duplicate query separators
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

        return { targetUrl, fetchOptions, headers };
      };

      // Execution Function
      const executeFetch = async (targetUrl: string, fetchOptions: RequestInit) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        fetchOptions.signal = controller.signal;

        try {
          const remoteRes = await fetch(targetUrl, fetchOptions);
          clearTimeout(timeoutId);

          const contentType = remoteRes.headers.get('content-type') || '';
          let responseData: any;
          if (contentType.includes('application/json')) {
            responseData = await remoteRes.json();
          } else {
            const text = await remoteRes.text();
            try {
              responseData = JSON.parse(text);
            } catch {
              responseData = text;
            }
          }
          return { res: remoteRes, data: responseData, url: targetUrl };
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      };

      // Attempt 1: Standard Universal Multi-Auth
      let req1 = buildRequest('all');
      let result = await executeFetch(req1.targetUrl, req1.fetchOptions);

      // Attempt 2: Auto-Recovery Fallback (If 401 or 403 received, try Query Parameter auth)
      if ((result.res.status === 401 || result.res.status === 403) && cleanedKey) {
        try {
          const req2 = buildRequest('query');
          const result2 = await executeFetch(req2.targetUrl, req2.fetchOptions);
          if (result2.res.ok || result2.res.status === 200) {
            result = result2;
            req1 = req2;
          }
        } catch {
          // Keep initial result if fallback threw network error
        }
      }

      // Safe debug header summary
      const safeHeadersSent: Record<string, string> = {};
      Object.keys(req1.headers).forEach(k => {
        if (k.toLowerCase() === 'authorization') {
          safeHeadersSent[k] = req1.headers[k].length > 15 ? `${req1.headers[k].slice(0, 10)}...${req1.headers[k].slice(-4)}` : '***';
        } else if (k.toLowerCase().includes('key')) {
          safeHeadersSent[k] = req1.headers[k].length > 10 ? `${req1.headers[k].slice(0, 4)}...${req1.headers[k].slice(-4)}` : '***';
        } else {
          safeHeadersSent[k] = req1.headers[k];
        }
      });

      const isHtmlResponse = typeof result.data === 'string' && (result.data.includes('<!DOCTYPE') || result.data.includes('<html') || result.data.includes('The page'));
      const cleanData = isHtmlResponse ? { error: `Server returned non-JSON/HTML page (HTTP ${result.res.status})` } : result.data;

      return res.status(result.res.status).json({
        status: result.res.status,
        ok: result.res.ok && !isHtmlResponse,
        data: cleanData,
        error: !result.res.ok || isHtmlResponse ? (isHtmlResponse ? `External API endpoint returned HTML error (HTTP ${result.res.status})` : (result.data?.message || result.data?.error || `HTTP ${result.res.status}`)) : undefined,
        urlUsed: result.url,
        headersSent: safeHeadersSent
      });
    } catch (error: any) {
      console.error("Salary proxy error:", error);
      const isTimeout = error.name === 'AbortError' || error.message?.includes('aborted');
      return res.status(502).json({
        status: 502,
        ok: false,
        error: isTimeout 
          ? 'External API request timed out after 15 seconds. Please verify the URL or server status.' 
          : (error.message || 'Failed to connect to external Salary API endpoint'),
        details: error.toString()
      });
    }
  });

  app.get("/api/diag", async (req, res) => {
    const db = await getDb();
    if (!db) return res.status(500).json({ status: "error" });
    try {
      const snap = await db.collection('test').limit(1).get();
      res.json({ status: "connected", docs: snap.size });
    } catch(e: any) {
      res.json({ status: "failure", error: e.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    cron.schedule('0 0 * * *', () => runMaintenance().catch(console.error));
  });
}

startServer().catch(console.error);
