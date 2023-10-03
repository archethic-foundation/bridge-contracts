@version 1

####################################
# EVM => Archethic : Request funds #
####################################

condition triggered_by: transaction, on: request_funds(end_time, amount, user_address, secret_hash), as: [
  type: "contract",
  code: valid_chargeable_code?(end_time, amount, user_address, secret_hash),
  timestamp: end_time > Time.now(),
  content: (
    # Ensure the pool has enough UCO to send the requested fund
    balance = Chain.get_uco_balance(contract.address)
    balance >= amount
  ),
  address: (
    # Here ensure Ethereum contract exists and check rules
    # How to ensure Ethereum contract is a valid one ?
    # Maybe get the ABI of HTLC on github and compare it to the one on Ethereum
    # Then control rules
    true
  )
]

actions triggered_by: transaction, on: request_funds(_end_time, amount, _user_address, _secret_hash) do
  Contract.set_type "transfer"
  Contract.add_uco_transfer to: transaction.address, amount: amount
end

##########################################
# Archethic => EVM : Request secret hash #
##########################################

condition triggered_by: transaction, on: request_secret_hash(end_time, amount, user_address, chain_id), as: [
  type: "contract",
  code: valid_signed_code?(end_time, amount, user_address),
  timestamp: end_time > Time.now(),
  previous_public_key: (
    # Ensure contract has enough fund to withdraw
    previous_address = Chain.get_previous_address()
    balance = Chain.get_uco_balance(previous_address)
    balance >= amount
  ),
  content: List.in?([#CHAIN_IDS#], chain_id)
]

actions triggered_by: transaction, on: request_secret_hash(end_time, _amount, _user_address, chain_id) do
  # Here delete old secret that hasn't been used before endTime
  contract_content = Map.new()
  if Json.is_valid?(contract.content) do
    contract_content = Json.parse(contract.content)
  end

  for key in Map.keys(contract_content) do
    htlc_map = Map.get(contract_content, key)
    if htlc_map.end_time > Time.now() do
      contract_content = Map.delete(contract_content, key)
    end
  end

  secret = Crypto.hmac(transaction.address)
  secret_hash = Crypto.hash(secret, "sha256")

  # Build signature for EVM decryption
  signature = sign_for_evm(secret_hash, chain_id)

  # Add secret and signature in content
  htlc_map = [
    hmac_address: transaction.address,
    end_time: end_time,
    chain_id: chain_id
  ]

  htlc_genesis_address = Chain.get_genesis_address(transaction.address)

  contract_content = Map.set(contract_content, htlc_genesis_address, htlc_map)

  Contract.set_content Json.to_string(contract_content)
  Contract.add_recipient address: transaction.address, action: "set_secret_hash", args: [secret_hash, signature]
end

####################################
# Archethic => EVM : Reveal secret #
####################################

condition triggered_by: transaction, on: reveal_secret(htlc_genesis_address), as: [
  type: "transfer",
  content: (
    # Ensure htlc_genesis_address exists in pool state
    # and end_time has not been reached
    valid? = false

    if Json.is_valid?(contract.content) do
      htlc_genesis_address = String.to_hex(htlc_genesis_address)
      htlc_map = Map.get(Json.parse(contract.content), htlc_genesis_address)

      if htlc_map != nil do
        valid? = htlc_map.end_time > Time.now()
      end
    end

    valid?
  ),
  address: (
    # Here ensure Ethereum contract exists and check rules
    # How to ensure Ethereum contract is a valid one ?
    # Maybe get the ABI of HTLC on github and compare it to the one on Ethereum
    # Then control rules
    true
  )
]

actions triggered_by: transaction, on: reveal_secret(htlc_genesis_address) do
  contract_content = Json.parse(contract.content)

  htlc_genesis_address = String.to_hex(htlc_genesis_address)
  htlc_map = Map.get(contract_content, htlc_genesis_address)

  contract_content = Map.delete(contract_content, htlc_genesis_address)

  secret = Crypto.hmac(htlc_map.hmac_address)
  signature = sign_for_evm(secret, htlc_map.chain_id)

  Contract.set_content Json.to_string(contract_content)
  Contract.add_recipient address: htlc_genesis_address, action: "reveal_secret", args: [secret, signature]
end

####################
# Public functions #
####################

export fun get_token_address() do
  "UCO"
end

#####################
# Private functions #
#####################

fun valid_chargeable_code?(end_time, amount, user_address, secret_hash) do
  args = [
    end_time,
    user_address,
    #POOL_ADDRESS#,
    secret_hash,
    "UCO",
    amount
  ]

  expected_code = Contract.call_function(#FACTORY_ADDRESS#, "get_chargeable_htlc", args)

  Code.is_same?(expected_code, transaction.code)
end

fun valid_signed_code?(end_time, amount, user_address) do
  args = [
    end_time,
    user_address,
    #POOL_ADDRESS#,
    "UCO",
    amount
  ]

  expected_code = Contract.call_function(#FACTORY_ADDRESS#, "get_signed_htlc", args)

  Code.is_same?(expected_code, transaction.code)
end

fun sign_for_evm(data, chain_id) do
  # Perform a first hash to combine data and chain_id
  hash_abi = Evm.abi_encode("(bytes32,uint)", [data, chain_id])
  combined_hash = Crypto.hash(hash_abi, "keccak256")

  prefix = String.to_hex("\x19Ethereum Signed Message:\n32")
  signature_payload = Crypto.hash("#{prefix}#{combined_hash}", "keccak256")

  sig = Crypto.sign_with_recovery(signature_payload)

  if sig.v == 0 do
    sig = Map.set(sig, "v", 27)
  else
    sig = Map.set(sig, "v", 28)
  end

  sig
end
