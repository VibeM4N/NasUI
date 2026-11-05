const $ = (id) => document.getElementById(id);

let currentShare = null;
let currentDir = "";
let currentFiles = [];

async function api(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function formatSize(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

function fileIcon(name, type) {
  if (type === "folder") return "📁";

  const ext = name.split(".").pop().toLowerCase();

  const icons = {
    mp4: "🎬",
    mkv: "🎬",
    avi: "🎬",
    mov: "🎬",
    webm: "🎬",
    mp3: "🎵",
    flac: "🎵",
    wav: "🎵",
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    webp: "🖼️",
    gif: "🖼️",
    pdf: "📕",
    zip: "📦",
    rar: "📦",
    "7z": "📦",
    doc: "📘",
    docx: "📘",
    xls: "📗",
    xlsx: "📗",
    txt: "📄",
  };

  return icons[ext] || "📄";
}

function fileUrl(file, preview = false) {
  const params = new URLSearchParams({
    share: currentShare.Name,
    file,
    preview: String(preview),
  });

  return `/api/file?${params}`;
}

// Discover shares
async function openShare(share) {
  currentShare = share;
  currentDir = "";

  $("explorerSearch").value = "";
  $("uploadDestination").textContent = `${currentShare.Name} / Root`;
  await browse();
}
async function loadShares() {
  $("dashboard").hidden = false;
  $("explorer").hidden = true;
  $("preview").hidden = true;

  $("pageTitle").textContent = "Overview";
  $("subtitle").textContent = "Your personal network storage.";

  try {
    const shares = await api("/api/shares");

    const folders = shares.filter((s) => !/^[a-z]:\\?$/i.test(s.Path.trim()));

    const drives = shares.filter((s) => /^[a-z]:\\?$/i.test(s.Path.trim()));

    function renderShares(items, container, icon) {
      $(container).innerHTML = items.length
        ? items
            .map(
              (share) => `
                    <div class="share-card"
                         data-share="${escapeHTML(share.Name)}">
                        <div class="folder-icon">${icon}</div>
                        <h3>${escapeHTML(share.Name)}</h3>
                        <p>${escapeHTML(share.Path)}</p>
                    </div>
                `,
            )
            .join("")
        : '<p class="empty-state">No shares found.</p>';

      $(container)
        .querySelectorAll(".share-card")
        .forEach((card) => {
          card.addEventListener("click", () => {
            const share = items.find((s) => s.Name === card.dataset.share);

            openShare(share);
          });
        });
    }

    renderShares(folders, "folders", "📁");
    renderShares(drives, "drives", "💽");
  } catch (error) {
    console.error(error);
    $("shares").textContent = "Failed to load shares.";
  }
}

// Open share

// Browse directories

async function browse() {
  $("dashboard").hidden = true;
  $("explorer").hidden = false;
  $("preview").hidden = true;

  $("pageTitle").textContent = currentShare.Name;
  $("subtitle").textContent = currentShare.Path;
  $("uploadDestination").textContent =
    `${currentShare.Name} / ${currentDir || "Root"}`;

  const params = new URLSearchParams({
    share: currentShare.Name,
    dir: currentDir,
  });

  $("fileList").innerHTML = '<div class="empty-state">Loading files...</div>';

  try {
    currentFiles = await api(`/api/browse?${params}`);

    renderBreadcrumbs();
    renderFiles(currentFiles);
  } catch (error) {
    console.error(error);
    $("fileList").innerHTML =
      `<div class="empty-state">${escapeHTML(error.message)}</div>`;
  }
}

// Breadcrumb navigation

function renderBreadcrumbs() {
  const element = $("breadcrumbs");

  element.innerHTML = `
        <button id="rootCrumb">
            ${escapeHTML(currentShare.Name)}
        </button>
    `;

  let accumulated = "";

  currentDir
    .split(/[\\/]/)
    .filter(Boolean)
    .forEach((part) => {
      accumulated = accumulated ? accumulated + "/" + part : part;

      element.innerHTML += `
            <span>/</span>
            <button data-dir="${escapeHTML(accumulated)}">
                ${escapeHTML(part)}
            </button>
        `;
    });

  $("rootCrumb").addEventListener("click", () => {
    currentDir = "";
    browse();
  });

  element.querySelectorAll("[data-dir]").forEach((button) => {
    button.addEventListener("click", () => {
      currentDir = button.dataset.dir;
      browse();
    });
  });
  const createButton = document.createElement("button");

  createButton.textContent = "+ New Folder";
  createButton.className = "new-folder-btn";

  createButton.addEventListener("click", async () => {
    const folderName = prompt("Enter the new folder name:");

    if (!folderName || !folderName.trim()) return;

    try {
      const response = await fetch("/api/folder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          share: currentShare.Name,
          dir: currentDir,
          folderName: folderName.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not create folder");
      }

      await browse();
    } catch (error) {
      alert(error.message);
    }
  });

  element.appendChild(createButton);
}

// Render files

function renderFiles(files) {
  const query = $("explorerSearch").value.toLowerCase();

  const filtered = files.filter((file) =>
    file.name.toLowerCase().includes(query),
  );

  if (!filtered.length) {
    $("fileList").innerHTML = `
            <div class="empty-state">
                ${query ? "No matching files found." : "This folder is empty."}
            </div>
        `;
    return;
  }

  $("fileList").innerHTML = filtered
    .map(
      (file) => `
        <div class="file-row">
            <div class="file-name"
                 data-name="${escapeHTML(file.name)}"
                 data-type="${file.type}">
                <div class="file-icon">
                    ${fileIcon(file.name, file.type)}
                </div>
                <span>${escapeHTML(file.name)}</span>
            </div>

            <span class="file-size">
                ${file.type === "folder" ? "—" : formatSize(file.size)}
            </span>

            <span class="file-date">
                ${formatDate(file.modified)}
            </span>

            <button class="download"
                    data-name="${escapeHTML(file.name)}"
                    title="Download">
                ↓
            </button>
        </div>
    `,
    )
    .join("");

  document.querySelectorAll(".file-name").forEach((element) => {
    element.addEventListener("click", () => {
      const name = element.dataset.name;
      const relative = currentDir ? `${currentDir}/${name}` : name;

      if (element.dataset.type === "folder") {
        currentDir = relative;
        $("explorerSearch").value = "";
        browse();
      } else {
        previewFile(relative);
      }
    });
  });

  document.querySelectorAll(".download").forEach((button) => {
    button.addEventListener("click", () => {
      const relative = currentDir
        ? `${currentDir}/${button.dataset.name}`
        : button.dataset.name;

      const link = document.createElement("a");
      link.href = fileUrl(relative);
      link.download = button.dataset.name;
      link.click();
    });
  });
}

// File preview

function previewFile(file) {
  const ext = file.split(".").pop().toLowerCase();
  const url = fileUrl(file, true);

  $("preview").hidden = false;
  $("previewName").textContent = file.split(/[\\/]/).pop();

  let content = "";

  if (["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)) {
    content = `<img src="${url}" alt="Preview">`;
  } else if (["mp4", "webm", "ogg", "mkv"].includes(ext)) {
    content = `
        <video
            controls
            autoplay
            playsinline
            preload="metadata"
            style="max-width:100%;max-height:75vh"
            src="${url}">
        </video>
    `;
  } else if (ext === "pdf") {
    content = `<iframe src="${url}"></iframe>`;
  } else if (["mp3", "wav", "ogg", "flac"].includes(ext)) {
    content = `<audio controls src="${url}"></audio>`;
  } else {
    content = `
            <p>
                Preview not supported.
                <a href="${fileUrl(file)}" style="color:#a99aff">
                    Download file
                </a>
            </p>
        `;
  }

  $("previewContent").innerHTML = content;
  $("preview").scrollIntoView({ behavior: "smooth" });
}

// Event listeners

$("explorerSearch").addEventListener("input", () => {
  renderFiles(currentFiles);
});

$("closePreview").addEventListener("click", () => {
  $("preview").hidden = true;
});

$("backToShares").addEventListener("click", loadShares);

$("homeBtn").addEventListener("click", loadShares);
$("filesBtn").addEventListener("click", loadShares);
$("refreshBtn").addEventListener("click", () => {
  if (currentShare && !$("explorer").hidden) {
    browse();
  } else {
    loadShares();
  }
});

loadShares();

/* =========================
   GLOBAL FILE SEARCH
========================= */

let searchTimer;

$("globalSearch").addEventListener("input", () => {
  clearTimeout(searchTimer);

  const query = $("globalSearch").value.trim();
  const results = $("globalResults");

  if (query.length < 2) {
    results.hidden = true;
    return;
  }

  results.hidden = false;
  results.innerHTML = '<div class="global-result">Searching...</div>';

  searchTimer = setTimeout(async () => {
    try {
      const data = await api(`/api/search?q=${encodeURIComponent(query)}`);

      results.innerHTML = data.length
        ? data
            .map(
              (item, index) => `
                    <div class="global-result" data-index="${index}">
                        <div>
                            <strong>
                                ${item.type === "folder" ? "📁" : "📄"}
                                ${escapeHTML(item.name)}
                            </strong>
                            <small>
                                ${escapeHTML(item.share)} /
                                ${escapeHTML(item.path)}
                            </small>
                        </div>
                        <span>→</span>
                    </div>
                `,
            )
            .join("")
        : '<div class="global-result">No results found.</div>';

      results.querySelectorAll("[data-index]").forEach((element) => {
        element.addEventListener("click", async () => {
          const item = data[Number(element.dataset.index)];

          const share = await api("/api/shares");
          currentShare = share.find((s) => s.Name === item.share);

          if (!currentShare) return;

          const relative = item.path.replace(/\\/g, "/");

          if (item.type === "folder") {
            currentDir = relative;
            await browse();
          } else {
            const parts = relative.split("/");
            const filename = parts.pop();

            currentDir = parts.join("/");
            await browse();

            previewFile(relative);
          }

          results.hidden = true;
        });
      });
    } catch (error) {
      results.innerHTML = `<div class="global-result">${escapeHTML(error.message)}</div>`;
    }
  }, 350);
});

/* =========================
   DRAG AND DROP UPLOADS
========================= */

const dropZone = $("dropZone");
const fileInput = $("fileInput");

function uploadFiles(files) {
  if (!files.length || !currentShare) {
    $("uploadStatus").textContent = "Open a shared folder before uploading.";
    return;
  }

  const formData = new FormData();

  Array.from(files).forEach((file) => {
    formData.append("files", file);
  });

  const params = new URLSearchParams({
    share: currentShare.Name,
    dir: currentDir,
  });

  const xhr = new XMLHttpRequest();

  $("uploadProgress").style.width = "0%";
  $("uploadStatus").textContent = `Preparing ${files.length} file(s)...`;

  xhr.open("POST", `/api/upload?${params}`);

  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      const percent = Math.round((event.loaded / event.total) * 100);

      $("uploadProgress").style.width = `${percent}%`;

      $("uploadStatus").textContent =
        `Uploading ${percent}% · ${formatSize(event.loaded)} / ${formatSize(event.total)}`;
    }
  };

  xhr.onload = async () => {
    let result = {};

    try {
      result = JSON.parse(xhr.responseText);
    } catch {}

    if (xhr.status >= 200 && xhr.status < 300) {
      $("uploadProgress").style.width = "100%";

      $("uploadStatus").textContent =
        `✓ Successfully uploaded ${result.uploaded.length} file(s)`;

      setTimeout(() => {
        $("uploadStatus").textContent = "Drag & Drop files here";
        $("uploadProgress").style.width = "0%";
      }, 3000);

      await browse();
    } else {
      $("uploadStatus").textContent =
        `✕ Upload failed: ${result.error || xhr.statusText}`;
    }
  };

  xhr.onerror = () => {
    $("uploadStatus").textContent = "✕ Network error";
  };

  xhr.send(formData);
}

// Click to select files

dropZone.addEventListener("click", (event) => {
  if (event.target === fileInput) return;
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  uploadFiles(fileInput.files);
  fileInput.value = "";
});

// Prevent browser opening dropped files

["dragenter", "dragover", "dragleave", "drop"].forEach((event) => {
  document.addEventListener(event, (e) => e.preventDefault());
});

// Drag events

dropZone.addEventListener("dragover", () => {
  dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", (event) => {
  dropZone.classList.remove("dragging");
  uploadFiles(event.dataTransfer.files);
});
