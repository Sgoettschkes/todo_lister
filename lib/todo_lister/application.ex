defmodule TodoLister.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      TodoListerWeb.Telemetry,
      TodoLister.Repo,
      {DNSCluster, query: Application.get_env(:todo_lister, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: TodoLister.PubSub},
      # Start a worker by calling: TodoLister.Worker.start_link(arg)
      # {TodoLister.Worker, arg},
      # Start to serve requests, typically the last entry
      TodoListerWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: TodoLister.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    TodoListerWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
