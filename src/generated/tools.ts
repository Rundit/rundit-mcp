// AUTO-GENERATED FILE — DO NOT EDIT.
// Regenerate with: npm run codegen
// Source: @rundit-sdk/client v0.2.0 (openapi.json)

import type { RunditClient } from '@rundit-sdk/client';

export const SDK_VERSION = "0.2.0";

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
    description: "List companies available to the SDK consumer\n\nReturns the compact form (id, name, currency, type, website, logo) for every company the caller can read. Filter by `companyIds`, `companyGroupIds`, and/or `nameSearch` (case-insensitive substring on display name; accepts an array to resolve multiple companies at once with OR semantics — e.g. `nameSearch=[\"acme\",\"beta\",\"gamma\"]` returns any company whose name contains any of the three substrings). Avoids listing the full portfolio when the agent only knows companies by name.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum items per page. Currently accepted but not enforced; reserved for future pagination."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's meta.nextCursor. Currently accepted but ignored."
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
    description: "Get full company dashboard for ONE company\n\nReturns company metadata, positions per fund, all metrics with data points, recent transactions, and report summaries for a single company. For more than one company, prefer POST /companies/dashboards (`companies.getDashboards`) instead — it returns the same payload per company in one call and avoids the N+1 pattern. Use `metricsFrom` to limit metric history, `transactionLimit` and `reportLimit` to cap list sizes.",
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
    description: "PREFERRED tool for multi-company analysis — full dashboards for many companies in one call\n\nPREFERRED tool for multi-company analysis. Returns full dashboards (company metadata, positions, metrics with data points, recent transactions, report summaries) for many companies in a single request, grouped per company. Use this instead of looping `GET /companies/:id/dashboard` (the N+1 pattern) whenever the agent needs to look at more than one company — it returns the same shape per company but in one round trip. Typical workflow: resolve company ids (e.g. `GET /companies?nameSearch=[\"acme\",\"beta\"]`), then call this with their `companyIds`. Use `metricTypeIds` or `metricTypeNames` to scope the returned metrics, `metricsTimeframe` to restrict data point granularity, `currency` (ISO 4217) to FX-convert monetary metrics across the batch, and `transactionLimit` / `reportLimit` to cap list sizes per company.",
    inputSchema: {
      "type": "object",
      "properties": {
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
        "metricsTimeframe": {
          "type": "string",
          "description": "Restrict metric data points to this reporting period granularity.",
          "enum": [
            "Month",
            "Quarter",
            "Year"
          ]
        },
        "metricTypeNames": {
          "description": "Metric type names to include. Omit to include all metrics. Use metric type ids via `metricTypeIds` when ids are known.",
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
    description: "Get one company available to the SDK consumer",
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
    description: "List company groups available to the SDK consumer\n\nReturns compact company group metadata (id, name, demo flag, color, member company ids). Filter by `companyGroupIds` and/or `nameSearch` (case-insensitive substring on name; accepts an array to resolve multiple groups in one call with OR semantics — e.g. `nameSearch=[\"fund i\",\"fund ii\"]`).",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum items per page. Currently accepted but not enforced; reserved for future pagination."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's meta.nextCursor. Currently accepted but ignored."
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
    description: "Get one company group available to the SDK consumer",
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
    description: "List published company reports accessible to the caller (metadata only)\n\nReturns lightweight report metadata (id, title, period, publisher company reference). Use GET /company-reports/:id to fetch the full content of a specific report. Visibility is determined by the caller's roles — VC users see reports for managed-portfolio companies, company employees see their own company's reports, portfolio investors see Published reports shared with their visibility groups. Filters narrow the list by company ids, company groups, company name substring (`companyNameSearch`), and reporting period (timeframe + date range).",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum items per page. Currently accepted but not enforced; reserved for future pagination."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's meta.nextCursor. Currently accepted but ignored."
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
    description: "Aggregate metrics across portfolio companies\n\nReturns aggregated metric values (SUM, AVG, MEDIAN, MIN, MAX, COUNT) across companies for each reporting period. Optionally group results by company group for fund-level breakdowns.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum items per page. Currently accepted but not enforced; reserved for future pagination."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's meta.nextCursor. Currently accepted but ignored."
        },
        "metricTypeNames": {
          "description": "Metric type names to aggregate (case-insensitive exact match).",
          "example": [
            "MRR - Monthly Recurring Revenue",
            "Headcount / Employees / Personnel"
          ],
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
        "metricTypeNames",
        "aggregation"
      ],
      "additionalProperties": false
    },
    invoke: (client, args) => client.metrics.aggregate(args),
  },
  {
    name: "metrics_compare",
    description: "Compare metrics across companies\n\nReturns date-aligned rows for one or more metric types across multiple companies. Pass `metricTypeIds` (array of ids) or `metricTypeNames` (array of names) to compare several metrics in a single round trip, or the legacy `metricTypeName` (string) for a single metric. Each row contains one value per company for a given period. Optionally includes period-over-period percentage change. Use `companyIds`, `companyNameSearch`, or `companyGroupIds` to select companies.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum items per page. Currently accepted but not enforced; reserved for future pagination."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's meta.nextCursor. Currently accepted but ignored."
        },
        "metricTypeIds": {
          "description": "Restrict to specific metric types by id (use GET /metrics/types to discover identifiers). When multiple ids are provided, the response contains one entry per metric type.",
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "metricTypeNames": {
          "description": "Resolve metric types by case-insensitive exact match on their display name and intersect with `metricTypeIds`. Lets the agent fetch by metric name (e.g. \"Revenue\") without first listing /metrics/types.",
          "example": [
            "MRR - Monthly Recurring Revenue",
            "Churn Rate (Customers, Users...)"
          ],
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "metricTypeName": {
          "type": "string",
          "description": "Metric type name to compare across companies (case-insensitive exact match). Convenience shorthand — ignored when `metricTypeNames` or `metricTypeIds` is provided.",
          "example": "MRR - Monthly Recurring Revenue"
        },
        "companyIds": {
          "description": "Restrict to these company identifiers.",
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "companyNameSearch": {
          "description": "Case-insensitive substring match on company display name. Pass an array to compare multiple companies in one call — a company matches if its name contains ANY of the listed substrings (OR semantics). A single string is also accepted and treated as a one-element array. Intersects with `companyIds`/`companyGroupIds`.",
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
    description: "List metric types available to the SDK consumer\n\nReturns predefined metric types plus user-defined metric types scoped to the caller — VC group custom types for VC users, company custom types for company users. Each entry carries the metric shape needed to interpret values: `valueType` is `\"numeric\"` (read `point.value` as a number; may carry `rangeConfig` with min/max/step for ranged metrics) or `\"option\"` (read `point.optionValue` as a string from `optionConfig.options[]` — this is how boolean / yes-no metrics are encoded, as two options typically labelled \"Yes\"/\"No\"). `unit.unit` describes the measurement (`Currency`, `Percentage`, `Number`, time units, ...); `unit.currencyCode` is intentionally null on this endpoint because monetary types resolve their concrete currency per company — call /metrics to receive `unit.currencyCode` populated with each company's native currency, or pass `currency` to convert all monetary metrics to a chosen target.",
    inputSchema: {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    },
    invoke: (client) => client.metrics.getTypes(),
  },
  {
    name: "metrics_search",
    description: "Read metric values for accessible companies, grouped by company\n\nReturns metric data points for companies the caller can access (companies in the caller's VC group portfolio, or the caller's own company for company users). Each entry carries company and metric type references with id and human-readable name. Each point carries both `value` (number, for `valueType === \"numeric\"`, including ranged numerics constrained by the type's `rangeConfig`) and `optionValue` (string, for `valueType === \"option\"`, matching one of `metricType.optionConfig.options[].value` — this is how boolean/yes-no metrics report their reading); read whichever matches the metric type's `valueType`. Filter by company id, company name substring (`companyNameSearch`), company group, metric type id, metric type name (`metricTypeNames`), timeframe, and date range to narrow the response. Pass `currency` (ISO 4217) to FX-convert monetary metrics to that target currency in one call instead of fetching company currencies separately.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum items per page. Currently accepted but not enforced; reserved for future pagination."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's meta.nextCursor. Currently accepted but ignored."
        },
        "companyIds": {
          "description": "Restrict results to these companies. Defaults to all companies the caller can access.",
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        "companyNameSearch": {
          "description": "Resolve companies by case-insensitive substring match on their display name. Pass an array to resolve multiple companies in one call — a company matches if its name contains ANY of the listed substrings (OR semantics). A single string is also accepted and treated as a one-element array. Intersects with `companyIds`/`companyGroupIds`. Lets the agent skip a separate /companies lookup when it only knows names.",
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
          "description": "Resolve metric types by case-insensitive exact match on their display name and intersect with `metricTypeIds`. Lets the agent fetch by metric name (e.g. \"Revenue\") without first listing /metrics/types.",
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
        }
      },
      "additionalProperties": false
    },
    invoke: (client, args) => client.metrics.search(args),
  },
  {
    name: "positions_get_company_positions",
    description: "Get positions for one company",
    inputSchema: {
      "type": "object",
      "properties": {
        "id": {
          "type": "number",
          "description": "Company identifier"
        },
        "limit": {
          "type": "number",
          "description": "Maximum items per page. Currently accepted but not enforced; reserved for future pagination."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's meta.nextCursor. Currently accepted but ignored."
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
          "description": "Reporting currency code"
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
    description: "Get portfolio positions",
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
          "description": "Reporting currency code"
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
    description: "Get portfolio summary with positions and key metrics per company\n\nReturns one row per company with position data (invested, fair value, multiple, ROI) and latest values for selected metrics. Defaults to MRR, Cash Balance, Headcount, Net Burn Rate, and Runway. Override with `metricTypeNames`. Designed for portfolio overview tables.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum items per page. Currently accepted but not enforced; reserved for future pagination."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's meta.nextCursor. Currently accepted but ignored."
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
          "description": "Metric type names to include in the latest metrics snapshot. Defaults to MRR, Cash Balance, Headcount, Net Burn Rate, and Runway."
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
    description: "Get transactions for one company",
    inputSchema: {
      "type": "object",
      "properties": {
        "id": {
          "type": "number",
          "description": "Company identifier"
        },
        "limit": {
          "type": "number",
          "description": "Maximum items per page. Currently accepted but not enforced; reserved for future pagination."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's meta.nextCursor. Currently accepted but ignored."
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
    description: "Get transaction activity summary\n\nReturns aggregated transaction statistics: total invested, total realized, transaction count, company count, and breakdown by transaction type. Optionally group by period (Month, Quarter, Year). Filter by company, company group, and date range.",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum items per page. Currently accepted but not enforced; reserved for future pagination."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's meta.nextCursor. Currently accepted but ignored."
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
    description: "Get transactions for multiple companies",
    inputSchema: {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum items per page. Currently accepted but not enforced; reserved for future pagination."
        },
        "cursor": {
          "type": "string",
          "description": "Opaque cursor from a previous response's meta.nextCursor. Currently accepted but ignored."
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
