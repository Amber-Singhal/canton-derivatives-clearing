/**
 * @file clearingService.ts
 * @description This file contains the service layer for interacting with the Canton
 *              ledger's JSON API. It provides strongly-typed functions for querying
 *              derivative trades, margin calls, and novations, as well as for
 *              exercising choices on the corresponding Daml contracts.
 */

// --- Configuration ---

// In a real application, this would be sourced from an environment variable
// to allow for different configurations in development, staging, and production.
// Example: const JSON_API_URL = process.env.REACT_APP_JSON_API_URL || "http://localhost:7575";
const JSON_API_URL = "http://localhost:7575";

// --- Type Definitions ---
// These types should correspond to the Daml templates and would typically be
// generated automatically by a tool like `dpm codegen-js`.

export type Party = string;
export type ContractId = string;
export type Decimal = string; // Daml Decimals are represented as strings in JSON API

/**
 * A generic wrapper for contracts returned by the JSON API.
 */
export interface DamlContract<T> {
  contractId: ContractId;
  templateId: string;
  payload: T;
}

/**
 * Represents the core OTC derivative trade contract.
 */
export interface Trade {
  tradeId: string;
  clearinghouse: Party;
  partyA: Party;
  partyB: Party;
  productDescription: string;
  notional: Decimal;
  currency: string;
  tradeDate: string; // ISO 8601 Date format (e.g., "2024-01-15")
  effectiveDate: string;
  maturityDate: string;
  status: "PendingAcceptance" | "PendingMargin" | "Active" | "Matured" | "Terminated";
  marginAccount: ContractId | null; // Optional reference to a MarginAccount contract
}

/**
 * Represents a variation margin call issued by the clearinghouse.
 */
export interface MarginCall {
  callId: string;
  tradeCid: ContractId;
  clearinghouse: Party;
  payer: Party;
  receiver: Party;
  amount: Decimal;
  currency: string;
  valuationDate: string;
  dueDate: string;
  status: "Issued" | "Settled" | "Disputed";
}

/**
 * Represents a proposal to novate (transfer) a trade to a new counterparty.
 */
export interface NovationProposal {
  tradeCid: ContractId;
  proposer: Party;
  currentCounterparty: Party;
  newCounterparty: Party;
  clearinghouse: Party;
}

// --- API Response Types ---

interface QueryResponse<T> {
  result: DamlContract<T>[];
  status: number;
}

interface ExerciseResponse {
  result: {
    exerciseResult: string; // Often the ContractId of the resulting contract
    contracts: {
      archived: { contractId: ContractId; templateId: string }[];
      created: {
        templateId: string;
        payload: unknown;
        contractId: ContractId;
      }[];
    }[];
  };
  status: number;
}

// --- Generic API Helpers ---

/**
 * A generic helper for making authenticated POST requests to the JSON API.
 * @param token The JWT token for authentication.
 * @param endpoint The API endpoint (e.g., "/v1/query").
 * @param body The request body.
 * @returns The JSON response from the API.
 */
const post = async <T>(token: string, endpoint: string, body: object): Promise<T> => {
  const response = await fetch(`${JSON_API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`API call to ${endpoint} failed with status ${response.status}:`, errorBody);
    throw new Error(`API call failed: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Queries the ledger for active contracts of specific templates.
 * @param token The JWT token for authentication.
 * @param templateIds An array of template IDs to query (e.g., ["Trade:Trade"]).
 * @returns A promise that resolves to an array of active contracts.
 */
const queryTemplates = async <T>(token: string, templateIds: string[]): Promise<DamlContract<T>[]> => {
  const response = await post<QueryResponse<T>>(token, "/v1/query", { templateIds });
  return response.result;
};

/**
 * Exercises a choice on a specific contract.
 * @param token The JWT token for authentication.
 * @param templateId The template ID of the contract.
 * @param contractId The ID of the contract to exercise the choice on.
 * @param choice The name of the choice to exercise.
 * @param argument The argument payload for the choice.
 * @returns A promise that resolves to the result of the exercise command.
 */
const exerciseChoice = async (
  token: string,
  templateId: string,
  contractId: ContractId,
  choice: string,
  argument: object
): Promise<ExerciseResponse> => {
  return await post<ExerciseResponse>(token, "/v1/exercise", {
    templateId,
    contractId,
    choice,
    argument,
  });
};

// --- Clearing Service ---

export const clearingService = {
  // --- Queries ---

  fetchTrades: (token: string): Promise<DamlContract<Trade>[]> => {
    return queryTemplates<Trade>(token, ["Trade:Trade"]);
  },

  fetchMarginCalls: (token: string): Promise<DamlContract<MarginCall>[]> => {
    return queryTemplates<MarginCall>(token, ["MarginCall:MarginCall"]);
  },

  fetchNovationProposals: (token: string): Promise<DamlContract<NovationProposal>[]> => {
    return queryTemplates<NovationProposal>(token, ["Novation:NovationProposal"]);
  },

  // --- Trade Lifecycle Choices ---

  acceptTrade: (token: string, tradeCid: ContractId): Promise<ExerciseResponse> => {
    return exerciseChoice(token, "Trade:Trade", tradeCid, "Accept", {});
  },

  postInitialMargin: (token: string, tradeCid: ContractId): Promise<ExerciseResponse> => {
    // In a real scenario, this choice might take a settlement instruction
    // ContractId as an argument to prove that margin has been paid.
    return exerciseChoice(token, "Trade:Trade", tradeCid, "PostInitialMargin", {});
  },

  proposeNovation: (token: string, tradeCid: ContractId, newCounterparty: Party): Promise<ExerciseResponse> => {
    return exerciseChoice(token, "Trade:Trade", tradeCid, "ProposeNovation", { newCounterparty });
  },

  // --- Margin Call Choices ---

  settleMarginCall: (token: string, marginCallCid: ContractId): Promise<ExerciseResponse> => {
    // Similar to initial margin, this choice would likely require proof of
    // payment, such as a reference to a completed transaction.
    return exerciseChoice(token, "MarginCall:MarginCall", marginCallCid, "Settle", {});
  },

  disputeMarginCall: (token: string, marginCallCid: ContractId, reason: string): Promise<ExerciseResponse> => {
    return exerciseChoice(token, "MarginCall:MarginCall", marginCallCid, "Dispute", { reason });
  },

  // --- Novation Choices ---

  acceptNovation: (token: string, novationProposalCid: ContractId): Promise<ExerciseResponse> => {
    return exerciseChoice(token, "Novation:NovationProposal", novationProposalCid, "Accept", {});
  },

  rejectNovation: (token: string, novationProposalCid: ContractId): Promise<ExerciseResponse> => {
    return exerciseChoice(token, "Novation:NovationProposal", novationProposalCid, "Reject", {});
  },
};