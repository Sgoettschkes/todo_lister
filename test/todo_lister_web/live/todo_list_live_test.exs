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
      
      assert html =~ "share-button"
      assert html =~ "Share this list"
    end

    test "clicking share button shows success message", %{conn: conn, todo_list: todo_list} do
      {:ok, view, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      html = view |> element("#share-button") |> render_click()
      
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
      
      html = view |> element("div[phx-click='edit_title']") |> render_click()
      
      assert html =~ "input"
      assert html =~ todo_list.title
    end

    test "can save title changes", %{conn: conn, todo_list: todo_list} do
      {:ok, view, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      # Enter edit mode
      view |> element("div[phx-click='edit_title']") |> render_click()
      
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
      view |> element("div[phx-click='edit_title']") |> render_click()
      
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
      view |> element("div[phx-click='edit_title']") |> render_click()
      
      # Trigger blur event on the title input specifically
      html = view |> element("#title-input") |> render_blur(%{value: "Blur Updated Title"})
      
      assert html =~ "Blur Updated Title"
    end

    test "syncs title updates between multiple clients via PubSub", %{conn: conn, todo_list: todo_list} do
      # Start two LiveView clients for the same todo list
      {:ok, view1, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      {:ok, view2, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      # Update title in first client
      view1 |> element("div[phx-click='edit_title']") |> render_click()
      view1 |> element("form[phx-submit='save_title']") |> render_submit(%{title: "PubSub Updated Title"})
      
      # Verify both clients show the updated title
      assert render(view1) =~ "PubSub Updated Title"
      assert render(view2) =~ "PubSub Updated Title"
    end

    test "title editing behaves like item editing - seamless input", %{conn: conn, todo_list: todo_list} do
      {:ok, view, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      # Click to edit should show input with same styling
      html = view |> element("div[phx-click='edit_title']") |> render_click()
      
      # Should show input field that looks the same as the h1
      assert html =~ "input"
      assert html =~ "text-3xl font-bold"
      assert html =~ "bg-transparent border-0"
      assert html =~ todo_list.title
      
      # Should have FocusInput hook for cursor positioning
      assert html =~ "phx-hook=\"FocusInput\""
    end

    test "syncs todo item changes between multiple clients via PubSub", %{conn: conn, todo_list: todo_list} do
      # Start two LiveView clients for the same todo list
      {:ok, view1, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      {:ok, view2, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      # Add item in first client
      view1 |> element("button[phx-click='add_item']") |> render_click()
      view1 |> element("form[phx-submit='save_item']") |> render_submit(%{text: "Synced Item"})
      
      # Verify both clients show the new item
      assert render(view1) =~ "Synced Item"
      assert render(view2) =~ "Synced Item"
    end

    test "preserves editing state during external updates (optimistic locking)", %{conn: conn, todo_list: todo_list} do
      # Start two LiveView clients for the same todo list
      {:ok, view1, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      {:ok, view2, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      # Client 1: Add and start editing an item
      view1 |> element("button[phx-click='add_item']") |> render_click()
      view1 |> element("form[phx-submit='save_item']") |> render_submit(%{text: "Item being edited"})
      
      # Client 1: Start editing the item again
      view1 |> element("div[phx-click='edit_item']") |> render_click()
      
      # Client 2: Add a different item (triggers :updated message)
      view2 |> element("button[phx-click='add_item']") |> render_click()
      view2 |> element("form[phx-submit='save_item']") |> render_submit(%{text: "Different item"})
      
      # Client 1 should:
      # 1. Show the new item from Client 2
      # 2. Still be in edit mode for the original item
      # 3. Show a notification about the external change
      html1 = render(view1)
      assert html1 =~ "Different item"
      assert html1 =~ "Item being edited" 
      assert html1 =~ "List updated by another user"
      assert html1 =~ "input" # Still in edit mode
    end

    test "detects and warns about text conflicts during concurrent edits", %{conn: conn, todo_list: todo_list} do
      # Create an item first
      {:ok, _item} = TodoLister.Lists.create_todo_item(todo_list, %{text: "Original text"})
      
      # Start two LiveView clients
      {:ok, view1, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      {:ok, view2, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      
      # Client 1: Start editing the item
      view1 |> element("div[phx-click='edit_item']") |> render_click()
      
      # Client 2: Update the same item externally (simulating concurrent edit)
      view2 |> element("div[phx-click='edit_item']") |> render_click()
      view2 |> element("form[phx-submit='save_item']") |> render_submit(%{text: "Changed by client 2"})
      
      # Client 1 should show conflict warning and preserve their editing state
      html1 = render(view1)
      assert html1 =~ "Your current edit is preserved"
      assert html1 =~ "input" # Still in edit mode
      assert html1 =~ "Original text" # Preserves original version being edited
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

    test "can click on todo item text to edit", %{conn: conn, todo_list: todo_list} do
      # First add an item
      {:ok, view, _html} = live(conn, ~p"/tl/#{todo_list.id}")
      view |> element("button[phx-click='add_item']") |> render_click()
      
      # Save the item with some text
      view |> element("form[phx-submit='save_item']") |> render_submit(%{text: "Test item"})
      
      # Now click on the item row to edit it
      html = view |> element("div[phx-click='edit_item']") |> render_click()
      
      # Should show input field
      assert html =~ "input"
      assert html =~ "Test item"
    end
  end
end