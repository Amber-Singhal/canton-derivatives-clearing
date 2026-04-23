#!/bin/bash

# ==============================================================================
# Setup Script for Canton Derivatives Clearing
#
# Description:
#   This script initialises the necessary parties for the derivatives
#   clearing application on a local Canton sandbox ledger.
#
#   It performs the following actions:
#   1. Waits for the sandbox's JSON API to be available.
#   2. Allocates parties for the Clearinghouse, Alice, and Bob.
#   3. Writes the resulting party identifiers to a JSON file (`ui/parties.json`)
#      for use by UI components and other scripts.
#
# Usage:
#   ./scripts/setup-clearinghouse.sh
#
# Prerequisites:
#   - `curl` and `jq` must be installed and available in the PATH.
#   - A Canton sandbox must be running or starting up (e.g., via `dpm sandbox`).
#
# ==============================================================================

# --- Strict Mode ---
# Exit on error, if a variable is not set, or if a command in a pipeline fails.
set -euo pipefail

# --- Configuration ---
readonly LEDGER_HOST="localhost"
readonly LEDGER_PORT_JSON="7575"
readonly JSON_API_V2_URL="http://${LEDGER_HOST}:${LEDGER_PORT_JSON}/v2"
readonly JSON_API_V1_HEALTH_URL="http://${LEDGER_HOST}:${LEDGER_PORT_JSON}/v1/health"

readonly PARTIES_OUTPUT_FILE="ui/parties.json"
readonly MAX_RETRIES=20
readonly RETRY_DELAY_SECS=3

# --- Helper Functions ---

# Log a message with a UTC timestamp
log() {
  echo ">>> [$(date -u +"%Y-%m-%dT%H:%M:%SZ")] ${1}"
}

# Check for required command-line tools
check_dependencies() {
  log "Checking for required tools (curl, jq)..."
  for cmd in curl jq; do
    if ! command -v "$cmd" &> /dev/null; then
      log "ERROR: Required command '$cmd' is not installed or not in PATH."
      log "Please install it to continue."
      exit 1
    fi
  done
  log "All required tools are available."
}

# Wait for the Canton Sandbox JSON API to become healthy
wait_for_sandbox() {
  log "Waiting for Canton sandbox to be healthy at ${JSON_API_V1_HEALTH_URL}..."
  local retries=0
  while ! curl --fail --silent "${JSON_API_V1_HEALTH_URL}" > /dev/null; do
    retries=$((retries + 1))
    if [ ${retries} -ge ${MAX_RETRIES} ]; then
      log "ERROR: Canton sandbox did not become available after ${MAX_RETRIES} attempts."
      log "Please ensure the sandbox is running with 'dpm sandbox'."
      exit 1
    fi
    log "Sandbox not ready. Retrying in ${RETRY_DELAY_SECS}s... (Attempt ${retries}/${MAX_RETRIES})"
    sleep "${RETRY_DELAY_SECS}"
  done
  log "Canton sandbox is healthy and ready for connections."
}

# Allocate a new party on the ledger via the JSON API v2 endpoint.
# On a local sandbox, this endpoint does not require authentication.
#
# $1: Display Name for the party
# $2: Party ID Hint (used to construct a deterministic party ID on some ledgers)
# Returns: The allocated party identifier string to standard output.
allocate_party() {
  local display_name="$1"
  local party_hint="$2"

  log "Allocating party: '${display_name}' (hint: '${party_hint}')..."

  local payload
  payload=$(jq -n --arg dn "$display_name" --arg ph "$party_hint" \
    '{ "displayName": $dn, "partyIdHint": $ph }')

  local response
  response=$(curl --silent --show-error --fail -X POST \
    -H "Content-Type: application/json" \
    -d "${payload}" \
    "${JSON_API_V2_URL}/parties/allocate")

  local party_id
  party_id=$(echo "${response}" | jq -r '.identifier')

  if [[ -z "${party_id}" || "${party_id}" == "null" ]]; then
    log "ERROR: Failed to allocate party '${display_name}'."
    log "Response from server: ${response}"
    exit 1
  fi

  log "Successfully allocated '${display_name}' with party ID: ${party_id}"
  echo "${party_id}"
}

# --- Main Execution ---
main() {
  check_dependencies
  wait_for_sandbox

  log "Allocating all required parties for the application..."
  local clearinghouse_party_id
  local alice_party_id
  local bob_party_id

  clearinghouse_party_id=$(allocate_party "Clearinghouse" "clearinghouse")
  alice_party_id=$(allocate_party "Alice" "alice")
  bob_party_id=$(allocate_party "Bob" "bob")

  # Create the output directory for the UI if it doesn't exist
  mkdir -p "$(dirname "${PARTIES_OUTPUT_FILE}")"

  log "Writing party identifiers to ${PARTIES_OUTPUT_FILE}..."
  jq -n \
    --arg chid "${clearinghouse_party_id}" \
    --arg aid "${alice_party_id}" \
    --arg bid "${bob_party_id}" \
    '{
      "clearinghouse": $chid,
      "alice": $aid,
      "bob": $bid
    }' > "${PARTIES_OUTPUT_FILE}"

  log "Setup complete. Party identifiers saved."
  echo
  log "Contents of ${PARTIES_OUTPUT_FILE}:"
  cat "${PARTIES_OUTPUT_FILE}"
  echo
}

# Run the main function of the script
main