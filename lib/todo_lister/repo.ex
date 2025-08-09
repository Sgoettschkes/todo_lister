defmodule TodoLister.Repo do
  use Ecto.Repo,
    otp_app: :todo_lister,
    adapter: Ecto.Adapters.Postgres
end
