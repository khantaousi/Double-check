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

      const headers: Record<string, string> = {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'ParcelIntelligence-PayrollProxy/1.0'
      };

      // Sanitize API key (remove accidental quotes or whitespace)
      let cleanedKey = (apiKey && typeof apiKey === 'string') ? apiKey.trim() : '';
      if ((cleanedKey.startsWith('"') && cleanedKey.endsWith('"')) || (cleanedKey.startsWith("'") && cleanedKey.endsWith("'"))) {
        cleanedKey = cleanedKey.slice(1, -1).trim();
      }

      let isQueryAuth = false;

      let targetUrl = apiUrl.trim();

      // Clean template placeholders like EMPLOYEE_ID, {employee_id}, :employee_id
      if (employeeId !== undefined && employeeId !== null && employeeId !== '') {
        targetUrl = targetUrl
          .replace(/EMPLOYEE_ID/gi, String(employeeId))
          .replace(new RegExp(`\\{${paramName}\\}`, 'gi'), String(employeeId))
          .replace(new RegExp(`:${paramName}\\b`, 'gi'), String(employeeId));
      }

      if (cleanedKey && authHeaderType !== 'None') {
        if (authHeaderType === 'Bearer') {
          const authVal = cleanedKey.toLowerCase().startsWith('bearer ') ? cleanedKey : `Bearer ${cleanedKey}`;
          headers['Authorization'] = authVal;
          // Also set X-API-KEY for maximum compatibility with AI Studio Express routes
          headers['X-API-KEY'] = cleanedKey;
        } else if (authHeaderType === 'Token') {
          const authVal = cleanedKey.toLowerCase().startsWith('token ') ? cleanedKey : `Token ${cleanedKey}`;
          headers['Authorization'] = authVal;
        } else if (authHeaderType === 'RawAuth') {
          headers['Authorization'] = cleanedKey;
        } else if (authHeaderType === 'ApiKey') {
          const headerName = sanitizeHeaderName(customHeaderName, 'X-API-KEY');
          try {
            headers[headerName] = cleanedKey;
            // Also provide Authorization Bearer fallback
            headers['Authorization'] = `Bearer ${cleanedKey}`;
          } catch {
            headers['X-API-KEY'] = cleanedKey;
          }
        } else if (authHeaderType === 'Custom') {
          const headerName = sanitizeHeaderName(customHeaderName, 'X-API-KEY');
          try {
            headers[headerName] = cleanedKey;
          } catch {
            headers['X-API-KEY'] = cleanedKey;
          }
        } else if (authHeaderType === 'QueryParam') {
          isQueryAuth = true;
        }
      }
      const method = (httpMethod || 'GET').toUpperCase();
      const fetchOptions: RequestInit = {
        method,
        headers
      };

      const qParamKey = queryParamName && queryParamName.trim() ? queryParamName.trim() : 'api_key';

      if (method === 'POST') {
        headers['Content-Type'] = 'application/json';
        const postBody: Record<string, any> = {
          [paramName]: employeeId,
          month,
          year,
          ...(extraBody || {})
        };
        if (isQueryAuth && cleanedKey) {
          postBody[qParamKey] = cleanedKey;
        }
        fetchOptions.body = JSON.stringify(postBody);

        if (isQueryAuth && cleanedKey) {
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
          if (isQueryAuth && cleanedKey) {
            parsedUrl.searchParams.set(qParamKey, cleanedKey);
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
          if (isQueryAuth && cleanedKey) {
            params.push(`${encodeURIComponent(qParamKey)}=${encodeURIComponent(cleanedKey)}`);
          }
          if (params.length > 0) {
            targetUrl += `${separator}${params.join('&')}`;
          }
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      fetchOptions.signal = controller.signal;

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

      // Safe debug header summary
      const safeHeadersSent: Record<string, string> = {};
      Object.keys(headers).forEach(k => {
        if (k.toLowerCase() === 'authorization') {
          safeHeadersSent[k] = headers[k].length > 15 ? `${headers[k].slice(0, 10)}...${headers[k].slice(-4)}` : '***';
        } else if (k.toLowerCase().includes('key')) {
          safeHeadersSent[k] = headers[k].length > 10 ? `${headers[k].slice(0, 4)}...${headers[k].slice(-4)}` : '***';
        } else {
          safeHeadersSent[k] = headers[k];
        }
      });

      return res.status(remoteRes.status).json({
        status: remoteRes.status,
        ok: remoteRes.ok,
        data: responseData,
        urlUsed: targetUrl,
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
