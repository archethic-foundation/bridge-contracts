@version 1

# condition inherit: [
#   # Add condition inherit to allow upgrade of this contract
# ]

export fun get_protocol_fee() do
  0.3
end

export fun get_protocol_fee_address() do
  #PROTOCOL_FEE_ADDRESS#
end

export fun get_token_resupply_definition(token_address, amount, htlc_address) do
  token_address = String.to_hex(token_address)
  htlc_address = String.to_hex(htlc_address)

  big_int_amount = Math.trunc(amount * 100_000_000)

  Json.to_string(
    [
      aeip: [8, 18, 19],
      supply: big_int_amount,
      token_reference: token_address,
      recipients: [
        [to: htlc_address, amount: big_int_amount]
      ]
    ]
  )
end

###############################
# External chain => Archethic #
###############################

export fun get_chargeable_htlc(end_time, user_address, pool_address, secret_hash, token, amount) do
  # Here we should ensure end_time is valid compared to Time.now() and return error

  user_address = String.to_hex(user_address)
  pool_address = String.to_hex(pool_address)
  secret_hash = String.to_hex(secret_hash)
  token = String.to_uppercase(token)

  return_transfer_code = ""
  if token == "UCO" do
    # We don't burn UCO, we return them in pool contract
    return_transfer_code = "Contract.add_uco_transfer to: 0x#{pool_address}, amount: #{amount}"
  else
    burn_address = Chain.get_burn_address()
    return_transfer_code = "Contract.add_token_transfer to: 0x#{burn_address}, amount: #{amount}, token_address: 0x#{token}"
  end

  fee_amount = amount * 0.003
  user_amount = amount - fee_amount

  fee_transfer_code = ""
  if token == "UCO" do
    fee_transfer_code = "Contract.add_uco_transfer to: #PROTOCOL_FEE_ADDRESS#, amount: #{fee_amount}"
  else
    fee_transfer_code = "Contract.add_token_transfer to: #PROTOCOL_FEE_ADDRESS#, amount: #{fee_amount}, token_address: 0x#{token}"
  end

  valid_transfer_code = ""
  if token == "UCO" do
    valid_transfer_code = """
    Contract.add_uco_transfer to: 0x#{user_address}, amount: #{user_amount}
      #{fee_transfer_code}
    """
  else
    valid_transfer_code = """
    Contract.add_token_transfer to: 0x#{user_address}, amount: #{user_amount}, token_address: 0x#{token}
      #{fee_transfer_code}
    """
  end

  """
  @version 1

  # Automate the refunding after the given timestamp
  actions triggered_by: datetime, at: #{end_time} do
    Contract.set_type "transfer"
    # Send back the token to the bridge pool
    #{return_transfer_code}
    Contract.set_code ""
  end

  condition triggered_by: transaction, on: reveal_secret(secret), as: [
    timestamp: transaction.timestamp < #{end_time},
    content: Crypto.hash(String.to_hex(secret)) == 0x#{secret_hash},
    address: (
      # Here ensure withdraw is done on ethereum
      true
    )
  ]

  actions triggered_by: transaction, on: reveal_secret(secret) do
    Contract.set_type "transfer"
    #{valid_transfer_code}
    Contract.set_code ""
  end
  """
end

###############################
# Archethic => External chain #
###############################

export fun get_signed_htlc(end_time, user_address, pool_address, token, amount) do
  # Here we should ensure end_time is valid compared to Time.now() and return error

  user_address = String.to_hex(user_address)
  pool_address = String.to_hex(pool_address)
  token = String.to_uppercase(token)

  return_transfer_code = ""
  if token == "UCO" do
    return_transfer_code = "Contract.add_uco_transfer to: 0x#{user_address}, amount: #{amount}"
  else
    return_transfer_code = "Contract.add_token_transfer to: 0x#{user_address}, amount: #{amount}, token_address: 0x#{token}"
  end

  fee_amount = amount * 0.003
  user_amount = amount - fee_amount

  fee_transfer_code = ""
  if token == "UCO" do
    fee_transfer_code = "Contract.add_uco_transfer to: #PROTOCOL_FEE_ADDRESS#, amount: #{fee_amount}"
  else
    fee_transfer_code = "Contract.add_token_transfer to: #PROTOCOL_FEE_ADDRESS#, amount: #{fee_amount}, token_address: 0x#{token}"
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

  date_time_trigger = """
  # Automate the refunding after the given timestamp
  actions triggered_by: datetime, at: #{end_time} do
    Contract.set_type "transfer"
    # Send back the token to the user address
    #{return_transfer_code}
    Contract.set_code ""
  end
  """

  code_after_withdraw = """
      @version 1

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
  """

  after_secret_code = """
    @version 1
    #{date_time_trigger}
    condition triggered_by: transaction, on: reveal_secret(secret, secret_signature), as: [
      previous_public_key: (
		    # Transaction is not yet validated so we need to use previous address
		    # to get the genesis address
		    previous_address = Chain.get_previous_address()
			  Chain.get_genesis_address(previous_address) == 0x#{pool_address}
		  ),
      timestamp: transaction.timestamp < #{end_time},
      content: Crypto.hash(String.to_hex(secret)) == 0x\#{secret_hash}
    ]

    actions triggered_by: transaction, on: reveal_secret(secret, secret_signature) do
      next_code = """
  #{code_after_withdraw}
      \\\"""

      Contract.set_type "transfer"
  #{valid_transfer_code}
      Contract.set_code next_code
    end

    export fun get_secret_hash() do
      [
        secret_hash: 0x\#{secret_hash},
        secret_hash_signature: [
          r: 0x\#{secret_hash_signature.r},
          s: 0x\#{secret_hash_signature.s},
          v: \#{secret_hash_signature.v}
        ]
      ]
    end
  """

  """
  @version 1
  #{date_time_trigger}
  condition triggered_by: transaction, on: set_secret_hash(secret_hash, secret_hash_signature), as: [
    previous_public_key: (
		  # Transaction is not yet validated so we need to use previous address
		  # to get the genesis address
		  previous_address = Chain.get_previous_address()
			Chain.get_genesis_address(previous_address) == 0x#{pool_address}
		)
  ]

  actions triggered_by: transaction, on: set_secret_hash(secret_hash, secret_hash_signature) do
    next_code = \"""
  #{after_secret_code}
    \"""

    Contract.set_code next_code
  end
  """
end

