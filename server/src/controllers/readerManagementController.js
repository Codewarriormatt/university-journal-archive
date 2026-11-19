import { logger } from "../utils/logger.js";
import {
  listTrustedDomains,
  addTrustedDomain,
  deleteTrustedDomain,
  listReaderAccounts,
  updateReaderAccountStatus,
  updateReaderAccountExpiry,
  bulkSetReaderExpiry
} from "../repositories/readerRepository.js";
import { insertAuditLog } from "../repositories/adminRepository.js";
import { getRequestIp } from "../auth/session.js";
import { getPool } from "../db/database.js";

export async function getTrustedDomains(request, response) {
  return response.json(await listTrustedDomains());
}

export async function postTrustedDomain(request, response) {
  try {
    const domain = String(request.body?.domain ?? "").trim();

    if (!domain) {
      return response.status(400).json({
        message: "Domain is required.",
        fieldErrors: { domain: "Domain is required." }
      });
    }

    const result = await addTrustedDomain(domain);

    if (result.errors) {
      return response.status(400).json({ message: "Validation failed.", fieldErrors: result.errors });
    }

    try {
      await insertAuditLog({
        adminUserId: request.adminUser.id, adminDisplayName: request.adminUser.displayName,
        adminRole: request.adminUser.role, action: "create", resourceType: "trusted_domain",
        resourceId: result.id ?? null, resourceLabel: result.domain ?? domain,
        details: `Added trusted domain: ${result.domain ?? domain}`,
        ipAddress: getRequestIp(request)
      });
    } catch (e) { logger.warn("Audit log failed (trusted_domain create)", { message: e.message }); }

    return response.status(201).json(result);
  } catch (error) {
    logger.error("Failed to add trusted domain", { message: error.message });
    return response.status(500).json({ message: "Unexpected server error." });
  }
}

export async function removeTrustedDomain(request, response) {
  const id = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ message: "Invalid id." });
  }

  const existingResult = await getPool().query(
    "SELECT domain FROM trusted_domains WHERE id = $1",
    [id]
  );
  const existing = existingResult.rows[0];

  const deleted = await deleteTrustedDomain(id);

  if (!deleted) {
    return response.status(404).json({ message: "Domain not found." });
  }

  try {
    await insertAuditLog({
      adminUserId: request.adminUser.id, adminDisplayName: request.adminUser.displayName,
      adminRole: request.adminUser.role, action: "delete", resourceType: "trusted_domain",
      resourceId: id, resourceLabel: existing?.domain ?? null,
      details: existing?.domain ? `Removed trusted domain: ${existing.domain}` : "Removed trusted domain",
      ipAddress: getRequestIp(request)
    });
  } catch (e) { logger.warn("Audit log failed (trusted_domain delete)", { message: e.message }); }

  return response.status(200).json({ message: "Domain removed." });
}

export async function getReaderAccounts(request, response) {
  const { status, search, page = "1", pageSize = "50", sort = "createdAt", dir = "desc" } = request.query;
  const currentPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const limit = Math.min(Number.parseInt(pageSize, 10) || 50, 200);
  const offset = (currentPage - 1) * limit;

  const { rows, total } = await listReaderAccounts({ status, search, limit, offset, sort, dir });

  return response.json({ items: rows, total, page: currentPage, pageSize: limit });
}

export async function patchReaderAccount(request, response) {
  const id = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ message: "Invalid id." });
  }

  if ("expiresAt" in (request.body ?? {})) {
    const expiresAt = request.body.expiresAt;
    if (expiresAt !== null && (typeof expiresAt !== "string" || Number.isNaN(Date.parse(expiresAt)))) {
      return response.status(400).json({
        message: "Invalid expiry date.",
        fieldErrors: { expiresAt: "Provide a valid ISO date string or null to remove expiry." }
      });
    }
    const updated = await updateReaderAccountExpiry(id, expiresAt ?? null);
    if (!updated) return response.status(404).json({ message: "Reader account not found." });
    try {
      await insertAuditLog({
        adminUserId: request.adminUser.id, adminDisplayName: request.adminUser.displayName,
        adminRole: request.adminUser.role, action: "update", resourceType: "reader_account",
        resourceId: id,
        details: expiresAt ? `Set access expiry to ${new Date(expiresAt).toDateString()}` : "Removed access expiry",
        ipAddress: getRequestIp(request)
      });
    } catch (e) { logger.warn("Audit log failed (reader_account expiry)", { message: e.message }); }
    return response.status(200).json({ message: "Expiry updated." });
  }

  const status = String(request.body?.status ?? "");
  if (!["active", "disabled"].includes(status)) {
    return response.status(400).json({
      message: "Status must be 'active' or 'disabled'.",
      fieldErrors: { status: "Status must be 'active' or 'disabled'." }
    });
  }
  const updated = await updateReaderAccountStatus(id, status);
  if (!updated) return response.status(404).json({ message: "Reader account not found." });
  try {
    await insertAuditLog({
      adminUserId: request.adminUser.id, adminDisplayName: request.adminUser.displayName,
      adminRole: request.adminUser.role, action: "update", resourceType: "reader_account",
      resourceId: id,
      details: `Set account status to ${status}`,
      ipAddress: getRequestIp(request)
    });
  } catch (e) { logger.warn("Audit log failed (reader_account status)", { message: e.message }); }
  return response.status(200).json({ message: "Account updated." });
}

export async function bulkExpireReaderAccounts(request, response) {
  const expiresAt = String(request.body?.expiresAt ?? "").trim();

  if (!expiresAt || Number.isNaN(Date.parse(expiresAt))) {
    return response.status(400).json({
      message: "Provide a valid expiry date.",
      fieldErrors: { expiresAt: "Provide a valid date (ISO 8601 format)." }
    });
  }

  const count = await bulkSetReaderExpiry(new Date(expiresAt).toISOString());

  try {
    await insertAuditLog({
      adminUserId: request.adminUser.id, adminDisplayName: request.adminUser.displayName,
      adminRole: request.adminUser.role, action: "bulk_action", resourceType: "reader_account",
      details: `Set access expiry to ${new Date(expiresAt).toDateString()} for ${count} account(s)`,
      ipAddress: getRequestIp(request)
    });
  } catch (e) { logger.warn("Audit log failed (bulk_expire)", { message: e.message }); }

  return response.status(200).json({ message: `Expiry set for ${count} reader account(s).`, count });
}
