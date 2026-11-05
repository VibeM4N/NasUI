const express = require("express");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const os = require("os");
const crypto = require("crypto");
const mime = require("mime-types");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

function getShares() {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-SmbShare | Where-Object {$_.Special -eq $false} | Select-Object Name, Path, Description | ConvertTo-Json -Compress",
      ],
      (error, stdout) => {
        if (error) return reject(error);

        try {
          const data = JSON.parse(stdout || "[]");
          const shares = Array.isArray(data) ? data : [data];

          // Exclude obvious application/system locations
          const blocked = [
            "\\windows\\",
            "\\program files\\",
            "\\program files (x86)\\",
            "\\appdata\\",
          ];

          resolve(
            shares
              .filter((share) => {
                const p = share.Path.toLowerCase();

                return !blocked.some((item) => p.includes(item));
              })
              .map((share) => ({
                ...share,
                category: /^[a-z]:\\?$/i.test(share.Path.trim())
                  ? "drive"
                  : "folder",
              })),
          );
        } catch {
          resolve([]);
        }
      },
    );
  });
}

async function getShare(name) {
  const shares = await getShares();
  return shares.find((s) => s.Name === name);
}

async function resolveSafePath(share, relative = "") {
  const root = await fs.promises.realpath(share.Path);
  const target = path.resolve(root, relative);

  const relativeCheck = path.relative(root, target);

  if (
    relativeCheck === ".." ||
    relativeCheck.startsWith(".." + path.sep) ||
    path.isAbsolute(relativeCheck)
  ) {
    throw new Error("Access denied");
  }

  const realTarget = await fs.promises.realpath(target);
  const realCheck = path.relative(root, realTarget);

  if (
    realCheck === ".." ||
    realCheck.startsWith(".." + path.sep) ||
    path.isAbsolute(realCheck)
  ) {
    throw new Error("Access denied");
  }

  return realTarget;
}

// Discover shares
app.get("/api/shares", async (req, res) => {
  try {
    res.json(await getShares());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Browse folders
app.get("/api/browse", async (req, res) => {
  try {
    const { share: name, dir = "" } = req.query;

    const share = await getShare(name);
    if (!share) return res.status(404).json({ error: "Share not found" });

    const folder = await resolveSafePath(share, dir);
    const stat = await fs.promises.stat(folder);

    if (!stat.isDirectory()) {
      return res.status(400).json({ error: "Not a directory" });
    }

    const entries = await fs.promises.readdir(folder, {
      withFileTypes: true,
    });

    const files = await Promise.all(
      entries.map(async (entry) => {
        try {
          const fullPath = path.join(folder, entry.name);
          const info = await fs.promises.stat(fullPath);

          return {
            name: entry.name,
            type: entry.isDirectory() ? "folder" : "file",
            size: info.size,
            modified: info.mtime,
          };
        } catch {
          return null;
        }
      }),
    );

    files.sort((a, b) => {
      if (!a || !b) return 0;
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json(files.filter(Boolean));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// Create a new folder
app.post("/api/folder", async (req, res) => {
  try {
    const { share: name, dir = "", folderName } = req.body;

    const folder = String(folderName || "").trim();

    if (
      !folder ||
      folder === "." ||
      folder === ".." ||
      /[<>:"/\\|?*\x00-\x1F]/.test(folder) ||
      /[. ]$/.test(folder) ||
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i.test(folder)
    ) {
      return res.status(400).json({
        error: "Invalid folder name",
      });
    }

    const share = await getShare(name);
    if (!share) {
      return res.status(404).json({ error: "Share not found" });
    }

    const destination = await resolveSafePath(share, dir);

    if (!(await fs.promises.stat(destination)).isDirectory()) {
      return res.status(400).json({ error: "Invalid destination" });
    }

    const newFolder = path.join(destination, folder);

    await fs.promises.mkdir(newFolder);

    res.json({
      success: true,
      folder,
    });
  } catch (error) {
    if (error.code === "EEXIST") {
      return res.status(409).json({
        error: "A folder with that name already exists",
      });
    }

    res.status(400).json({ error: error.message });
  }
});
// Download / preview files

app.get("/api/file", async (req, res) => {
  try {
    const { share: name, file = "", preview } = req.query;

    const share = await getShare(name);
    if (!share) return res.status(404).send("Share not found");

    const target = await resolveSafePath(share, file);
    const info = await fs.promises.stat(target);

    if (!info.isFile()) {
      return res.status(400).send("Not a file");
    }

    const isPreview = preview === "true";

    res.setHeader("Accept-Ranges", "bytes");
    const contentType =
      path.extname(target).toLowerCase() === ".mkv"
        ? "video/x-matroska"
        : mime.lookup(target) || "application/octet-stream";

    res.setHeader("Content-Type", contentType);

    res.setHeader(
      "Content-Disposition",
      `${isPreview ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(path.basename(target))}`,
    );

    const range = req.headers.range;

    if (!range) {
      res.setHeader("Content-Length", info.size);
      return fs.createReadStream(target).pipe(res);
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);

    if (!match) {
      res.status(416).setHeader("Content-Range", `bytes */${info.size}`);
      return res.end();
    }

    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : info.size - 1;

    if (!match[1] && match[2]) {
      start = Math.max(0, info.size - Number(match[2]));
      end = info.size - 1;
    }

    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start >= info.size ||
      start > end
    ) {
      res.status(416).setHeader("Content-Range", `bytes */${info.size}`);
      return res.end();
    }

    end = Math.min(end, info.size - 1);

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${info.size}`);
    res.setHeader("Content-Length", end - start + 1);

    fs.createReadStream(target, { start, end }).pipe(res);
  } catch (error) {
    if (!res.headersSent) res.status(400).send(error.message);
  }
});

const uploadDir = path.join(os.tmpdir(), "nexus-uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024,
    files: 20,
  },
});

app.post("/api/upload", upload.array("files", 20), async (req, res) => {
  const uploaded = req.files || [];

  try {
    const { share, dir = "" } = req.query;

    const selectedShare = await getShare(share);
    if (!selectedShare) throw new Error("Share not found");

    const destination = await resolveSafePath(selectedShare, dir);

    if (!(await fs.promises.stat(destination)).isDirectory()) {
      throw new Error("Destination is not a folder");
    }

    const completed = [];

    for (const file of uploaded) {
      const filename = path.basename(file.originalname.replace(/\\/g, "/"));

      if (!filename || filename === "." || filename === "..") {
        throw new Error("Invalid filename");
      }

      const ext = path.extname(filename);
      const base = path.basename(filename, ext);

      let finalName = filename;
      let target = path.join(destination, finalName);
      let counter = 1;

      while (true) {
        try {
          await fs.promises.copyFile(
            file.path,
            target,
            fs.constants.COPYFILE_EXCL,
          );

          break;
        } catch (error) {
          if (error.code !== "EEXIST") throw error;

          finalName = `${base} (${counter})${ext}`;
          target = path.join(destination, finalName);
          counter++;
        }
      }

      completed.push(finalName);
    }

    res.json({ success: true, uploaded: completed });
  } catch (error) {
    res.status(400).json({ error: error.message });
  } finally {
    for (const file of uploaded) {
      await fs.promises.unlink(file.path).catch(() => {});
    }
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const query = String(req.query.q || "")
      .trim()
      .toLowerCase();

    if (query.length < 2) return res.json([]);

    const shares = await getShares();
    const results = [];
    const MAX_RESULTS = 100;

    async function scan(share, folder, depth = 0) {
      if (depth > 15 || results.length >= MAX_RESULTS) return;

      let entries;

      try {
        entries = await fs.promises.readdir(folder, {
          withFileTypes: true,
        });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (results.length >= MAX_RESULTS) break;

        // Avoid following symbolic links
        if (entry.isSymbolicLink()) continue;

        const fullPath = path.join(folder, entry.name);
        const relative = path.relative(share.Path, fullPath);

        if (entry.name.toLowerCase().includes(query)) {
          results.push({
            name: entry.name,
            share: share.Name,
            path: relative,
            type: entry.isDirectory() ? "folder" : "file",
          });
        }

        if (entry.isDirectory()) {
          await scan(share, fullPath, depth + 1);
        }
      }
    }

    for (const share of shares) {
      if (results.length >= MAX_RESULTS) break;

      try {
        const root = await fs.promises.realpath(share.Path);
        await scan(share, root);
      } catch {}
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NAS running at http://192.168.1.6:${PORT}`);
});
