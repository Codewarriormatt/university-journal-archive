import { logger } from "../utils/logger.js";
import { listAuditLogs } from "../repositories/adminRepository.js";

export async function getAuditLogs(request, response) {
  try {
    const { page, limit, action, resourceType, search, dateFrom, dateTo } = request.query;
    return response.json(await listAuditLogs({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      action: action || undefined,
      resourceType: resourceType || undefined,
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined
    }));
  } catch (error) {
    logger.error("Failed to list audit logs", { message: error.message });
    return response.status(500).json({
      message: "Failed to retrieve audit logs.",
      code: "SERVER_ERROR"
    });
  }
}
