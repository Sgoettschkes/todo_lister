defmodule TodoListerWeb.ErrorJSONTest do
  use TodoListerWeb.ConnCase, async: true

  test "renders 404" do
    assert TodoListerWeb.ErrorJSON.render("404.json", %{}) == %{errors: %{detail: "Not Found"}}
  end

  test "renders 500" do
    assert TodoListerWeb.ErrorJSON.render("500.json", %{}) ==
             %{errors: %{detail: "Internal Server Error"}}
  end
end
