defmodule TodoListerWeb.PageController do
  use TodoListerWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
