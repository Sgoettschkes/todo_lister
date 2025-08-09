defmodule TodoListerWeb.TodoListLiveTest do
  use TodoListerWeb.ConnCase

  import Phoenix.LiveViewTest
  import TodoLister.ListsFixtures

  setup %{conn: conn} do
    todo_list = todo_list_fixture()
    %{conn: conn, todo_list: todo_list}
  end

  describe "Show todo list" do
    test "displays todo list when it exists", %{conn: conn, todo_list: todo_list} do
      {:ok, _view, html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      assert html =~ todo_list.title
      assert html =~ "Created:"
      assert html =~ "Last updated:"
    end

    test "redirects to home when todo list doesn't exist", %{conn: conn} do
      non_existent_id = Ecto.UUID.generate()
      
      assert {:error, {:live_redirect, %{to: "/", flash: %{"error" => "Todo list not found"}}}} = 
        live(conn, ~p"/tl/#{non_existent_id}")
    end

    test "displays back to home link", %{conn: conn, todo_list: todo_list} do
      {:ok, _view, html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      assert html =~ "Back to Home"
    end

    test "displays placeholder for todo items", %{conn: conn, todo_list: todo_list} do
      {:ok, _view, html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      assert html =~ "No todo items yet"
      assert html =~ "Click the + button to add your first task!"
    end
  end

  describe "Share functionality" do
    test "displays share button", %{conn: conn, todo_list: todo_list} do
      {:ok, _view, html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      assert html =~ "Share"
      assert html =~ "share-button"
    end

    test "clicking share button shows success message", %{conn: conn, todo_list: todo_list} do
      {:ok, view, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      html = view |> element("button", "Share") |> render_click()
      
      assert html =~ "Link copied! Share this URL with others to collaborate."
    end

    test "share button has correct URL in data attribute", %{conn: conn, todo_list: todo_list} do
      {:ok, _view, html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      expected_url = TodoListerWeb.Endpoint.url() <> "/tl/#{todo_list.id}"
      assert html =~ "data-url=\"#{expected_url}\""
    end
  end

  describe "Title editing" do
    test "can click to edit title", %{conn: conn, todo_list: todo_list} do
      {:ok, view, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      html = view |> element("h1") |> render_click()
      
      assert html =~ "input"
      assert html =~ todo_list.title
    end

    test "can save title changes", %{conn: conn, todo_list: todo_list} do
      {:ok, view, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      # Enter edit mode
      view |> element("h1") |> render_click()
      
      # Submit new title using the specific form
      html = view |> element("form[phx-submit='save_title']") |> render_submit(%{title: "Updated Title"})
      
      assert html =~ "Updated Title"
      
      # Verify the title was actually updated in the database
      updated_list = TodoLister.Lists.get_todo_list!(todo_list.id)
      assert updated_list.title == "Updated Title"
    end

    test "can cancel editing with escape key", %{conn: conn, todo_list: todo_list} do
      {:ok, view, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      # Enter edit mode
      view |> element("h1") |> render_click()
      
      # Press escape to cancel
      view |> render_hook("key_down", %{"key" => "Escape"})
      
      html = render(view)
      # Check that we're no longer in edit mode for the title (but the add task input is still there)
      refute html =~ "title-input"
      assert html =~ todo_list.title
    end

    test "handles blur event to save title", %{conn: conn, todo_list: todo_list} do
      {:ok, view, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      # Enter edit mode
      view |> element("h1") |> render_click()
      
      # Trigger blur event on the title input specifically
      html = view |> element("#title-input") |> render_blur(%{value: "Blur Updated Title"})
      
      assert html =~ "Blur Updated Title"
    end
  end

  describe "Todo items functionality" do
    test "can add new todo item with add button", %{conn: conn, todo_list: todo_list} do
      {:ok, view, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      # Click the add button
      html = view |> element("button[phx-click='add_item']") |> render_click()
      
      # Should create new item with placeholder text and enter edit mode
      assert html =~ "New task"
    end

    test "displays add task button", %{conn: conn, todo_list: todo_list} do
      {:ok, _view, html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      assert html =~ "Add new task"
      # Check for plus icon SVG
      assert html =~ "M12 4v16m8-8H4"
    end

    test "shows empty state when no items", %{conn: conn, todo_list: todo_list} do
      {:ok, _view, html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      assert html =~ "No todo items yet"
      assert html =~ "Click the + button to add your first task!"
    end
  end
end