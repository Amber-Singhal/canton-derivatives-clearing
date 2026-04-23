# Canton Derivatives Clearing Model

This document outlines the margin and default management model for bilateral Over-the-Counter (OTC) derivatives cleared through the Canton-based system. The model is designed to mitigate counterparty credit risk through a transparent and automated lifecycle managed by Daml smart contracts.

## 1. Overview

The core purpose of this clearing model is to enable two counterparties to enter into a bilateral derivative agreement while protecting each other from the risk of default. This is achieved by:

1.  **Securing Initial Margin (IM):** Both parties post collateral at the inception of the trade to cover potential future losses.
2.  **Daily Mark-to-Market (MTM) and Variation Margin (VM):** The trade's value is calculated daily, and profits or losses are settled immediately to prevent the accumulation of large, unsecured exposures.
3.  **Automated Default Waterfall:** A deterministic, on-ledger process is defined to manage a counterparty's failure to meet a margin call, ensuring an orderly close-out of positions.

The entire lifecycle is managed by contracts on a Canton network, providing atomicity, privacy, and an immutable audit trail for all actions.

## 2. Key Actors

*   **Counterparty A / Counterparty B:** The two principals to the derivative trade. They are signatories on the core `ClearedTrade` contract.
*   **Clearinghouse Operator:** A neutral third-party entity that operates the clearing service. This party is an observer on the `ClearedTrade` and a signatory on the central `Clearinghouse` contract, which holds the Initial Margin. They are responsible for providing market data inputs for MTM calculations.
*   **Oracle (or Data Provider):** An off-ledger entity, designated by the Clearinghouse Operator, that provides the daily market data necessary for Mark-to-Market calculations.

## 3. Trade Lifecycle

### Step 1: Trade Confirmation

1.  One counterparty (`Party A`) creates a `TradeProposal` contract, detailing the economic terms of the derivative (e.g., notional, maturity date, underlying asset, fixed/floating rates).
2.  The other counterparty (`Party B`) accepts the `TradeProposal`.
3.  Upon acceptance, the `TradeProposal` is consumed, and a `ClearedTrade` contract is atomically created. This contract represents the legally binding, cleared trade between the two parties.

### Step 2: Initial Margin (IM) Posting

1.  The `ClearedTrade` contract calculates the required Initial Margin for both parties based on the trade's terms (e.g., a fixed percentage of the notional amount).
2.  Both `Party A` and `Party B` must post their required IM to a central `Clearinghouse` contract. This is typically done via an atomic Delivery-vs-Payment (DVP) transaction using a CIP-0056 compliant token.
3.  The IM is held in segregated accounts within the `Clearinghouse` contract, observable by both counterparties but controlled by the contract's logic. The funds cannot be withdrawn unilaterally by either party.
4.  The `ClearedTrade` contract remains in a `PendingMargin` state until both parties have successfully posted their IM, at which point it transitions to an `Active` state.

### Step 3: Daily Mark-to-Market and Variation Margin (VM)

1.  **MTM Calculation:** Each business day, the Clearinghouse Operator (or a designated trigger/automation service acting on their behalf) ingests market data from the Oracle. This data is used to calculate the current market value (MTM) of the `ClearedTrade` for each counterparty.
2.  **Margin Call Issuance:**
    *   The system compares the MTM of each party's position.
    *   The party with a negative MTM (the "losing" party) is required to post VM to cover the daily loss.
    *   A `MarginCall` contract is created on the ledger, obligating the losing party to pay the specified VM amount to the gaining party.
3.  **VM Settlement:**
    *   The losing party must settle the `MarginCall` within a defined timeframe (e.g., end of the business day).
    *   Settlement occurs via a token transfer. The choice to settle the `MarginCall` is atomic with the token transfer, ensuring that the payment and the satisfaction of the obligation occur in a single, indivisible transaction.
    *   Upon successful settlement, the `MarginCall` contract is archived.

### Step 4: Trade Termination

A trade can be terminated in one of two ways:

1.  **Maturity:** On the trade's maturity date, a final MTM and VM settlement is performed. After the final settlement, the `ClearedTrade` contract is closed out. The `Clearinghouse` contract then automatically returns the posted Initial Margin to both `Party A` and `Party B`.
2.  **Early Termination / Novation:** The parties can mutually agree to terminate the trade early. Upon agreement, a final settlement is calculated and exchanged, and IM is returned, similar to reaching maturity.

## 4. Default Management Waterfall

The default waterfall is a critical, automated process that is triggered if a party fails to meet a Variation Margin call within the contractually defined settlement period.

**Trigger:** Failure to exercise the `Settle` choice on an outstanding `MarginCall` contract before its deadline.

The process proceeds as follows:

1.  **Declaration of Default:** The non-defaulting party can exercise a `DeclareDefault` choice on the `ClearedTrade` contract. This action is irreversible and transitions the trade into a `Defaulted` state.

2.  **Position Close-Out:** The `DeclareDefault` choice atomically triggers the termination of the derivative position. The close-out value is calculated based on the last available MTM data from the Oracle. This determines the total loss incurred by the non-defaulting party.

3.  **Application of Defaulter's Initial Margin:** The `Clearinghouse` contract is instructed to use the *defaulting party's* posted Initial Margin to compensate the non-defaulting party for their losses.
    *   The required amount is transferred from the defaulter's IM balance to the non-defaulting party.
    *   This is an on-ledger, atomic transfer governed by the smart contract logic, requiring no external legal intervention at this stage.

4.  **Return of Remaining Collateral:**
    *   **Defaulter:** If any of the defaulting party's IM remains after covering the loss, it is returned to the defaulting party (or their designated insolvency administrator).
    *   **Non-Defaulter:** The non-defaulting party's own Initial Margin is unaffected by the other party's default. It is returned to them in full.

5.  **Unsecured Claim:** If the defaulting party's IM is insufficient to cover the entirety of the non-defaulting party's loss, the smart contract records the shortfall. The non-defaulting party is left with an unsecured claim for the remaining amount, which must then be pursued through traditional legal channels outside the Daml ledger. The on-ledger record provides a legally binding, timestamped proof of this claim.

This automated waterfall ensures that the risk to the non-defaulting party is strictly limited to the pre-agreed collateral amount, and the resolution process is swift, transparent, and deterministic.