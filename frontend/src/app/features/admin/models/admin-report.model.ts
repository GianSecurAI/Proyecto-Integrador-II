import { IncidentPriority, IncidentStatus, OrderStatus } from '../../../shared/models/wire-enums';
import { QuotationStatus } from './admin-quotation.model';

/** Backend `OrderReportDto`. `from`/`to` echo the effective inclusive range (`YYYY-MM-DD`,
 * America/Lima). Amounts are server-computed order totals in soles, EXCLUDING cancelled orders
 * (PD-REP-03): committed order value, not collected revenue. Every status appears in `byStatus`,
 * zeros included. */
export interface OrderReportDto {
  from: string;
  to: string;
  totalOrders: number;
  standardOrders: number;
  customOrders: number;
  byStatus: { status: OrderStatus; count: number }[];
  totalAmount: number;
  standardAmount: number;
  customAmount: number;
}

/** Backend `IncidentReportDto`. Open = ABIERTA + EN_REVISION; resolved = RESUELTA. */
export interface IncidentReportDto {
  from: string;
  to: string;
  totalIncidents: number;
  openIncidents: number;
  resolvedIncidents: number;
  byStatus: { status: IncidentStatus; count: number }[];
  byPriority: { priority: IncidentPriority; count: number }[];
}

/** Backend `QuotationReportDto` (RF-17): quotations registered in the range and the amount agreed on the accepted ones. */
export interface QuotationReportDto {
  from: string;
  to: string;
  totalQuotations: number;
  byStatus: { status: QuotationStatus; count: number; amount: number }[];
  totalAmount: number;
  acceptedAmount: number;
}

/** Maximum span (days, inclusive) the backend accepts; mirrored for UX validation only. */
export const REPORT_MAX_DAYS = 366;
