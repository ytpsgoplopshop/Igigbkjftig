import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Real-time synchronization
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

const PORT = process.env.PORT || 3000;

// UNLIMITED DYNAMIC SUPABASE ACCOUNTS DISCOVERY ENGINE (Optimized)
function getSupabaseClients() {
  const clients = [];
  const registeredUrls = new Set();

  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    clients.push({
      id: 1,
      name: "Account 1 (Primary)",
      client: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY),
      bucket: process.env.SUPABASE_BUCKET || 'songs'
    });
    registeredUrls.add(process.env.SUPABASE_URL);
  }

  const envKeys = Object.keys(process.env);
  const detectedIndices = new Set();

  envKeys.forEach(k => {
    const match = k.match(/^SUPABASE_URL_(\d+)$/i);
    if (match) {
      detectedIndices.add(parseInt(match[1], 10));
    }
  });

  const sortedIndices = Array.from(detectedIndices).sort((a, b) => a - b);

  sortedIndices.forEach(idx => {
    const url = process.env[`SUPABASE_URL_${idx}`];
    const key = process.env[`SUPABASE_KEY_${idx}`];
    const bucket = process.env[`SUPABASE_BUCKET_${idx}`] || process.env.SUPABASE_BUCKET || 'songs';

    if (url && key && !registeredUrls.has(url)) {
      clients.push({
        id: idx,
        name: `Account ${idx}`,
        client: createClient(url, key),
        bucket: bucket
      });
      registeredUrls.add(url);
    }
  });

  return clients;
}

app.get('/', (req, res) => {
  res.send('Vision Music Engine Live & Synced.');
});

app.get('/ping', async (req, res) => {
  try {
    const accounts = getSupabaseClients();
    const pingPromises = accounts.map(acc => 
      acc.client.storage.from(acc.bucket).list('', { limit: 1 }).catch(() => null)
    );
    await Promise.all(pingPromises);
    res.status(200).json({ status: 'alive', totalAccountsActive: accounts.length, time: new Date().toISOString() });
  } catch (err) {
    res.status(200).json({ status: 'alive_with_notice', error: err.message });
  }
});

async function scanAccountRealFolders(acc) {
  try {
    const { data: rootItems, error } = await acc.client.storage
      .from(acc.bucket)
      .list('', { limit: 1000 });

    if (error || !rootItems) return [];

    const detectedFolders = new Set();
    rootItems.forEach(item => {
      if (item.name && !item.name.startsWith('.')) {
        if (item.id === null || !item.name.includes('.')) {
          detectedFolders.add(item.name.trim());
        }
      }
    });

    return Array.from(detectedFolders);
  } catch (err) {
    return [];
  }
}

// 1. UNIQUE MERGED PLAYLISTS API FOR FRONTEND (Fast parallel scan)
app.get('/playlists', async (req, res) => {
  try {
    const accounts = getSupabaseClients();
    const seenMap = new Map();

    const folderPromises = accounts.map(acc => scanAccountRealFolders(acc));
    const allAccountFolders = await Promise.all(folderPromises);

    allAccountFolders.forEach(folders => {
      folders.forEach(f => {
        if (f && f.trim() !== '') {
          const norm = f.trim().toLowerCase();
          if (!seenMap.has(norm)) {
            seenMap.set(norm, f.trim());
          }
        }
      });
    });

    let list = Array.from(seenMap.values());
    if (list.length === 0) list.push("Hindi Song's");
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch playlists' });
  }
});

// 2. PUBLIC API: FETCH ALL TRACKS (Optimized parallel fetching)
app.get('/songs', async (req, res) => {
  try {
    const accounts = getSupabaseClients();
    const songPromises = [];

    for (const acc of accounts) {
      const folders = await scanAccountRealFolders(acc);

      if (folders.length === 0) {
        songPromises.push((async () => {
          try {
            const { data: rootFiles } = await acc.client.storage
              .from(acc.bucket)
              .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

            if (!rootFiles) return [];

            const audio = rootFiles.filter(f => f.name && f.name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i));
            return audio.map((file, idx) => {
              const { data: urlData } = acc.client.storage.from(acc.bucket).getPublicUrl(file.name);
              return {
                id: `root_${acc.id}_${idx + 1}`,
                fileName: file.name,
                title: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim(),
                url: urlData.publicUrl,
                playlist: "Hindi Song's",
                sizeBytes: file.metadata?.size || 0,
                accountId: acc.id
              };
            });
          } catch (e) {
            return [];
          }
        })());
      } else {
        for (const folder of folders) {
          songPromises.push((async () => {
            try {
              const { data: files } = await acc.client.storage
                .from(acc.bucket)
                .list(folder, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

              if (!files || files.length === 0) return [];

              const audioFiles = files.filter(f =>
                f.name && !f.name.startsWith('.') &&
                f.name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i)
              );

              return audioFiles.map((file, idx) => {
                const filePath = `${folder}/${file.name}`;
                const { data: urlData } = acc.client.storage
                  .from(acc.bucket)
                  .getPublicUrl(filePath);

                const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim();

                return {
                  id: `${folder.toLowerCase().replace(/[^a-z0-9]/g, '')}_${acc.id}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
                  fileName: file.name,
                  title: cleanTitle,
                  url: urlData.publicUrl,
                  playlist: folder,
                  sizeBytes: file.metadata?.size || 0,
                  accountId: acc.id
                };
              });
            } catch (e) {
              return [];
            }
          })());
        }
      }
    }

    const results = await Promise.all(songPromises);
    res.json(results.flat());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
