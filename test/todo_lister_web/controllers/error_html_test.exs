defmodule TodoListerWeb.ErrorHTMLTest do
  use TodoListerWeb.ConnCase, async: true

  # Bring render_to_string/4 for testing custom views
  import Phoenix.Template, only: [render_to_string: 4]

  test "renders 404.html" do
    html = render_to_string(TodoListerWeb.ErrorHTML, "404", "html", [])
    assert html =~ "Task Not Found!"
    assert html =~ "Whoops! This task escaped our list!"
    assert html =~ "Back to Home"
  end

  test "renders 500.html" do
    assert render_to_string(TodoListerWeb.ErrorHTML, "500", "html", []) == "Internal Server Error"
  end
end
