defmodule TodoListerWeb.LandingIntegrationTest do
  use TodoListerWeb.ConnCase

  import Phoenix.LiveViewTest

  describe "Landing page integration" do
    test "clicking 'Create New List' creates a todo list in database", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/")

      # Count lists before
      initial_count = length(TodoLister.Lists.list_todo_lists())

      # Click the create button
      view |> element("button", "Create New List") |> render_click()

      # Verify a new list was created
      final_count = length(TodoLister.Lists.list_todo_lists())
      assert final_count == initial_count + 1

      # Verify the new list has the default title
      [newest_list | _] = TodoLister.Lists.list_todo_lists()
      assert newest_list.title == "New Todo List"
    end

    test "created list can be accessed via direct URL", %{conn: conn} do
      {:ok, view, _html} = live(conn, ~p"/")

      # Click create to make a new list
      view |> element("button", "Create New List") |> render_click()

      # Get the newest list
      [newest_list | _] = TodoLister.Lists.list_todo_lists()

      # Navigate directly to the list page
      {:ok, _list_view, html} = live(conn, ~p"/tl/#{newest_list.id}")

      # Verify we can see the list
      assert html =~ "New Todo List"
      assert html =~ "Created:"
      assert html =~ "Last updated:"
      assert html =~ "TodoLister"
    end
  end
end
