// AUTO-GENERATED FILE — DO NOT EDIT.
// Regenerate with: npm run codegen
// Source: @rundit-sdk/client v0.3.5 (openapi.json)

import type { RunditClient } from '@rundit-sdk/client';

export const SDK_VERSION = "0.3.5";

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoke: (client: RunditClient, args: any) => Promise<unknown>;
}

export const TOOLS: ToolSpec[] = [
  {
    name: "companies_get_all",
    description: "List companies available to the SDK consumer\n\nReturns the compact form (id, name, currency, type, website, logo) for every company the caller can read. Filter by `companyIds`, `companyGroupIds`, and/or `nameSearch` (case-insensitive substring on display name; accepts an array to resolve multiple companies at once with OR semantics — e.g. `nameSearch=[\"acme\",\"beta\",\"gamma\"]` returns any company whose name contains any of the three substrings). Avoids listing the full portfolio when the agent only knows companies by name. Ordered by company id ascending.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "minimum": 1,
          "maximum": 500,
          "type": "number",
          "description": "Maximum items per page (1-500). Omit to receive the full result set in one response. Values outside that range are rejected with 422 rather than clamped, so a page is never quietly smaller than requested."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's `meta.nextCursor`. Carries the page size it was issued with, so a follow-up call needs only the cursor. Valid solely for the endpoint, filters, and caller that produced it — change any of them and you get 422; start again without a cursor. Paging reflects the data as of each request, so rows added or removed mid-walk can shift positions."
        },
        "companyIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Restrict results to these company identifiers"
        },
        "companyGroupIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Restrict results to companies that belong to any of these company groups"
        },
        "nameSearch": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Case-insensitive substring match on company display name. Pass an array to resolve multiple companies in one call — a company matches if its name contains ANY of the listed substrings (OR semantics). Combine with companyIds/companyGroupIds to find specific companies without first listing the entire portfolio."
        }
      },
      "additionalProperties": false
    },
    invoke: (client, args) => client.companies.getAll(args),
  },
  {
    name: "companies_get_dashboard",
    description: "Get full company dashboard for ONE company\n\nReturns company metadata, positions per fund, metrics with data points, recent transactions, and report summaries for a single company. For more than one company, prefer POST /companies/dashboards (`companies.getDashboards`) instead — it returns the same payload per company in one call and avoids the N+1 pattern. Takes the same metric options as the batch route: `metricTypeNames` / `metricTypeIds` scope which metrics are included, `metricsTimeframe` picks a granularity, `metricsFrom`, `metricsTo`, and `metricsPointLimit` limit history (`metricsPointLimit: 1` = latest dated point; set `metricsTo` to today for current values — prefer it over `metricsFrom` for \"latest\" reads, since a date lower bound hides values last reported before it). `transactionLimit` and `reportLimit` cap list sizes.",
    inputSchema: {
      "type": "object",
      "properties": {
        "id": {
          "type": "number",
          "description": "Company identifier"
        },
        "currency": {
          "type": "string",
          "description": "Reporting currency code (ISO 4217)."
        },
        "metricsFrom": {
          "type": "string",
          "description": "Lower bound for metric data points (ISO 8601). Omit to include all available history."
        },
        "metricsTo": {
          "type": "string",
          "description": "Inclusive upper bound for metric data points (ISO 8601). Pair with metricsPointLimit: 1 for latest values as of this date; omit to allow future-dated points."
        },
        "metricsTimeframe": {
          "type": "string",
          "enum": [
            "Month",
            "Quarter",
            "Year"
          ],
          "description": "Restrict metric data points to this reporting period granularity."
        },
        "metricsPointLimit": {
          "minimum": 1,
          "type": "number",
          "description": "Keep only the most recent N data points per metric (applied after `metricsFrom` / `metricsTo` / `metricsTimeframe`). Omit for the full history; `1` yields the latest dated point, which may be in the future. Set `metricsTo` to today for current values and `metricsTimeframe` for a single granularity."
        },
        "metricTypeNames": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Metric type names to include (case-insensitive exact match on display name or `shortName`). Omit to include all metrics. Names that match no accessible metric type are ignored."
        },
        "metricTypeIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Metric type identifiers to include. Intersected with `metricTypeNames` when both are provided."
        },
        "conversionStrategy": {
          "type": "string",
          "enum": [
            "LATEST_FX_RATE",
            "ENTITY_DATE_RATE"
          ],
          "description": "FX rate selection when converting monetary metrics. `LATEST_FX_RATE` (default) uses the most recent rate; `ENTITY_DATE_RATE` uses the rate on each point's date."
        },
        "transactionLimit": {
          "default": 10,
          "type": "number",
          "description": "Maximum number of transactions to include (most recent first). Defaults to 10."
        },
        "reportLimit": {
          "default": 5,
          "type": "number",
          "description": "Maximum number of reports to include (most recent first). Defaults to 5."
        }
      },
      "required": [
        "id",
        "currency"
      ],
      "additionalProperties": false
    },
    invoke: (client, { id, ...query }) => client.companies.getDashboard(id, query),
  },
  {
    name: "companies_get_dashboards",
    description: "PREFERRED tool for multi-company analysis — full dashboards for many companies in one call\n\nPREFERRED tool for multi-company analysis. Returns full dashboards (company metadata, positions, metrics with data points, recent transactions, report summaries) for many companies in a single request, grouped per company. Use this instead of looping `GET /companies/:id/dashboard` (the N+1 pattern) whenever the agent needs to look at more than one company — it returns the same shape per company but in one round trip. Typical workflow: resolve company ids (e.g. `GET /companies?nameSearch=[\"acme\",\"beta\"]`), then call this with their `companyIds`. Use `metricTypeIds` or `metricTypeNames` (case-insensitive exact match on full name or `shortName`) to scope the returned metrics. `metricsFrom` (ISO 8601) sets a lower-bound date for metric data points; omit to include all history. `metricsTimeframe` restricts data point granularity to Month, Quarter, or Year. `metricsPointLimit` keeps only the most recent N points per metric (`1` = latest dated point; set `metricsTo` to today to exclude future values) — full histories for many companies add up quickly. `currency` (ISO 4217, required) FX-converts all monetary metrics across the batch. `conversionStrategy` controls which rate is applied: `LATEST_FX_RATE` (default) or `ENTITY_DATE_RATE` (the rate on each point's own date). `transactionLimit` / `reportLimit` cap list sizes per company (defaults: 10 and 5 respectively). Dashboards come back in the order the `companyIds` were requested, so `limit`/`cursor` paging is stable.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum items per page (1-500). Omit to receive the full result set in one response. Values outside that range are rejected with 422 rather than clamped, so a page is never quietly smaller than requested.",
          "minimum": 1,
          "maximum": 500
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's `meta.nextCursor`. Carries the page size it was issued with, so a follow-up call needs only the cursor. Valid solely for the endpoint, filters, and caller that produced it — change any of them and you get 422; start again without a cursor. Paging reflects the data as of each request, so rows added or removed mid-walk can shift positions."
        },
        "companyIds": {
          "description": "Company identifiers to include in the batch.",
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "currency": {
          "type": "string",
          "description": "Reporting currency code (ISO 4217)."
        },
        "metricsFrom": {
          "type": "string",
          "description": "Lower bound for metric data points (ISO 8601). Omit to include all available history."
        },
        "metricsTo": {
          "type": "string",
          "description": "Inclusive upper bound for metric data points (ISO 8601). Pair with metricsPointLimit: 1 for latest values as of this date; omit to allow future-dated points."
        },
        "metricsTimeframe": {
          "type": "string",
          "description": "Restrict metric data points to this reporting period granularity.",
          "enum": [
            "Month",
            "Quarter",
            "Year"
          ]
        },
        "metricsPointLimit": {
          "type": "number",
          "description": "Keep only the most recent N data points per metric (applied after `metricsFrom` / `metricsTo` / `metricsTimeframe`). Omit for the full history; `1` yields the latest dated point, which may be in the future. Set `metricsTo` to today for current values and `metricsTimeframe` for a single granularity.",
          "minimum": 1
        },
        "metricTypeNames": {
          "description": "Metric type names to include (case-insensitive exact match on display name or `shortName`). Omit to include all metrics. Use metric type ids via `metricTypeIds` when ids are known. Names that match no accessible metric type are ignored.",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "metricTypeIds": {
          "description": "Metric type identifiers to include. Intersected with `metricTypeNames` when both are provided.",
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "conversionStrategy": {
          "type": "string",
          "description": "FX rate selection when converting monetary metrics. `LATEST_FX_RATE` (default) uses the most recent rate; `ENTITY_DATE_RATE` uses the rate on each point's date.",
          "enum": [
            "LATEST_FX_RATE",
            "ENTITY_DATE_RATE"
          ]
        },
        "transactionLimit": {
          "type": "number",
          "description": "Maximum number of transactions per company (most recent first). Defaults to 10.",
          "default": 10
        },
        "reportLimit": {
          "type": "number",
          "description": "Maximum number of reports per company (most recent first). Defaults to 5.",
          "default": 5
        }
      },
      "required": [
        "companyIds",
        "currency"
      ],
      "additionalProperties": false
    },
    invoke: (client, args) => client.companies.getDashboards(args),
  },
  {
    name: "companies_get_one",
    description: "Get one company available to the SDK consumer\n\nReturns the full company object for a single company. Includes all compact-list fields (id, name, type, currency, website, logo) plus extended metadata: legal name, status, description, vision, address, city, state, country, operating countries, VAT number, founding year, established date, total funding, and accessible fund ids (as `companyGroupIds`). Returns 403 (not 404) both when the company does not exist and when it is outside the caller's access — existence is deliberately not disclosed. Once the request is authenticated and carries the required scope, a 403 on this route therefore means an unknown or inaccessible id; resolve ids via `GET /companies` first. (A missing API key scope also yields 403, with an \"Insufficient API key scopes\" message.)",
    inputSchema: {
      "type": "object",
      "properties": {
        "id": {
          "type": "number",
          "description": "Company identifier"
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false
    },
    invoke: (client, { id }) => client.companies.getOne(id),
  },
  {
    name: "company_groups_get_all",
    description: "List funds available to the SDK consumer\n\nReturns compact fund metadata (id, name, demo flag, color, member company ids). Filter by `companyGroupIds` and/or `nameSearch` (case-insensitive substring on name; accepts an array to resolve multiple groups in one call with OR semantics — e.g. `nameSearch=[\"fund i\",\"fund ii\"]`). Ordered by fund id ascending.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "minimum": 1,
          "maximum": 500,
          "type": "number",
          "description": "Maximum items per page (1-500). Omit to receive the full result set in one response. Values outside that range are rejected with 422 rather than clamped, so a page is never quietly smaller than requested."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's `meta.nextCursor`. Carries the page size it was issued with, so a follow-up call needs only the cursor. Valid solely for the endpoint, filters, and caller that produced it — change any of them and you get 422; start again without a cursor. Paging reflects the data as of each request, so rows added or removed mid-walk can shift positions."
        },
        "companyGroupIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Restrict results to these company group identifiers"
        },
        "nameSearch": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Case-insensitive substring match on company group display name. Pass an array to resolve multiple groups in one call — a group matches if its name contains ANY of the listed substrings (OR semantics). Useful for finding funds or visibility groups by name without first listing all groups."
        }
      },
      "additionalProperties": false
    },
    invoke: (client, args) => client.companyGroups.getAll(args),
  },
  {
    name: "company_groups_get_one",
    description: "Get one fund available to the SDK consumer\n\nReturns full fund details. Includes all compact-list fields (id, name, type, currency, logo) plus extended fund metadata: legal name, domicile, management company, GP, vintage year, fund currency, opening and closing dates, legal form, investment policy, fees, regulatory info, and service providers. Also includes the list of member companies the caller can access. Returns 403 (not 404) both when the fund does not exist and when it is outside the caller's access — existence is deliberately not disclosed. Once the request is authenticated and carries the required scope, a 403 on this route therefore means an unknown or inaccessible id; resolve ids via `GET /company-groups` first. (A missing API key scope also yields 403, with an \"Insufficient API key scopes\" message.)",
    inputSchema: {
      "type": "object",
      "properties": {
        "id": {
          "type": "number",
          "description": "Company group identifier"
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false
    },
    invoke: (client, { id }) => client.companyGroups.getOne(id),
  },
  {
    name: "company_reports_get_one",
    description: "Fetch the full content of a single company report\n\nReturns the report metadata plus structured sections (text/markdown/image) and attachments with pre-signed URLs. Returns 404 if the report does not exist and 403 if the caller cannot access it under their role-based permissions.",
    inputSchema: {
      "type": "object",
      "properties": {
        "id": {
          "type": "number",
          "description": "Report identifier"
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false
    },
    invoke: (client, { id }) => client.companyReports.getOne(id),
  },
  {
    name: "company_reports_list",
    description: "List published company reports accessible to the caller (metadata only)\n\nReturns lightweight report metadata (id, title, period, publisher company reference). Use GET /company-reports/:id to fetch the full content of a specific report. Visibility is determined by the caller's roles — VC users see reports for managed-portfolio companies, company employees see their own company's reports, portfolio investors see Published reports shared with their visibility groups. Filters narrow the list by company ids, funds (`companyGroupIds`), company name substring (`companyNameSearch`), and reporting period (timeframe + date range). Ordered by reporting period date descending, then id descending by default. Use `sortBy: publishedAt` and `limit: 1` for the most recently published report; publication order can differ from period order.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "minimum": 1,
          "maximum": 500,
          "type": "number",
          "description": "Maximum items per page (1-500). Omit to receive the full result set in one response. Values outside that range are rejected with 422 rather than clamped, so a page is never quietly smaller than requested."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's `meta.nextCursor`. Carries the page size it was issued with, so a follow-up call needs only the cursor. Valid solely for the endpoint, filters, and caller that produced it — change any of them and you get 422; start again without a cursor. Paging reflects the data as of each request, so rows added or removed mid-walk can shift positions."
        },
        "sortBy": {
          "default": "date",
          "type": "string",
          "enum": [
            "date",
            "publishedAt"
          ],
          "description": "Descending sort, with report id descending as a tiebreaker and missing dates last. date (default) is the reporting period; publishedAt is the publication timestamp. Use publishedAt with limit: 1 for the most recently published report."
        },
        "companyIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Restrict results to these companies. Defaults to all companies the caller can access."
        },
        "companyGroupIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Restrict to companies that belong to any of these company groups."
        },
        "companyNameSearch": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Case-insensitive substring match on the reporting company name. Pass an array to resolve multiple companies in one call — a report matches if its company name contains ANY of the listed substrings (OR semantics). Intersects with `companyIds`/`companyGroupIds`."
        },
        "timeframe": {
          "type": "string",
          "enum": [
            "Month",
            "Quarter",
            "Year"
          ],
          "description": "Restrict to a reporting period granularity (Month, Quarter, Year)."
        },
        "from": {
          "type": "string",
          "description": "Lower bound for the reporting period date (ISO 8601, inclusive)."
        },
        "to": {
          "type": "string",
          "description": "Upper bound for the reporting period date (ISO 8601, inclusive)."
        }
      },
      "additionalProperties": false
    },
    invoke: (client, args) => client.companyReports.list(args),
  },
  {
    name: "metrics_aggregate",
    description: "Aggregate metrics across portfolio companies\n\nReturns aggregated metric values (SUM, AVG, MEDIAN, MIN, MAX, COUNT) across companies for each reporting period. Select metric types with `metricTypeIds` and/or `metricTypeNames` (case-insensitive exact match on name or `shortName`, e.g. \"MRR\"). Optionally group results by fund (`companyGroupId`) for fund-level breakdowns. MIN, MAX, and COUNT are always computed. SUM, AVG, and MEDIAN are only produced when the metric type enables them in its `summaryAggregationMethods` configuration; otherwise `point.value` is `null` for that aggregation. Every requested metric type the caller can access yields one entry (per fund when grouped) — with an empty `points` array when none of the selected companies has a value for it, so \"no data\" is explicit rather than a missing row. Ids that match no accessible metric type produce no entry. Select companies with `companyIds`, `companyNameSearch`, or `companyGroupIds`; when those select no company at all the response is an empty list. Ordered by fund id, then in the order the metric types were requested (`metricTypeIds` order; name-resolved types follow the catalogue order).",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum items per page (1-500). Omit to receive the full result set in one response. Values outside that range are rejected with 422 rather than clamped, so a page is never quietly smaller than requested.",
          "minimum": 1,
          "maximum": 500
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's `meta.nextCursor`. Carries the page size it was issued with, so a follow-up call needs only the cursor. Valid solely for the endpoint, filters, and caller that produced it — change any of them and you get 422; start again without a cursor. Paging reflects the data as of each request, so rows added or removed mid-walk can shift positions."
        },
        "metricTypeIds": {
          "description": "Metric type identifiers to aggregate (discover ids via /metrics/types). Entries are returned in this order. Required unless `metricTypeNames` is given; intersected with it when both are given.",
          "example": [
            1,
            7
          ],
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "metricTypeNames": {
          "description": "Metric type names to aggregate — case-insensitive exact match on display name or `shortName` (so \"MRR\" and \"MRR - Monthly Recurring Revenue\" both work). Lets a caller aggregate by name without resolving ids first. Intersected with `metricTypeIds` when both are given. Names that match no accessible metric type are ignored.",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "aggregation": {
          "type": "string",
          "description": "Aggregation function to apply across companies for each period.",
          "enum": [
            "SUM",
            "AVG",
            "MEDIAN",
            "MIN",
            "MAX",
            "COUNT"
          ]
        },
        "companyIds": {
          "description": "Restrict to these company identifiers.",
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "companyNameSearch": {
          "description": "Case-insensitive substring match on company display name. Pass an array to select multiple companies in one call — a company matches if its name contains ANY of the listed substrings (OR semantics). Intersects with `companyIds`/`companyGroupIds`. When the combined company filters select no company at all, the response is an empty list — nothing to aggregate over.",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "companyGroupIds": {
          "description": "Restrict to companies that belong to any of these company groups.",
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "timeframe": {
          "type": "string",
          "description": "Restrict to a reporting period granularity.",
          "enum": [
            "Month",
            "Quarter",
            "Year"
          ]
        },
        "from": {
          "type": "string",
          "description": "Lower bound for point date (ISO 8601, inclusive)."
        },
        "to": {
          "type": "string",
          "description": "Upper bound for point date (ISO 8601, inclusive)."
        },
        "currency": {
          "type": "string",
          "description": "ISO 4217 currency code. When set, monetary metrics are FX-converted to this target currency."
        },
        "conversionStrategy": {
          "type": "string",
          "description": "FX rate selection when `currency` is set. `LATEST_FX_RATE` (default) uses the most recent rate; `ENTITY_DATE_RATE` uses the rate on each point's date.",
          "enum": [
            "LATEST_FX_RATE",
            "ENTITY_DATE_RATE"
          ]
        },
        "groupByCompanyGroup": {
          "type": "boolean",
          "description": "When true, results are grouped by company group. Each metric type produces one entry per company group.",
          "default": false
        }
      },
      "required": [
        "aggregation"
      ],
      "additionalProperties": false
    },
    invoke: (client, args) => client.metrics.aggregate(args),
  },
  {
    name: "metrics_compare",
    description: "Compare metrics across companies\n\nReturns date-aligned rows for one or more metric types across multiple companies. Select metric types with `metricTypeIds` and/or `metricTypeNames` (case-insensitive exact match on name or `shortName`, e.g. \"MRR\"); several metrics are compared in a single round trip, one entry per metric type in `metricTypeIds` order; name-only selections follow catalogue order. Each row contains one value per company for a given period. Optionally includes period-over-period percentage change. Use `companyIds`, `companyNameSearch`, or `companyGroupIds` to select companies.",
    inputSchema: {
      "type": "object",
      "properties": {
        "metricTypeIds": {
          "description": "Metric type identifiers to compare (discover ids via /metrics/types). One comparison entry is returned per metric type, in this order. Required unless `metricTypeNames` is given; intersected with it when both are given.",
          "example": [
            1,
            7
          ],
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "metricTypeNames": {
          "description": "Metric type names to compare — case-insensitive exact match on display name or `shortName` (so \"MRR\" and \"MRR - Monthly Recurring Revenue\" both work). Lets a caller compare by name without resolving ids first. Intersected with `metricTypeIds` when both are given. Names that match no accessible metric type are ignored.",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "companyIds": {
          "description": "Restrict to these company identifiers.",
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "companyNameSearch": {
          "description": "Case-insensitive substring match on company display name. Pass an array to compare multiple companies in one call — a company matches if its name contains ANY of the listed substrings (OR semantics). Intersects with `companyIds`/`companyGroupIds`.",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "companyGroupIds": {
          "description": "Restrict to companies that belong to any of these company groups.",
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "timeframe": {
          "type": "string",
          "description": "Restrict to a reporting period granularity.",
          "enum": [
            "Month",
            "Quarter",
            "Year"
          ]
        },
        "from": {
          "type": "string",
          "description": "Lower bound for point date (ISO 8601, inclusive)."
        },
        "to": {
          "type": "string",
          "description": "Upper bound for point date (ISO 8601, inclusive)."
        },
        "currency": {
          "type": "string",
          "description": "ISO 4217 currency code. When set, monetary metrics are FX-converted to this target currency."
        },
        "conversionStrategy": {
          "type": "string",
          "description": "FX rate selection when `currency` is set. `LATEST_FX_RATE` (default) uses the most recent rate; `ENTITY_DATE_RATE` uses the rate on each point's date.",
          "enum": [
            "LATEST_FX_RATE",
            "ENTITY_DATE_RATE"
          ]
        },
        "includeChange": {
          "type": "boolean",
          "description": "Include period-over-period percentage change for each value.",
          "default": false
        }
      },
      "additionalProperties": false
    },
    invoke: (client, args) => client.metrics.compare(args),
  },
  {
    name: "metrics_get_types",
    description: "List metric types available to the SDK consumer\n\nReturns predefined metric types plus user-defined metric types scoped to the caller — VC group custom types for VC users, company custom types for company users. Each entry carries the metric shape needed to interpret values: `valueType` is `\"numeric\"` (read `point.value` as a number; may carry `rangeConfig` with min/max/step for ranged metrics) or `\"option\"` (read `point.optionValue` as a string from `optionConfig.options[]` — this is how boolean / yes-no metrics are encoded, as two options typically labelled \"Yes\"/\"No\"). `unit.unit` describes the measurement (`Currency`, `Percentage`, `Number`, time units, ...); `unit.currencyCode` is intentionally null on this endpoint because monetary types resolve their concrete currency per company — call /metrics to receive `unit.currencyCode` populated with each company's native currency, or pass `currency` to convert all monetary metrics to a chosen target. Filter with `nameSearch` (case-insensitive substring on name or `shortName`, OR across an array) to find a few types without paging the whole catalogue — e.g. `nameSearch=[\"mrr\",\"burn\"]`. Ordered by metric type id ascending.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "minimum": 1,
          "maximum": 500,
          "type": "number",
          "description": "Maximum items per page (1-500). Omit to receive the full result set in one response. Values outside that range are rejected with 422 rather than clamped, so a page is never quietly smaller than requested."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's `meta.nextCursor`. Carries the page size it was issued with, so a follow-up call needs only the cursor. Valid solely for the endpoint, filters, and caller that produced it — change any of them and you get 422; start again without a cursor. Paging reflects the data as of each request, so rows added or removed mid-walk can shift positions."
        },
        "nameSearch": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Case-insensitive substring match on metric type name or `shortName`. Pass an array to look up several types in one call — a type matches if ANY listed substring occurs (OR semantics). Use it to find ids or exact names without paging the whole catalogue."
        }
      },
      "additionalProperties": false
    },
    invoke: (client, args) => client.metrics.getTypes(args),
  },
  {
    name: "metrics_search",
    description: "Read metric values for accessible companies, grouped by company\n\nReturns metric data points for companies the caller can access (companies in the caller's VC group portfolio, or the caller's own company for company users). Each entry carries company and metric type references with id and human-readable name. Each point carries both `value` (number, for `valueType === \"numeric\"`, including ranged numerics constrained by the type's `rangeConfig`) and `optionValue` (string, for `valueType === \"option\"`, matching one of `metricType.optionConfig.options[].value` — this is how boolean/yes-no metrics report their reading); read whichever matches the metric type's `valueType`. Each entry embeds a metric type *summary* (id, name, shortName, valueType, unit, plus option/range config when relevant); the full definition lives on /metrics/types. Filter by company id, company name substring (`companyNameSearch`), company group, metric type id, metric type name (`metricTypeNames` — case-insensitive exact match on either the full name or the `shortName`, so \"MRR\" and \"MRR - Monthly Recurring Revenue\" both work), timeframe, and date range to narrow the response. Pass `currency` (ISO 4217) to FX-convert monetary metrics to that target currency in one call instead of fetching company currencies separately. Use `pointLimit` to keep only the most recent N points per metric (`pointLimit: 1` = latest dated point; set `to` to today to exclude future values) — without it every historical point is returned, which can be very large across a portfolio. Entries are ordered by company id ascending — one entry per company, so `limit` pages whole companies, never partial metric lists.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum items per page (1-500). Omit to receive the full result set in one response. Values outside that range are rejected with 422 rather than clamped, so a page is never quietly smaller than requested.",
          "minimum": 1,
          "maximum": 500
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's `meta.nextCursor`. Carries the page size it was issued with, so a follow-up call needs only the cursor. Valid solely for the endpoint, filters, and caller that produced it — change any of them and you get 422; start again without a cursor. Paging reflects the data as of each request, so rows added or removed mid-walk can shift positions."
        },
        "companyIds": {
          "description": "Restrict results to these companies. Defaults to all companies the caller can access.",
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "companyNameSearch": {
          "description": "Resolve companies by case-insensitive substring match on their display name. Pass an array to resolve multiple companies in one call — a company matches if its name contains ANY of the listed substrings (OR semantics). Intersects with `companyIds`/`companyGroupIds`. Lets the agent skip a separate /companies lookup when it only knows names.",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "companyGroupIds": {
          "description": "Restrict to companies that belong to any of these company groups.",
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "metricTypeIds": {
          "description": "Restrict to specific metric types (use GET /metrics/types to discover identifiers).",
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "metricTypeNames": {
          "description": "Resolve metric types by case-insensitive exact match on their display name OR `shortName` (so \"MRR\" matches \"MRR - Monthly Recurring Revenue\") and intersect with `metricTypeIds`. Lets the agent fetch by metric name (e.g. \"Revenue\") without first listing /metrics/types. Names that match no accessible metric type are ignored, so an empty result may mean a name did not resolve — verify names against /metrics/types.",
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "timeframe": {
          "type": "string",
          "description": "Restrict to a reporting period granularity.",
          "enum": [
            "Month",
            "Quarter",
            "Year"
          ]
        },
        "from": {
          "type": "string",
          "description": "Lower bound for point date (ISO 8601, inclusive)."
        },
        "to": {
          "type": "string",
          "description": "Upper bound for point date (ISO 8601, inclusive)."
        },
        "currency": {
          "type": "string",
          "description": "ISO 4217 currency code (e.g. USD, EUR). When set, monetary metrics are FX-converted to this currency and the metric type unit reports the target currency. Non-monetary metrics are unaffected."
        },
        "conversionStrategy": {
          "type": "string",
          "description": "FX rate selection when `currency` is set. `LATEST_FX_RATE` (default) uses the most recent rate; `ENTITY_DATE_RATE` uses the rate on each point's date. Ignored when `currency` is omitted.",
          "enum": [
            "LATEST_FX_RATE",
            "ENTITY_DATE_RATE"
          ]
        },
        "pointLimit": {
          "type": "number",
          "description": "Keep only the most recent N data points per metric, applied after the `timeframe` and date filters. Points stay in date-ascending order. Omit for the full history. `pointLimit: 1` returns the latest dated point, which may be in the future. Set `to` to today for current values; pair with `timeframe` so the window is a single granularity.",
          "minimum": 1
        }
      },
      "additionalProperties": false
    },
    invoke: (client, args) => client.metrics.search(args),
  },
  {
    name: "metrics_write_points",
    description: "Upsert metric points\n\nWrites points for one metric instance. Set exactly one of value or optionValue according to the metric type and set the other field to null.",
    inputSchema: {
      "type": "object",
      "properties": {
        "metricId": {
          "type": "number"
        },
        "points": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "date": {
                "type": "string",
                "description": "Reporting period date (YYYY-MM-DD), on the first day of the month."
              },
              "value": {
                "type": "number",
                "nullable": true,
                "example": 123,
                "description": "Numeric value. Set to null for option metrics."
              },
              "optionValue": {
                "type": "string",
                "nullable": true,
                "example": null,
                "description": "Option value. Set to null for numeric metrics."
              },
              "timeframe": {
                "type": "string",
                "enum": [
                  "Month",
                  "Quarter",
                  "Year"
                ]
              }
            },
            "required": [
              "date",
              "value",
              "optionValue",
              "timeframe"
            ]
          }
        }
      },
      "required": [
        "metricId",
        "points"
      ],
      "additionalProperties": false
    },
    invoke: (client, { metricId, ...body }) => client.metrics.writePoints(metricId, body),
  },
  {
    name: "metrics_write_points_batch",
    description: "Upsert points for existing metrics across multiple companies\n\nPreferred for bulk writes: companies contains companyId, native currency and metric items selected by type id or exact name/shortName, optionally flavor actual/forecast/budget. No instance-id discovery needed. Upserts replace existing values like writePoints. Returns only company, metric and point counts. Does not create metric types, rows or template requests; missing rows return 404. VC API-key callers only; metrics:write and company edit permissions are required for every company. All company access, currencies, rows and point values are checked before writes begin. Limits: 100 companies, 50 items per company, 1000 items and 10000 points total, 250 points per item. Duplicate companies/rows/periods are rejected. Set exactly one of value or optionValue and the other to null. No implicit deletion or FX conversion. Unexpected persistence failures may leave earlier companies written; replaying the same values is safe.",
    inputSchema: {
      "type": "object",
      "properties": {
        "companies": {
          "minItems": 1,
          "maxItems": 100,
          "description": "Each company may appear once. Maximum 1000 metric items and 10000 points across the request.",
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "companyId": {
                "type": "number"
              },
              "currency": {
                "type": "string",
                "description": "Company native currency, e.g. USD. Writes do not convert FX."
              },
              "items": {
                "minItems": 1,
                "maxItems": 50,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "metricTypeId": {
                      "type": "number",
                      "description": "Existing metric type id. Supply exactly one of metricTypeId or metricTypeName."
                    },
                    "metricTypeName": {
                      "type": "string",
                      "description": "Exact case-insensitive full name or shortName, e.g. MRR. Unknown or ambiguous names fail."
                    },
                    "flavor": {
                      "type": "string",
                      "enum": [
                        "actual",
                        "forecast",
                        "budget"
                      ],
                      "default": "actual",
                      "description": "Select an existing row. Missing forecast/budget rows are not created."
                    },
                    "points": {
                      "minItems": 1,
                      "maxItems": 250,
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "date": {
                            "type": "string",
                            "description": "Reporting period date (YYYY-MM-DD), on the first day of the month."
                          },
                          "value": {
                            "type": "number",
                            "nullable": true,
                            "example": 123,
                            "description": "Numeric value. Set to null for option metrics."
                          },
                          "optionValue": {
                            "type": "string",
                            "nullable": true,
                            "example": null,
                            "description": "Option value. Set to null for numeric metrics."
                          },
                          "timeframe": {
                            "type": "string",
                            "enum": [
                              "Month",
                              "Quarter",
                              "Year"
                            ]
                          }
                        },
                        "required": [
                          "date",
                          "value",
                          "optionValue",
                          "timeframe"
                        ]
                      }
                    }
                  },
                  "required": [
                    "points"
                  ]
                }
              }
            },
            "required": [
              "companyId",
              "currency",
              "items"
            ]
          }
        }
      },
      "required": [
        "companies"
      ],
      "additionalProperties": false
    },
    invoke: (client, args) => client.metrics.writePointsBatch(args),
  },
  {
    name: "positions_get_company_positions",
    description: "Get positions for one company\n\nReturns all fund-level positions for a single company — one entry per fund (`companyGroupId`) that holds a position in the company. Each entry carries invested amount, fair market value, ownership percentage, share counts, multiple, and ROI, all FX-converted to `currency` (ISO 4217, required). Filter by `companyGroupIds` to scope to specific funds. Use `date` (ISO 8601) for a historical snapshot; omit to use the latest available data. Ordered by fund id ascending.",
    inputSchema: {
      "type": "object",
      "properties": {
        "id": {
          "type": "number",
          "description": "Company identifier"
        },
        "limit": {
          "minimum": 1,
          "maximum": 500,
          "type": "number",
          "description": "Maximum items per page (1-500). Omit to receive the full result set in one response. Values outside that range are rejected with 422 rather than clamped, so a page is never quietly smaller than requested."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's `meta.nextCursor`. Carries the page size it was issued with, so a follow-up call needs only the cursor. Valid solely for the endpoint, filters, and caller that produced it — change any of them and you get 422; start again without a cursor. Paging reflects the data as of each request, so rows added or removed mid-walk can shift positions."
        },
        "companyGroupIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Optional list of company group identifiers to filter the position breakdown"
        },
        "currency": {
          "type": "string",
          "description": "Reporting currency code (ISO 4217)"
        },
        "date": {
          "type": "string",
          "description": "Optional summary date in ISO format"
        }
      },
      "required": [
        "id",
        "currency"
      ],
      "additionalProperties": false
    },
    invoke: (client, { id, ...query }) => client.positions.getCompanyPositions(id, query),
  },
  {
    name: "positions_get_portfolio_positions",
    description: "Get aggregated portfolio position totals\n\nReturns a single aggregated position object that sums invested amount, fair market value, ownership percentage, share counts, multiple, and ROI across all accessible companies (optionally filtered by `companyIds` and/or `companyGroupIds` to scope to specific funds). `currency` (ISO 4217, required) converts all monetary values. Use `date` (ISO 8601) for a historical snapshot; omit for the latest available data. For a per-company breakdown instead of a single aggregate, use `GET /positions/portfolio/summary`.",
    inputSchema: {
      "type": "object",
      "properties": {
        "companyGroupIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Optional list of company group identifiers to filter the portfolio positions"
        },
        "companyIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Optional list of company identifiers to narrow the aggregation to"
        },
        "currency": {
          "type": "string",
          "description": "Reporting currency code (ISO 4217)"
        },
        "date": {
          "type": "string",
          "description": "Optional summary date in ISO format"
        }
      },
      "required": [
        "currency"
      ],
      "additionalProperties": false
    },
    invoke: (client, args) => client.positions.getPortfolioPositions(args),
  },
  {
    name: "positions_get_portfolio_summary",
    description: "Get portfolio summary with positions and key metrics per company\n\nReturns position data (invested, fair value, multiple, ROI) and latest monthly metrics as of `date` (today by default). One row per company and fund by default; `groupBy: Company` combines selected accessible funds into one row per company. For top 3 companies by fair value use `groupBy: Company`, `sortBy: fairValue`, `sortDirection: desc`, `limit: 3`, `includeMetrics: false`. Sorting happens before pagination; metrics are loaded only for the returned page. Default metrics are MRR, Cash Balance, Headcount, Net Burn Rate, and Runway. Override with `metricTypeNames` or set `includeMetrics: false` to skip metrics entirely. Without a limit all rows are returned and can be large. Default order is company id, then fund id.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "minimum": 1,
          "maximum": 500,
          "type": "number",
          "description": "Maximum items per page (1-500). Omit to receive the full result set in one response. Values outside that range are rejected with 422 rather than clamped, so a page is never quietly smaller than requested."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's `meta.nextCursor`. Carries the page size it was issued with, so a follow-up call needs only the cursor. Valid solely for the endpoint, filters, and caller that produced it — change any of them and you get 422; start again without a cursor. Paging reflects the data as of each request, so rows added or removed mid-walk can shift positions."
        },
        "groupBy": {
          "default": "CompanyGroup",
          "type": "string",
          "enum": [
            "CompanyGroup",
            "Company"
          ],
          "description": "CompanyGroup (default) returns one row per company and fund. Company combines all selected, accessible funds into one row per company using the investment engine totals; companyGroupId is null and companyGroup is omitted."
        },
        "sortBy": {
          "default": "companyId",
          "type": "string",
          "enum": [
            "companyId",
            "fairValue",
            "invested",
            "realized",
            "multiple"
          ],
          "description": "Sort before pagination. For the top companies by fair value use groupBy: Company, sortBy: fairValue, sortDirection: desc, limit: 3. Missing values sort last; company and fund ids break ties."
        },
        "sortDirection": {
          "default": "asc",
          "type": "string",
          "enum": [
            "asc",
            "desc"
          ]
        },
        "includeMetrics": {
          "default": true,
          "type": "boolean",
          "description": "Include the latest monthly metric snapshot as of date (defaults to today). Set false for position-only queries: skips metric computation and returns latestMetrics: []."
        },
        "companyGroupIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Restrict to companies that belong to any of these company groups."
        },
        "companyIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Restrict to these company identifiers."
        },
        "currency": {
          "type": "string",
          "description": "Reporting currency code (ISO 4217)."
        },
        "date": {
          "type": "string",
          "description": "Position summary date (ISO 8601). Defaults to today."
        },
        "metricTypeNames": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Metric type names to include in the latest metrics snapshot (case-insensitive exact match on display name or `shortName`). Defaults to MRR, Cash Balance, Headcount, Net Burn Rate, and Runway. Names that match no accessible metric type are ignored."
        }
      },
      "required": [
        "currency"
      ],
      "additionalProperties": false
    },
    invoke: (client, args) => client.positions.getPortfolioSummary(args),
  },
  {
    name: "transactions_get_company_transactions",
    description: "Get transactions for one company\n\nReturns all transactions for a single company, ordered by date descending then id descending. Each transaction is a typed variant — narrow it via its `type` field. Filter by `companyGroupIds` to scope to a specific fund, `types` to limit to specific transaction kinds, and `priorTo` (ISO 8601) for a historical snapshot. Requires transaction read access on the company.",
    inputSchema: {
      "type": "object",
      "properties": {
        "id": {
          "type": "number",
          "description": "Company identifier"
        },
        "limit": {
          "minimum": 1,
          "maximum": 500,
          "type": "number",
          "description": "Maximum items per page (1-500). Omit to receive the full result set in one response. Values outside that range are rejected with 422 rather than clamped, so a page is never quietly smaller than requested."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's `meta.nextCursor`. Carries the page size it was issued with, so a follow-up call needs only the cursor. Valid solely for the endpoint, filters, and caller that produced it — change any of them and you get 422; start again without a cursor. Paging reflects the data as of each request, so rows added or removed mid-walk can shift positions."
        },
        "companyGroupIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Optional company group identifiers to filter transactions by"
        },
        "types": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "Auction",
              "ConvertibleNote",
              "ConvertToEquity",
              "Dividend",
              "EquityInvestment",
              "EquityReceived",
              "Extend",
              "FutureEquityAgreement",
              "Insolvency",
              "IPO",
              "LimitedAuction",
              "OptionsReceived",
              "OtherExit",
              "OtherInvestment",
              "OtherRealization",
              "Payback",
              "Proprietary",
              "TradeSale",
              "ValuationChange",
              "WriteOff"
            ]
          },
          "description": "Restrict results to these transaction types"
        },
        "priorTo": {
          "type": "string",
          "description": "Exclude transactions on or after this ISO 8601 date (cut-off filter)"
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false
    },
    invoke: (client, { id, ...query }) => client.transactions.getCompanyTransactions(id, query),
  },
  {
    name: "transactions_get_summary",
    description: "Get transaction activity summary\n\nReturns aggregated transaction statistics: total invested, total realized, transaction count, company count, and breakdown by transaction type. Optionally group by period (Month, Quarter, Year). Filter by company, fund (`companyGroupIds`), and date range. Ordered by period ascending.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "minimum": 1,
          "maximum": 500,
          "type": "number",
          "description": "Maximum items per page (1-500). Omit to receive the full result set in one response. Values outside that range are rejected with 422 rather than clamped, so a page is never quietly smaller than requested."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's `meta.nextCursor`. Carries the page size it was issued with, so a follow-up call needs only the cursor. Valid solely for the endpoint, filters, and caller that produced it — change any of them and you get 422; start again without a cursor. Paging reflects the data as of each request, so rows added or removed mid-walk can shift positions."
        },
        "companyGroupIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Restrict to companies that belong to any of these company groups."
        },
        "companyIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Restrict to these company identifiers."
        },
        "currency": {
          "type": "string",
          "description": "Reporting currency code (ISO 4217)."
        },
        "groupBy": {
          "type": "string",
          "enum": [
            "Month",
            "Quarter",
            "Year"
          ],
          "description": "Group results by this period granularity. When omitted, returns a single summary across all time."
        },
        "from": {
          "type": "string",
          "description": "Lower bound for transaction date (ISO 8601, inclusive)."
        },
        "to": {
          "type": "string",
          "description": "Upper bound for transaction date (ISO 8601, inclusive)."
        }
      },
      "required": [
        "currency"
      ],
      "additionalProperties": false
    },
    invoke: (client, args) => client.transactions.getSummary(args),
  },
  {
    name: "transactions_get_transactions",
    description: "Get transactions for multiple companies\n\nReturns transactions across multiple companies. Each transaction is a typed variant — narrow it via its `type` field. Filter by `companyIds`, `companyGroupIds`, `types`, and `priorTo` (ISO 8601 upper-bound date for a historical snapshot). When `companyIds` is provided, the caller must have transaction read access on every listed company. Ordered by date descending, then id descending.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "minimum": 1,
          "maximum": 500,
          "type": "number",
          "description": "Maximum items per page (1-500). Omit to receive the full result set in one response. Values outside that range are rejected with 422 rather than clamped, so a page is never quietly smaller than requested."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's `meta.nextCursor`. Carries the page size it was issued with, so a follow-up call needs only the cursor. Valid solely for the endpoint, filters, and caller that produced it — change any of them and you get 422; start again without a cursor. Paging reflects the data as of each request, so rows added or removed mid-walk can shift positions."
        },
        "companyGroupIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Optional company group identifiers to filter transactions by"
        },
        "types": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "Auction",
              "ConvertibleNote",
              "ConvertToEquity",
              "Dividend",
              "EquityInvestment",
              "EquityReceived",
              "Extend",
              "FutureEquityAgreement",
              "Insolvency",
              "IPO",
              "LimitedAuction",
              "OptionsReceived",
              "OtherExit",
              "OtherInvestment",
              "OtherRealization",
              "Payback",
              "Proprietary",
              "TradeSale",
              "ValuationChange",
              "WriteOff"
            ]
          },
          "description": "Restrict results to these transaction types"
        },
        "priorTo": {
          "type": "string",
          "description": "Exclude transactions on or after this ISO 8601 date (cut-off filter)"
        },
        "companyIds": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Optional company identifiers to filter transactions by"
        }
      },
      "additionalProperties": false
    },
    invoke: (client, args) => client.transactions.getTransactions(args),
  },
];
