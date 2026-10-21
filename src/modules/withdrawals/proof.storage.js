import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import multer from "multer";

const uploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../uploads/withdrawals");

const allowed = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    fs.mkdirSync(uploadDir, { recursive: true });
    callback(null, uploadDir);
  },
  filename(_req, file, callback) {
    const ext = allowed[file.mimetype] || "";
    callback(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, callback) {
    if (!allowed[file.mimetype]) {
      const error = new Error("Upload a PNG, JPG, or WEBP screenshot");
      error.status = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

export function uploadProof(req, res, next) {
  upload.single("proof")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    res.status(tooLarge ? 400 : error.status || 400).json({
      message: tooLarge ? "Screenshot must be under 5 MB" : error.message,
    });
  });
}

export function resolveProofPath(filename) {
  const base = path.basename(String(filename || ""));
  if (!base || base !== filename) {
    return null;
  }
  const full = path.resolve(uploadDir, base);
  const relative = path.relative(uploadDir, full);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(full)) {
    return null;
  }
  return full;
}

export function removeProof(filename) {
  const full = resolveProofPath(filename);
  if (full) {
    fs.unlink(full, () => {});
  }
}
