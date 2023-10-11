@version 1

condition triggered_by: transaction, on: update_state(_state), as: [
  previous_public_key:
    (
      # Transaction is not yet validated so we need to use previous address
      # to get the genesis address
      previous_address = Chain.get_previous_address()
      Chain.get_genesis_address(previous_address) == @POOL_ADDRESS
    )
]

actions triggered_by: transaction, on: update_state(state) do
  Contract.set_content(Json.to_string(state))
end

export fun(get_state()) do
  Json.parse(contract.content)
end
