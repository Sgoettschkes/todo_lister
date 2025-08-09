defmodule TodoListerWeb.PageController do
  use TodoListerWeb, :controller

  def show_404(conn, _params) do
    conn
    |> put_status(:not_found)
    |> put_view(html: TodoListerWeb.ErrorHTML)
    |> render(:"404")
  end

  def show_400(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> put_view(html: TodoListerWeb.ErrorHTML)
    |> render(:"400")
  end
end