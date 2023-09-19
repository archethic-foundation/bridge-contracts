@version 1

condition triggered_by: transaction, on: update_state(_state), as: []

actions triggered_by: transaction, on: update_state(state) do
  Contract.set_content Json.to_string(state)
end

export fun get_state() do
  Json.parse(contract.content)
end
