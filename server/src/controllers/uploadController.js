import { mkdirSync, openSync, readSync, closeSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import multer from "multer";

// PDF magic bytes: %PDF
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46];

function readMagicBytes(filePath, count) {
  const buf = Buffer.alloc(count);
  const fd = openSync(filePath, "r");
  try {
    readSync(fd, buf, 0, count, 0);
  } finally {
    closeSync(fd);
  }
  return buf;
}

function matchesMagic(buf, signature, offset = 0) {
  return signature.every((byte, i) => buf[offset + i] === byte);
}

function isValidImageContent(filePath) {
  try {
    const buf = readMagicBytes(filePath, 12);
    if (matchesMagic(buf, [0xFF, 0xD8, 0xFF])) return true;                        // JPEG
    if (matchesMagic(buf, [0x89, 0x50, 0x4E, 0x47])) return true;                  // PNG
    if (matchesMagic(buf, [0x47, 0x49, 0x46, 0x38])) return true;                  // GIF
    if (matchesMagic(buf, [0x52, 0x49, 0x46, 0x46]) &&
        matchesMagic(buf, [0x57, 0x45, 0x42, 0x50], 8)) return true;               // WebP
    return false;
  } catch {
    return false;
  }
}

function isValidPdfContent(filePath) {
  try {
    const buf = readMagicBytes(filePath, 4);
    return matchesMagic(buf, PDF_SIGNATURE);
  } catch {
    return false;
  }
}

function deleteSilently(filePath) {
  try { unlinkSync(filePath); } catch { /* ignore */ }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_BASE = process.env.UPLOADS_DIR ?? path.join(__dirname, "../../uploads");

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function makeStorage(subdir) {
  const dir = path.join(UPLOADS_BASE, subdir);
  ensureDir(dir);
  return multer.diskStorage({
    destination(req, file, cb) { cb(null, dir); },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, randomBytes(16).toString("hex") + ext);
    }
  });
}

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif)$/i;

const imageUpload = multer({
  storage: makeStorage("images"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (IMAGE_MIMES.has(file.mimetype) && IMAGE_EXT.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Only jpg, jpeg, png, webp, or gif files are allowed."));
    }
  }
});

const pdfUpload = multer({
  storage: makeStorage("pdfs"),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.mimetype === "application/pdf" && /\.pdf$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed."));
    }
  }
});

export function uploadImageHandler(req, res) {
  imageUpload.single("file")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE"
        ? "Image file must be 5 MB or smaller."
        : err.message === "Only jpg, jpeg, png, webp, or gif files are allowed."
          ? err.message
          : "Upload failed.";
      return res.status(400).json({ message: msg });
    }
    if (!req.file) return res.status(400).json({ message: "No file uploaded." });

    if (!isValidImageContent(req.file.path)) {
      deleteSilently(req.file.path);
      return res.status(400).json({ message: "File content does not match an allowed image format." });
    }

    res.json({ path: `/uploads/images/${req.file.filename}` });
  });
}

export function uploadPdfHandler(req, res) {
  pdfUpload.single("file")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE"
        ? "PDF file must be 50 MB or smaller."
        : err.message === "Only PDF files are allowed."
          ? err.message
          : "Upload failed.";
      return res.status(400).json({ message: msg });
    }
    if (!req.file) return res.status(400).json({ message: "No file uploaded." });

    if (!isValidPdfContent(req.file.path)) {
      deleteSilently(req.file.path);
      return res.status(400).json({ message: "File content does not match PDF format." });
    }

    res.json({ path: `/uploads/pdfs/${req.file.filename}` });
  });
}
