defmodule TodoListerWeb.LandingLiveTest do
  use TodoListerWeb.ConnCase

  import Phoenix.LiveViewTest

  test "disconnected and connected render", %{conn: conn} do
    {:ok, page_live, disconnected_html} = live(conn, ~p"/")
    assert disconnected_html =~ "TodoLister"
    assert render(page_live) =~ "TodoLister"
  end
end
