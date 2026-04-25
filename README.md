# Canton Derivatives Clearing

[![CI](https://github.com/digital-asset/canton-derivatives-clearing/actions/workflows/ci.yml/badge.svg)](https://github.com/digital-asset/canton-derivatives-clearing/actions/workflows/ci.yml)

This project provides a reference implementation for bilateral Over-The-Counter (OTC) derivatives clearing and margin management on the Canton Network, built using the Daml smart contract language.

It models the complete lifecycle of a derivative trade, from bilateral agreement and novation to a central clearinghouse, through daily variation margin calls, to final settlement or default management.

## Overview

The traditional OTC derivatives market is fragmented, opaque, and carries significant counterparty credit risk. This project demonstrates how a distributed ledger built on Canton can address these challenges by providing:

*   **A Golden Source of Truth:** All parties to a trade share a single, synchronized view of the trade terms, margin requirements, and settlement status.
*   **Atomic Settlement:** Canton's protocol ensures that complex, multi-party workflows like trade novation or margin settlement happen atomically—either all legs of the transaction succeed, or none do. This eliminates settlement risk.
*   **Privacy by Design:** Trade details and margin positions are kept private to the involved counterparties and the clearinghouse. Information is not broadcast to the entire network.
*   **Automation and Efficiency:** The entire trade lifecycle is encoded in Daml smart contracts, enabling robust automation of margin calls, collateral movements, and corporate actions, reducing operational overhead and risk.

For a detailed explanation of the clearing model and business logic, please see [docs/CLEARING_MODEL.md](docs/CLEARING_MODEL.md).

## Core Concepts & Roles

The system is designed around three primary roles:

1.  **Trading Counterparty:** An entity (e.g., a bank, hedge fund) that enters into derivative trades. They propose trades, post initial and variation margin, and view their positions.
2.  **Clearinghouse (CCP):** A central counterparty that sits between the two trading counterparties. It novates the original bilateral trade, becoming the buyer to every seller and the seller to every buyer. The CCP calculates margin requirements, issues margin calls, and manages the default fund.
3.  **Operator:** The party that operates the Daml application and the Canton node(s).

The core workflow is managed through a set of Daml templates:

*   **`TradeProposal`**: An off-ledger agreement is captured on-ledger as a proposal from one counterparty to another.
*   **`ClearedTrade`**: Once both counterparties and the clearinghouse agree, the original proposal is consumed and two new `ClearedTrade` contracts are created, representing the novated legs of the trade between each counterparty and the CCP.
*   **`MarginAccount`**: Each counterparty has a margin account with the CCP, holding their posted initial margin.
*   **`MarginCall`**: The CCP can issue daily margin calls to counterparties based on the mark-to-market (MTM) valuation of their trade portfolio. These calls must be met by posting variation margin.
*   **`DefaultManagement`**: A set of contracts and choices to manage the orderly wind-down of a defaulting counterparty's portfolio.

## Getting Started (Developer Guide)

### Prerequisites

*   **DPM (Digital Asset Package Manager)**: Version 3.4.0 or later. [Installation Instructions](https://docs.digitalasset.com/canton/stable/user-manual/dpm/install.html).
*   **Node.js**: v18.x or later.
*   **Yarn** or **npm**.

### 1. Clone the Repository

```sh
git clone https://github.com/digital-asset/canton-derivatives-clearing.git
cd canton-derivatives-clearing
```

### 2. Build the Daml Models

Compile the Daml code into a DAR (Daml Archive) file.

```sh
dpm build
```
The output will be located at `.daml/dist/canton-derivatives-clearing-0.1.0.dar`.

### 3. Run Daml Script Tests

Verify the business logic by running the automated tests.

```sh
dpm test
```

### 4. Start a Local Canton Ledger

Run a local, single-node Canton instance for development and testing. This command also starts a JSON API gateway on port 7575.

```sh
dpm sandbox
```

The sandbox will automatically upload the DAR file built in step 2.

### 5. Run the Frontend Application

In a separate terminal, navigate to the `frontend` directory, install dependencies, and start the development server.

```sh
cd frontend
npm install
npm start
```

The application will be available at `http://localhost:3000`. You can log in using pre-allocated party names like `Alice`, `Bob`, or `CCP` to interact with the system.

## Project Structure

```
.
├── .github/workflows/ci.yml  # GitHub Actions CI pipeline
├── daml/                     # Daml smart contract source code
│   ├── Clearing.daml         # Clearinghouse and novation logic
│   ├── DefaultManagement.daml# Counterparty default handling
│   ├── Margin.daml           # Margin accounts and margin calls
│   ├── Trade.daml            # Trade proposal and cleared trade contracts
│   └── Test/                 # Daml Script tests
├── docs/
│   └── CLEARING_MODEL.md     # In-depth documentation of the business logic
├── frontend/                 # React-based user interface
├── daml.yaml                 # Daml project configuration
└── README.md                 # This file
```

## Operations Guide

### Party Management

On a production Canton network, parties are not pre-allocated. New trading counterparties must be onboarded by a participant node operator. This is typically done via the participant's admin API.

For local development with `dpm sandbox`, parties are allocated from a predefined list in `daml.yaml` for ease of use.

### Automation with Triggers

In a production environment, many clearinghouse and counterparty actions would be automated. Daml Triggers are a powerful way to achieve this. Potential automations include:
*   **Margin Call Generation:** A trigger running on the CCP's node could connect to an external price feed (e.g., via a REST API) to fetch daily MTM prices, calculate variation margin requirements for all counterparties, and automatically create `MarginCall` contracts on the ledger.
*   **Margin Payment Processing:** A counterparty's trigger could listen for new `MarginCall` contracts and automatically initiate a payment instruction to meet the call, for example by exercising a choice on a `Cash` or `Token` contract.
*   **Trade Acceptance:** A counterparty could run a trigger that automatically accepts incoming `TradeProposal` contracts that meet certain predefined criteria.

Triggers are run as separate processes that connect to the ledger's gRPC API.

## Contributing

Contributions are welcome! Please follow the standard GitHub flow:

1.  Fork the repository.
2.  Create a new feature branch (`git checkout -b my-feature`).
3.  Make your changes.
4.  Ensure the tests pass (`dpm test`).
5.  Commit your changes (`git commit -am 'Add some feature'`).
6.  Push to the branch (`git push origin my-feature`).
7.  Create a new Pull Request.

## License

This project is licensed under the [Apache 2.0 License](LICENSE).