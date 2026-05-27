// AUTO-GENERATED FILE — DO NOT EDIT.
// Regenerate with: npm run codegen
// Source: @rundit-sdk/client v0.3.0-rc.11 (openapi.json)

import type { RunditClient } from '@rundit-sdk/client';

export const SDK_VERSION = "0.3.0-rc.11";

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
    description: "List companies available to the SDK consumer",
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
        }
      },
      "additionalProperties": false
    },
    invoke: (client, args) => client.companies.getAll(args),
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
    description: "List company groups available to the SDK consumer",
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
    description: "List published company reports accessible to the caller (metadata only)\n\nReturns lightweight report metadata (id, title, period, publisher company reference). Use GET /company-reports/:id to fetch the full content of a specific report. Visibility is determined by the caller's roles — VC users see reports for managed-portfolio companies, company employees see their own company's reports, portfolio investors see Published reports shared with their visibility groups. Filters narrow the list by company ids and reporting period (timeframe + date range).",
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
    name: "metrics_get_types",
    description: "List metric types available to the SDK consumer\n\nReturns predefined metric types plus user-defined metric types scoped to the caller — VC group custom types for VC users, company custom types for company users. Each entry includes a numeric id and a human-readable name suitable for display or LLM context.",
    inputSchema: {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    },
    invoke: (client) => client.metrics.getTypes(),
  },
  {
    name: "metrics_search",
    description: "Read metric values for accessible companies, grouped by company\n\nReturns metric data points for companies the caller can access (companies in the caller's VC group portfolio, or the caller's own company for company users). Each entry carries company and metric type references with id and human-readable name. Filter by company, company group, metric type, timeframe, and date range to narrow the response.",
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
