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
