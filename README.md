# Canton Derivatives Clearing

[![CI](https://github.com/digital-asset/canton-derivatives-clearing/actions/workflows/ci.yml/badge.svg)](https://github.com/digital-asset/canton-derivatives-clearing/actions/workflows/ci.yml)

This project provides a complete implementation of an Over-the-Counter (OTC) derivatives clearinghouse and margin management system built on the [Canton Network](https://www.canton.io/) using the [Daml](https://www.daml.com/) smart contract language.

It models the entire lifecycle of a bilateral derivative trade, from affirmation and initial margin posting to daily variation margin settlement and final termination. The use of Canton ensures that all interactions are atomic, private, and auditable only by the authorized parties.

## Overview

In traditional finance, OTC derivatives clearing is a complex process involving multiple intermediaries, reconciliation steps, and significant counterparty risk. This project demonstrates how a distributed ledger can streamline this process, reduce operational friction, and mitigate risk.

**Key Benefits of this Daml/Canton Implementation:**

*   **Privacy by Design:** Trade details are known only to the two counterparties and the clearinghouse. Other participants on the network have no visibility.
*   **Atomic Settlement:** Variation margin is settled using Delivery-vs-Payment (DvP) with Canton-native tokens, eliminating settlement risk. A margin payment and the corresponding update to the trade state occur in a single, atomic transaction.
*   **Reduced Counterparty Risk:** The clearinghouse acts as a central counterparty (CCP), holding initial margin in a segregated, on-ledger account, which drastically reduces risk in the event of a default.
*   **Golden Source of Truth:** All parties share a single, synchronized, and immutable record of every trade and margin movement, eliminating costly and error-prone reconciliations.

## Features

*   **Bilateral Trade Affirmation:** A standard proposal/acceptance workflow for two counterparties to agree on the economic terms of a trade (e.g., Interest Rate Swap).
*   **Centralized Clearing:** Affirmed trades are submitted to a clearinghouse party for clearing.
*   **Initial Margin (IM) Management:** The clearinghouse calculates and holds IM for each trade in a dedicated on-ledger `MarginAccount`.
*   **Variation Margin (VM) Workflow:**
    *   Daily Mark-to-Market (MTM) values can be submitted.
    *   VM requirements are calculated based on MTM changes.
    *   On-ledger `MarginCall` contracts are issued to the party owing margin.
    *   Margin calls are settled atomically using a DvP process against token collateral.
*   **Trade Lifecycle:** Supports trade termination and novation.

## Architecture

The system is composed of two main components:

1.  **Daml Model (`daml/`):** The core business logic is encapsulated in Daml smart contracts. These define the rights, obligations, and workflows for all participants. Key templates include:
    *   `TradeAgreement`: Represents the confirmed economic terms between two counterparties.
    *   `ClearingInstruction`: The instruction from counterparties to the clearinghouse to clear the trade.
    *   `ClearedTrade`: The central contract representing the cleared trade, viewable by the counterparties and managed by the clearinghouse.
    *   `MarginAccount`: Holds the initial margin collateral for a `ClearedTrade`.
    *   `MarginCall`: Represents an obligation to post variation margin, which can be settled atomically.

2.  **Frontend (`frontend/`):** A React-based web application that provides a user interface for counterparties and the clearinghouse. It communicates with a Canton participant node's JSON API to create contracts and exercise choices. It uses the `@c7/react` library for real-time ledger data streaming.

## Prerequisites

Before you begin, ensure you have the following installed:

*   **DPM (Digital Asset Package Manager) v3.4.0 or later:** The official Canton SDK and package manager.
    ```bash
    curl https://get.digitalasset.com/install/install.sh | sh
    ```
*   **Node.js and npm:** For running the frontend application. We recommend Node.js v18 or later.

## Getting Started: Local Development

Follow these steps to run the full application stack on your local machine.

**1. Clone the Repository**
```bash
git clone https://github.com/digital-asset/canton-derivatives-clearing.git
cd canton-derivatives-clearing
```

**2. Build the Daml Model**
This command compiles your Daml code into a DAR (Daml Archive) file.
```bash
dpm build
```
The output will be located at `.daml/dist/canton-derivatives-clearing-0.1.0.dar`.

**3. Start the Local Canton Ledger**
This command starts a local Canton network (a "sandbox") and deploys the DAR file to it. The ledger's JSON API will be available on port `7575`.
```bash
dpm sandbox
```
The sandbox will also run the `Setup` script from `daml/Setup.daml`, which allocates a set of default parties (`Clearinghouse`, `BankA`, `BankB`) for demonstration purposes.

**4. Install Frontend Dependencies**
In a new terminal window, navigate to the `frontend` directory and install the required npm packages.
```bash
cd frontend
npm install
```

**5. Run the Frontend Application**
```bash
npm start
```
This will launch the React development server. Open your web browser to [http://localhost:3000](http://localhost:3000) to view the application. You will be able to log in as one of the pre-configured parties (`Clearinghouse`, `BankA`, or `BankB`) to interact with the system.

## Running Tests

The Daml model includes a suite of tests written in Daml Script. These tests verify the correctness of the contract logic and workflows.

To run all tests:
```bash
dpm test
```

## Project Structure

```
.
├── .github/workflows/ci.yml # GitHub Actions CI configuration
├── daml/                      # Daml model source code
│   ├── Clearing.daml          # Core clearinghouse logic and templates
│   ├── Trade.daml             # Bilateral trade agreement logic
│   ├── Margin.daml            # Margin account and margin call logic
│   ├── Setup.daml             # Daml Script for initializing the ledger
│   └── daml.yaml              # Daml package configuration
├── frontend/                  # React frontend application
│   ├── src/
│   ├── package.json
│   └── ...
├── .gitignore
├── LICENSE
└── README.md                  # This file
```

## Contributing

Contributions are welcome! Please feel free to open a pull request or submit an issue.

When contributing, please ensure that:
1. Your code is formatted correctly (`daml format` for Daml, `npm run format` for TypeScript).
2. All existing and new tests pass (`dpm test`).
3. Your commit messages are clear and descriptive.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](./LICENSE) file for details.