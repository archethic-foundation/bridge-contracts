@version 1

# condition inherit: [
#   # Add condition inherit to allow upgrade of this contract
# ]

export fun(get_protocol_fee()) do
  0
end

export fun(get_protocol_fee_address()) do
  @PROTOCOL_FEE_ADDRESS
end

export fun(get_token_resupply_definition(token_address, amount, htlc_address)) do
  token_address = String.to_hex(token_address)
  htlc_address = String.to_hex(htlc_address)

  big_int_amount = Math.trunc(amount * 100_000_000)

  Json.to_string(
    aeip: [8, 18, 19],
    supply: big_int_amount,
    token_reference: token_address,
    recipients: [
      [to: htlc_address, amount: big_int_amount]
    ]
  )
end

###############################
# External chain => Archethic #
###############################

export fun(get_chargeable_htlc(end_time, user_address, pool_address, secret_hash, token, amount)) do
  # Here we should ensure end_time is valid compared to Time.now() and return error

  user_address = String.to_hex(user_address)
  pool_address = String.to_hex(pool_address)
  secret_hash = String.to_hex(secret_hash)
  token = String.to_uppercase(token)

  return_transfer_code = ""

  if token == "UCO" do
    # We don't burn UCO, we return them in pool contract
    return_transfer_code = """
    # Send back UCO to bridge pool
      Contract.add_uco_transfer to: 0x#{pool_address}, amount: #{amount}
    """
  else
    burn_address = Chain.get_burn_address()

    return_transfer_code = """
    # Burn the non withdrawed tokens
      Contract.add_token_transfer to: 0x#{burn_address}, amount: #{amount}, token_address: 0x#{token}
    """
  end

  valid_transfer_code = ""

  if token == "UCO" do
    valid_transfer_code = """
    Contract.add_uco_transfer to: 0x#{user_address}, amount: #{amount}
    """
  else
    valid_transfer_code = """
    Contract.add_token_transfer to: 0x#{user_address}, amount: #{amount}, token_address: 0x#{token}
    """
  end

  """
  @version 1

  condition triggered_by: transaction, on: provision(_evm_contract, _endpoints, _signature, _evm_pool), as: [
  previous_public_key: (
     # Transaction is not yet validated so we need to use previous address
    # to get the genesis address
    previous_address = Chain.get_previous_address()
    Chain.get_genesis_address(previous_address) == 0x#{pool_address}
   )
  ]

  actions triggered_by: transaction, on: provision(evm_contract, endpoints, signature, evm_pool) do
    endpoints = Json.to_string(endpoints)
    Contract.set_code \"""
    @version 1

    condition triggered_by: transaction, on: refund(), as: [
      content: (
        valid? = false

        abi_data = Evm.abi_encode("status()")
        tx = [to: "\#{evm_contract}", data: "0x\\\#{abi_data}"]
        request = [jsonrpc: "2.0", id: "1", method: "eth_call", params: [tx, "latest"]]

        headers = ["Content-Type": "application/json"]
        body = Json.to_string(request)

        evm_responses = query_evm_apis(\#{endpoints}, "POST", headers, body)
        for res in evm_responses do
          if !valid? && res.status == 200 && Json.is_valid?(res.body) do
            response = Json.parse(res.body)
            result = Map.get(response, "result")
            if result != nil do
              decoded_abi = Evm.abi_decode("(uint)", result)
              # Refund status is 2
              valid? = List.at(decoded_abi, 0) == 2
            end
          end
        end

        valid?
      )
    ]

    actions triggered_by: transaction, on: refund() do
      Contract.set_type "transfer"
      #{return_transfer_code}

      Contract.set_code \\\"""
      @version 1

      export fun info() do
        [
          evm_contract: \#{evm_contract},
          evm_pool: \#{evm_pool},
          ae_pool: 0x#{pool_address},
          status: 2 # REFUNDED
        ]
      end
      \\\"""
    end

    condition triggered_by: transaction, on: reveal_secret(secret), as: [
      content: Crypto.hash(String.to_hex(secret)) == 0x#{secret_hash},
      address: (
        valid? = false

        abi_data = Evm.abi_encode("status()")
        tx = [to: "\#{evm_contract}", data: "0x\\\#{abi_data}"]
        request = [jsonrpc: "2.0", id: "1", method: "eth_call", params: [tx, "latest"]]

        headers = ["Content-Type": "application/json"]
        body = Json.to_string(request)

        responses = query_evm_apis(\#{endpoints}, "POST", headers, body)
        for res in responses do
          if !valid? && res.status == 200 && Json.is_valid?(res.body) do
            response = Json.parse(res.body)
            result = Map.get(response, "result")

            if result != nil do
              decoded_abi = Evm.abi_decode("(uint)", result)
              # Withdrawn status is 1
              valid? = List.at(decoded_abi, 0) == 1
            end
          end
        end

        valid?
      )
    ]

    actions triggered_by: transaction, on: reveal_secret(secret) do
      Contract.set_type "transfer"
      #{valid_transfer_code}

      Contract.set_code \\\"""
      @version 1

      export fun info() do
        [
          evm_contract: \#{evm_contract},
          evm_pool: \#{evm_pool},
          ae_pool: 0x#{pool_address},
          status: 1 # WITHDRAWN
        ]
      end
      \\\"""
    end

    fun query_evm_apis(endpoints, method, headers, body) do
      requests = []
      for endpoint in endpoints do
        requests = List.append(requests, url: endpoint, method: method, headers: headers, body: body)
      end
      Http.request_many(requests, false)
    end

    export fun get_provision_signature() do
      [
        r: 0x\#{signature.r},
        s: 0x\#{signature.s},
        v: \#{signature.v}
      ]
    end

    export fun info() do
      [
        evm_contract: \#{evm_contract},
        evm_pool: \#{evm_pool},
        ae_pool: 0x#{pool_address},
        status: 0 # PENDING
      ]
    end

    \"""
  end

  export fun info() do
    [
      ae_pool: 0x#{pool_address},
      status: 0 # PENDING
    ]
  end
  """
end

###############################
# Archethic => External chain #
###############################

export fun(get_signed_htlc(user_address, pool_address, token, amount)) do
  # Here we should ensure end_time is valid compared to Time.now() and return error

  user_address = String.to_hex(user_address)
  pool_address = String.to_hex(pool_address)
  token = String.to_uppercase(token)

  return_transfer_code = ""

  if token == "UCO" do
    return_transfer_code = "Contract.add_uco_transfer to: 0x#{user_address}, amount: #{amount}"
  else
    return_transfer_code =
      "Contract.add_token_transfer to: 0x#{user_address}, amount: #{amount}, token_address: 0x#{token}"
  end

  fee_amount = 0
  user_amount = amount - fee_amount

  fee_transfer_code = ""

  if fee_amount == 0 do
    fee_transfer_code = "# Transfer fee is less than the minimum decimals"
  else
    if token == "UCO" do
      fee_transfer_code =
        "Contract.add_uco_transfer to: @PROTOCOL_FEE_ADDRESS, amount: #{fee_amount}"
    else
      fee_transfer_code =
        "Contract.add_token_transfer to: @PROTOCOL_FEE_ADDRESS, amount: #{fee_amount}, token_address: 0x#{token}"
    end
  end

  valid_transfer_code = ""

  if token == "UCO" do
    # We don't burn UCO, we return them in pool contract
    valid_transfer_code = """
        Contract.add_uco_transfer to: 0x#{pool_address}, amount: #{user_amount}
        #{fee_transfer_code}
    """
  else
    burn_address = Chain.get_burn_address()

    valid_transfer_code = """
        Contract.add_token_transfer to: 0x#{burn_address}, amount: #{user_amount}, token_address: 0x#{token}
        #{fee_transfer_code}
    """
  end

  """
  @version 1

  condition triggered_by: transaction, on: set_secret_hash(_secret_hash, _secret_hash_signature, _end_time, _evm_pool), as: [
    previous_public_key: (
      # Transaction is not yet validated so we need to use previous address
      # to get the genesis address
      previous_address = Chain.get_previous_address()
      Chain.get_genesis_address(previous_address) == 0x#{pool_address}
    )
  ]

  actions triggered_by: transaction, on: set_secret_hash(secret_hash, secret_hash_signature, end_time, evm_pool) do
    Contract.set_code \"""
    @version 1

    condition triggered_by: transaction, on: refund(secret, secret_signature), as: [
      previous_public_key: (
        previous_address = Chain.get_previous_address()
        Chain.get_genesis_address(previous_address) == 0x#{pool_address}
      ),
      timestamp: timestamp >= \#{end_time}
    ]

    actions triggered_by: transaction, on: refund(secret, secret_signature) do
      Contract.set_type "transfer"
      # Send back the token to the user address
      #{return_transfer_code}

      Contract.set_code \\\"""
      @version 1

      export fun info() do
        [
          evm_pool: \#{evm_pool},
          ae_pool: 0x#{pool_address},
          status: 2 # REFUNDED
        ]
      end

      export fun get_secret() do
        [
          secret: 0x\\\#{secret},
          secret_signature: [
            r: 0x\\\#{secret_signature.r},
            s: 0x\\\#{secret_signature.s},
            v: \\\#{secret_signature.v}
          ]
        ]
      end
      \\\"""
    end

    condition triggered_by: transaction, on: reveal_secret(secret, secret_signature, _evm_contract), as: [
      previous_public_key: (
        # Transaction is not yet validated so we need to use previous address
        # to get the genesis address
        previous_address = Chain.get_previous_address()
        Chain.get_genesis_address(previous_address) == 0x#{pool_address}
      ),
      timestamp: transaction.timestamp < \#{end_time},
      content: Crypto.hash(String.to_hex(secret)) == 0x\#{secret_hash}
    ]

    actions triggered_by: transaction, on: reveal_secret(secret, secret_signature, evm_contract) do
      Contract.set_type "transfer"
      #{valid_transfer_code}

      Contract.set_code \\\"""
      @version 1

      export fun info() do
        [
          evm_contract: \\\#{evm_contract},
          evm_pool: \#{evm_pool},
          ae_pool: 0x#{pool_address},
          status: 1 # WITHDRAWN
        ]
      end

      export fun get_secret() do
        [
          secret: 0x\\\#{secret},
          secret_signature: [
            r: 0x\\\#{secret_signature.r},
            s: 0x\\\#{secret_signature.s},
            v: \\\#{secret_signature.v}
          ]
        ]
      end
      \\\"""
    end

    export fun info() do
      [
        evm_pool: \#{evm_pool},
        ae_pool: 0x#{pool_address},
        status: 0 # PENDING
      ]
    end

    export fun get_htlc_data() do
      [
        amount: #{user_amount},
        end_time: \#{end_time},
        secret_hash: 0x\#{secret_hash},
        secret_hash_signature: [
          r: 0x\#{secret_hash_signature.r},
          s: 0x\#{secret_hash_signature.s},
          v: \#{secret_hash_signature.v}
        ]
      ]
    end
    \"""
  end

  export fun info() do
    [
      ae_pool: 0x#{pool_address},
      status: 0 # PENDING
    ]
  end
  """
end
