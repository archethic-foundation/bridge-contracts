@version 1

####################################
# EVM => Archethic : Request funds #
####################################

condition triggered_by: transaction, on: request_funds(end_time, amount, user_address, secret_hash, evm_tx_address, evm_contract, chain_id), as: [
  type: "contract",
  code: valid_chargeable_code?(end_time, amount, user_address, secret_hash),
  timestamp: (
    # End time cannot be less than now or more than 1 day
    now = Time.now()
    end_time > now && end_time <= now + 86400
  ),
  content: List.in?([@CHAIN_IDS], chain_id),
  token_transfers: (
    charged_contracts = State.get("charged_contracts", Map.new())
    !contract_already_charged?(charged_contracts, chain_id, evm_contract)
  ),
  address: (
    valid? = false

    tx_receipt_request = get_tx_receipt_request(evm_tx_address)
    call_status_request = get_call_request(evm_contract, "status()", 2)
    call_enough_funds_request = get_call_request(evm_contract, "enoughFunds()", 3)
    call_hash_request = get_call_request(evm_contract, "hash()", 4)
    call_end_time_request = get_call_request(evm_contract, "lockTime()", 5)
    call_amount_request = get_call_request(evm_contract, "amount()", 6)

    body = Json.to_string([
      tx_receipt_request,
      call_status_request,
      call_enough_funds_request,
      call_hash_request,
      call_end_time_request,
      call_amount_request
    ])

    chain_data = get_chain_data(chain_id)
    headers = ["Content-Type": "application/json"]

    evm_responses = query_evm_apis(chain_data.endpoints, "POST", headers, body)
    for res in evm_responses do
      if !valid? && res.status == 200 && Json.is_valid?(res.body) do
        responses = Json.parse(res.body)

        tx_receipt = get_response(responses, 1)
        call_status = get_response(responses, 2)
        call_enough_funds = get_response(responses, 3)
        call_hash = get_response(responses, 4)
        call_end_time = get_response(responses, 5)
        call_amount = get_response(responses, 6)

        if !any_nil?([tx_receipt, call_status, call_enough_funds, call_hash, call_end_time, call_amount]) do
          # event = Crypto.hash("ContractMinted(address,uint256)", "keccak256")
          event = "0x8640c3cb3cba5653efe5a3766dc7a9fb9b02102a9f97fbe9ea39f0082c3bf497"
          valid_tx_receipt? = valid_tx_receipt?(tx_receipt, chain_data.proxy_address, evm_contract, event)
          # Pending is status 0
          valid_status? = valid_status?(call_status, 0)
          enough_funds? = enough_funds?(call_enough_funds)
          valid_hash? = valid_hash?(call_hash, secret_hash)
          valid_end_time? = valid_end_time?(call_end_time, end_time)
          valid_amount? = valid_amount?(call_amount, amount, chain_data.decimals)

          valid? = valid_tx_receipt? && valid_status? && enough_funds? && valid_hash? && valid_end_time? && valid_amount?
        end
      end
    end

    valid?
  )
]

actions triggered_by: transaction, on: request_funds(end_time, amount, _, secret_hash, _, evm_contract, chain_id) do
  chain_data = get_chain_data(chain_id)

  charged_contracts = State.get("charged_contracts", Map.new())
  charged_contracts = delete_old_charged_contracts(charged_contracts)
  charged_contracts = add_charged_contracts(charged_contracts, chain_id, evm_contract, end_time)
  State.set("charged_contracts", charged_contracts)

  args = [
    @TOKEN_ADDRESS,
    amount,
    transaction.address
  ]

  token_definition =
    Contract.call_function(@FACTORY_ADDRESS, "get_token_resupply_definition", args)

  signature = sign_for_evm(secret_hash)

  proxy_address = Map.get(chain_data, "proxy_address")

  Contract.set_type("token")
  Contract.add_recipient(
    address: transaction.address,
    action: "provision",
    args: [evm_contract, chain_data.endpoints, signature, proxy_address]
  )
  Contract.set_content(token_definition)
end

##########################################
# Archethic => EVM : Request secret hash #
##########################################

condition triggered_by: transaction, on: request_secret_hash(htlc_genesis_address, amount, user_address, chain_id, evm_user_address), as: [
  type: "transfer",
  code: valid_signed_code?(htlc_genesis_address, amount, user_address),
  content: List.in?([@CHAIN_IDS], chain_id),
  token_transfers:
    (
      valid? = false

      htlc_genesis_address = String.to_hex(htlc_genesis_address)
      transfers = Map.get(transaction.token_transfers, htlc_genesis_address, [])

      for transfer in transfers do
        if transfer.token_address == @TOKEN_ADDRESS &&
             transfer.token_id == 0 &&
             transfer.amount == amount do
          valid? = true
        end
      end

      valid?
    )
]

actions triggered_by: transaction, on: request_secret_hash(htlc_genesis_address, amount, _user_address, chain_id, evm_user_address) do
  # Here delete old secret that hasn't been used before endTime
  requested_secrets = State.get("requested_secrets", Map.new())

  secret = Crypto.hmac(transaction.address)
  secret_hash = Crypto.hash(secret, "sha256")

  protocol_fee = Contract.call_function(@FACTORY_ADDRESS, "get_protocol_fee", [])
  chain_data = get_chain_data(chain_id)
  decimals = Map.get(chain_data, "decimals")

  fee_amount = amount * protocol_fee / 100
  evm_amount = amount - fee_amount
  evm_big_amount = Math.bigint(evm_amount, decimals)

  abi_data =
    Evm.abi_encode("(bytes32, bytes32, uint, address, uint)", [
      Crypto.hash(htlc_genesis_address),
      secret_hash,
      chain_id,
      evm_user_address,
      evm_big_amount
    ])

  signature_data = Crypto.hash(abi_data, "keccak256")

  # Build signature for EVM verification
  signature = sign_for_evm(signature_data)

  # Calculate endtime now + 2 hours
  now = Time.now()
  end_time = now - Math.rem(now, 60) + 7200

  # Add secret and signature in content
  htlc_map = [
    hmac_address: transaction.address,
    end_time: end_time,
    chain_id: chain_id,
    evm_user_address: evm_user_address
  ]

  htlc_genesis_address = String.to_hex(htlc_genesis_address)
  requested_secrets = Map.set(requested_secrets, htlc_genesis_address, htlc_map)
  State.set("requested_secrets", requested_secrets)

  proxy_address = Map.get(chain_data, "proxy_address")

  Contract.add_recipient(
    address: htlc_genesis_address,
    action: "set_secret_hash",
    args: [secret_hash, signature, end_time, proxy_address]
  )
end

####################################
# Archethic => EVM : Reveal secret #
####################################

condition triggered_by: transaction, on: reveal_secret(htlc_genesis_address, evm_tx_address, evm_contract), as: [
  type: "transfer",
  content: (
    # Ensure htlc_genesis_address exists in pool state
    # and end_time has not been reached
    valid? = false

    htlc_genesis_address = String.to_hex(htlc_genesis_address)
    requested_secrets = State.get("requested_secrets", Map.new())
    htlc_map = Map.get(requested_secrets, htlc_genesis_address)

    if htlc_map != nil do
      valid? = htlc_map.end_time > Time.now()
    end

    valid?
  ),
  address: (
    valid? = false
    htlc_map = nil

    htlc_genesis_address = String.to_hex(htlc_genesis_address)
    requested_secrets = State.get("requested_secrets", Map.new())
    htlc_map = Map.get(requested_secrets, htlc_genesis_address)

    if htlc_map != nil do
      tx_receipt_request = get_tx_receipt_request(evm_tx_address)
      call_status_request = get_call_request(evm_contract, "status()", 2)
      call_enough_funds_request = get_call_request(evm_contract, "enoughFunds()", 3)
      call_hash_request = get_call_request(evm_contract, "hash()", 4)
      call_end_time_request = get_call_request(evm_contract, "lockTime()", 5)
      call_amount_request = get_call_request(evm_contract, "amount()", 6)
      call_recipient_request = get_call_request(evm_contract, "recipient()", 7)

      body = Json.to_string([
        tx_receipt_request,
        call_status_request,
        call_enough_funds_request,
        call_hash_request,
        call_end_time_request,
        call_amount_request,
        call_recipient_request
      ])

      chain_data = get_chain_data(htlc_map.chain_id)
      headers = ["Content-Type": "application/json"]

      evm_responses = query_evm_apis(chain_data.endpoints, "POST", headers, body)
      for res in evm_responses do
        if !valid? && res.status == 200 && Json.is_valid?(res.body) do
          responses = Json.parse(res.body)

          tx_receipt = get_response(responses, 1)
          call_status = get_response(responses, 2)
          call_enough_funds = get_response(responses, 3)
          call_hash = get_response(responses, 4)
          call_end_time = get_response(responses, 5)
          call_amount = get_response(responses, 6)
          call_recipient = get_response(responses, 7)

          if !any_nil?([tx_receipt, call_status, call_enough_funds, call_hash, call_end_time, call_amount, call_recipient]) do
            # event = Crypto.hash("ContractProvisioned(address,uint256)", "keccak256")
            event = "0x0c5d1829e93110ff9c24aa8ac41893b65509108384b3036d4f73ffccb235e9ec"

            secret = Crypto.hmac(htlc_map.hmac_address)
            secret_hash = Crypto.hash(secret, "sha256")

            htlc_data = Contract.call_function(htlc_genesis_address, "get_htlc_data", [])

            valid_tx_receipt? = valid_tx_receipt?(tx_receipt, chain_data.proxy_address, evm_contract, event)
            # Pending is status 0
            valid_status? = valid_status?(call_status, 0)
            enough_funds? = enough_funds?(call_enough_funds)
            valid_hash? = valid_hash?(call_hash, secret_hash)
            valid_end_time? = valid_end_time?(call_end_time, htlc_map.end_time)
            valid_amount? = valid_amount?(call_amount, htlc_data.amount, chain_data.decimals)
            valid_recipient? = valid_recipient?(call_recipient, Map.get(htlc_map, "evm_user_address"))

            valid? = valid_tx_receipt? && valid_status? && enough_funds? && valid_hash? && valid_end_time? && valid_amount? && valid_recipient?
          end
        end
      end
    end

    valid?
  )
]

actions triggered_by: transaction, on: reveal_secret(htlc_genesis_address, _evm_tx_address, evm_contract_address) do
  requested_secrets = State.get("requested_secrets", Map.new())

  htlc_genesis_address = String.to_hex(htlc_genesis_address)
  htlc_map = Map.get(requested_secrets, htlc_genesis_address)

  requested_secrets = Map.delete(requested_secrets, htlc_genesis_address)
  State.set("requested_secrets", requested_secrets)

  secret = Crypto.hmac(htlc_map.hmac_address)
  signature = sign_for_evm(secret)

  Contract.add_recipient(
    address: htlc_genesis_address,
    action: "reveal_secret",
    args: [secret, signature, evm_contract_address]
  )
end

condition triggered_by: transaction, on: refund(htlc_genesis_address), as: [
  content: (
    # Ensure htlc_genesis_address exists in pool state
    # and end_time has not been reached
    valid? = false

    htlc_genesis_address = String.to_hex(htlc_genesis_address)
    requested_secrets = State.get("requested_secrets", Map.new())
    htlc_map = Map.get(requested_secrets, htlc_genesis_address)

    if htlc_map != nil do
      valid? = htlc_map.end_time <= Time.now()
    end

    valid?
  )
]

actions triggered_by: transaction, on: refund(htlc_genesis_address) do
  htlc_genesis_address = String.to_hex(htlc_genesis_address)
  requested_secrets = State.get("requested_secrets", Map.new())
  htlc_map = Map.get(requested_secrets, htlc_genesis_address)

  secret = Crypto.hmac(htlc_map.hmac_address)
  # Perform a first hash to combine data and "refund"
  sig_payload = "#{secret}#{String.to_hex("refund")}"
  signature_data = Crypto.hash(sig_payload, "keccak256")

  signature = sign_for_evm(signature_data)

  requested_secrets = Map.delete(requested_secrets, htlc_genesis_address)
  State.set("requested_secrets", requested_secrets)

  Contract.add_recipient(
    address: htlc_genesis_address,
    action: "refund",
    args: [secret, signature]
  )
end

condition triggered_by: transaction, on: update_code(new_code), as: [
  previous_public_key:
    (
      # Pool code can only be updated from the master chain if the bridge

      # Transaction is not yet validated so we need to use previous address
      # to get the genesis address
      previous_address = Chain.get_previous_address()
      Chain.get_genesis_address(previous_address) == @MASTER_GENESIS_ADDRESS
    ),
  code: Code.is_valid?(new_code)
]

actions triggered_by: transaction, on: update_code(new_code) do
  Contract.set_type("contract")
  Contract.set_code(new_code)
end

####################
# Public functions #
####################

export fun get_token_address() do
  @TOKEN_ADDRESS
end

#####################
# Private functions #
#####################

fun contract_already_charged?(charged_contracts, chain_id, evm_contract) do
  chain_id = String.from_number(chain_id)
  evm_contract = String.to_lowercase(evm_contract)
  contracts = Map.get(charged_contracts, chain_id, Map.new())

  Map.get(contracts, evm_contract, nil) != nil
end

fun add_charged_contracts(charged_contracts, chain_id, evm_contract, end_time) do
  chain_id = String.from_number(chain_id)
  evm_contract = String.to_lowercase(evm_contract)

  contracts = Map.get(charged_contracts, chain_id, Map.new())
  updated_contracts = Map.set(contracts, evm_contract, end_time)

  Map.set(charged_contracts, chain_id, updated_contracts)
end

fun delete_old_charged_contracts(charged_contracts) do
  now = Time.now()
  for chain_id in Map.keys(charged_contracts) do
    contracts = Map.get(charged_contracts, chain_id)

    for address in Map.keys(contracts) do
      contract_end_time = Map.get(contracts, address)
      if contract_end_time <= now do
        contracts = Map.delete(contracts, address)
      end
    end

    charged_contracts = Map.set(charged_contracts, chain_id, contracts)
  end

  charged_contracts
end

fun valid_chargeable_code?(end_time, amount, user_address, secret_hash) do
  args = [
    end_time,
    user_address,
    @POOL_ADDRESS,
    secret_hash,
    @TOKEN_ADDRESS,
    amount
  ]

  expected_code = Contract.call_function(@FACTORY_ADDRESS, "get_chargeable_htlc", args)

  Code.is_same?(expected_code, transaction.code)
end

fun valid_signed_code?(htlc_address, amount, user_address) do
  valid? = false

  htlc_address = String.to_hex(htlc_address)
  last_htlc_transaction = Chain.get_last_transaction(htlc_address)

  if last_htlc_transaction != nil do
    args = [
      user_address,
      @POOL_ADDRESS,
      @TOKEN_ADDRESS,
      amount
    ]

    expected_code = Contract.call_function(@FACTORY_ADDRESS, "get_signed_htlc", args)

    valid? = Code.is_same?(expected_code, last_htlc_transaction.code)
  end

  valid?
end

fun get_chain_data(chain_id) do
  data = Map.new()
  @EVM_DATA_CONDITIONS
  data
end

fun get_call_request(evm_contract, call, id) do
  abi_data = Evm.abi_encode(call)
  tx = [to: evm_contract, data: "0x#{abi_data}"]
  [jsonrpc: "2.0", id: id, method: "eth_call", params: [tx, "latest"]]
end

fun get_response(responses, id) do
  response = nil
  for res in responses do
    if res.id == id do
      response = Map.get(res, "result")
    end
  end
  response
end

fun any_nil?(list) do
  nil? = false
  for i in list do
    if i == nil do
      nil? = true
    end
  end
  nil?
end

fun get_tx_receipt_request(evm_tx_address) do
  [
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getTransactionReceipt",
    params: [evm_tx_address]
  ]
end

fun valid_tx_receipt?(tx_receipt, proxy_address, evm_contract, expected_event) do
  logs = nil
  for log in tx_receipt.logs do
    if String.to_lowercase(log.address) == proxy_address do
      logs = log
    end
  end

  if logs != nil do
    # Transaction is valid
    valid_status? = tx_receipt.status == "0x1"
    # Transaction interacted with proxy address
    valid_proxy_address? = String.to_lowercase(tx_receipt.to) == proxy_address
    # Logs are comming from proxy address
    valid_logs_address? = String.to_lowercase(logs.address) == proxy_address
    # Pool contract emmited expected event
    event = List.at(logs.topics, 0)
    valid_event? = String.to_lowercase(event) == expected_event
    # Contract minted match evm_contract in parameters
    decoded_data = Evm.abi_decode("(address)", List.at(logs.topics, 1))
    topic_address = List.at(decoded_data, 0)
    valid_contract_address? = topic_address == String.to_lowercase(evm_contract)

    valid_status? && valid_proxy_address? && valid_logs_address? && valid_event? && valid_contract_address?
  else
    false
  end
end

fun valid_status?(call_status, expected_status) do
  decoded_data = Evm.abi_decode("(uint)", call_status)
  List.at(decoded_data, 0) == expected_status
end

fun enough_funds?(call_enough_funds) do
  decoded_data = Evm.abi_decode("(bool)", call_enough_funds)
  List.at(decoded_data, 0) == true
end

fun valid_hash?(call_hash, secret_hash) do
  secret_hash = "0x#{String.to_lowercase(secret_hash)}"
  decoded_data = Evm.abi_decode("(bytes32)", call_hash)
  List.at(decoded_data, 0) == secret_hash
end

fun valid_end_time?(call_end_time, end_time) do
  decoded_data = Evm.abi_decode("(uint256)", call_end_time)
  List.at(decoded_data, 0) == end_time
end

fun valid_amount?(call_amount, amount, decimals) do
  decoded_data = Evm.abi_decode("(uint256)", call_amount)
  big_int_amount = List.at(decoded_data, 0)
  decimal_amount = big_int_amount / Math.pow(10, decimals)
  decimal_amount == amount
end

fun valid_recipient?(call_recipient, evm_user_address) do
  decoded_data = Evm.abi_decode("(address)", call_recipient)
  String.to_uppercase(List.at(decoded_data, 0)) == String.to_uppercase(evm_user_address)
end

fun sign_for_evm(data) do
  prefix = String.to_hex("\x19Ethereum Signed Message:\n32")
  signature_payload = Crypto.hash("#{prefix}#{data}", "keccak256")

  sig = Crypto.sign_with_recovery(signature_payload)

  if sig.v == 0 do
    sig = Map.set(sig, "v", 27)
  else
    sig = Map.set(sig, "v", 28)
  end

  sig
end

fun query_evm_apis(endpoints, method, headers, body) do
  requests = []

  for endpoint in endpoints do
    requests = List.append(requests, url: endpoint, method: method, headers: headers, body: body)
  end

  Http.request_many(requests, false)
end
