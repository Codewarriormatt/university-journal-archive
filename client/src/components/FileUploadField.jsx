import { useRef, useState } from "react";
import { uploadAdminFile } from "../api/adminApi.js";

export function FileUploadField({ label, name, uploadType, form, setForm, error, required = false }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);
  const value = form[name] ?? "";
  const fieldError = error?.fieldErrors?.[name] ?? uploadError;
  const isImage = uploadType === "image";
  const accept = isImage ? "image/jpeg,image/png,image/webp,image/gif" : "application/pdf";

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadAdminFile(uploadType, file);
      setForm((prev) => ({ ...prev, [name]: result.path }));
    } catch (err) {
      setUploadError(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const showThumb = isImage && value && (value.startsWith("/uploads/") || /^https?:\/\//.test(value));

  return (
    <label className={fieldError ? "admin-field admin-field--invalid" : "admin-field"}>
      <span>
        {label}
        {required ? <em aria-label="required">*</em> : null}
      </span>
      {showThumb && (
        <div className="admin-upload-thumb">
          <img src={value} alt="" />
        </div>
      )}
      <div className="admin-upload-row">
        <input
          type="text"
          className="admin-input"
          value={value}
          onChange={(e) => {
            setUploadError(null);
            setForm((prev) => ({ ...prev, [name]: e.target.value }));
          }}
          placeholder={isImage ? "Paste image URL or upload a file" : "Paste PDF URL or upload a file"}
        />
        <button
          type="button"
          className="admin-upload-row__btn"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>
      {fieldError ? <small>{fieldError}</small> : null}
    </label>
  );
}
