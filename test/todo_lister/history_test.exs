defmodule TodoLister.HistoryTest do
  use TodoLister.DataCase

  alias TodoLister.{History, Lists, Repo}

  describe "create_history/3" do
    test "creates a history record with valid data" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})

      assert {:ok, history} =
               History.create_history("list_created", "client-123", %{
                 todo_list_id: todo_list.id,
                 new_data: %{title: "Test List"}
               })

      assert history.change_type == "list_created"
      assert history.client_id == "client-123"
      assert history.todo_list_id == todo_list.id
      assert history.new_data == %{title: "Test List"}
      assert history.inserted_at != nil
    end

    test "fails with invalid change_type" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})

      assert {:error, changeset} =
               History.create_history("invalid_type", "client-123", %{
                 todo_list_id: todo_list.id
               })

      assert %{change_type: ["is invalid"]} = errors_on(changeset)
    end

    test "fails without required fields" do
      assert {:error, changeset} = History.create_history("list_created", nil, %{})

      errors = errors_on(changeset)
      assert %{client_id: ["can't be blank"]} = errors
      assert %{todo_list_id: ["can't be blank"]} = errors
    end
  end

  describe "record_list_created/2" do
    test "records list creation with correct data" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "New List"})

      {:ok, history} = History.record_list_created(todo_list, "creator-client")

      assert history.change_type == "list_created"
      assert history.client_id == "creator-client"
      assert history.todo_list_id == todo_list.id
      assert history.new_data.title == "New List"
      assert history.new_data.inserted_at != nil
      assert history.old_data == nil
    end
  end

  describe "record_list_title_updated/3" do
    test "records title update with old and new data" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Original Title"})
      updated_list = %{todo_list | title: "Updated Title"}

      {:ok, history} =
        History.record_list_title_updated(updated_list, "Original Title", "editor-client")

      assert history.change_type == "list_title_updated"
      assert history.client_id == "editor-client"
      assert history.old_data.title == "Original Title"
      assert history.new_data.title == "Updated Title"
    end
  end

  describe "record_list_deleted/2" do
    test "records list deletion with deleted_at timestamp" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "To Delete"})
      deleted_time = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
      deleted_list = %{todo_list | deleted_at: deleted_time}

      {:ok, history} = History.record_list_deleted(deleted_list, "deleter-client")

      assert history.change_type == "list_deleted"
      assert history.client_id == "deleter-client"
      assert history.old_data.title == "To Delete"
      assert history.old_data.deleted_at != nil
    end
  end

  describe "record_item_created/2" do
    test "records item creation with all item data" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})
      {:ok, todo_item} = Lists.create_todo_item(todo_list, %{text: "New Task"})

      {:ok, history} = History.record_item_created(todo_item, "item-creator")

      assert history.change_type == "item_created"
      assert history.client_id == "item-creator"
      assert history.todo_list_id == todo_list.id
      assert history.todo_item_id == todo_item.id
      assert history.new_data.text == "New Task"
      assert history.new_data.status == "todo"
      assert history.new_data.order == todo_item.order
    end
  end

  describe "record_item_text_updated/3" do
    test "records text update with old and new text" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})
      {:ok, todo_item} = Lists.create_todo_item(todo_list, %{text: "Original Text"})
      updated_item = %{todo_item | text: "Updated Text"}

      {:ok, history} =
        History.record_item_text_updated(updated_item, "Original Text", "text-editor")

      assert history.change_type == "item_text_updated"
      assert history.client_id == "text-editor"
      assert history.todo_item_id == todo_item.id
      assert history.old_data.text == "Original Text"
      assert history.new_data.text == "Updated Text"
    end
  end

  describe "record_item_status_updated/3" do
    test "records status update with old and new status" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})
      {:ok, todo_item} = Lists.create_todo_item(todo_list, %{text: "Test Task"})
      updated_item = %{todo_item | status: :done}

      {:ok, history} = History.record_item_status_updated(updated_item, :todo, "status-changer")

      assert history.change_type == "item_status_updated"
      assert history.client_id == "status-changer"
      assert history.old_data.status == "todo"
      assert history.new_data.status == "done"
    end
  end

  describe "record_item_deleted/2" do
    test "records item deletion with all item data" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})
      {:ok, todo_item} = Lists.create_todo_item(todo_list, %{text: "To Delete", status: :done})
      deleted_time = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
      deleted_item = %{todo_item | deleted_at: deleted_time}

      {:ok, history} = History.record_item_deleted(deleted_item, "item-deleter")

      assert history.change_type == "item_deleted"
      assert history.client_id == "item-deleter"
      assert history.old_data.text == "To Delete"
      assert history.old_data.status == "done"
      assert history.old_data.deleted_at != nil
    end
  end

  describe "record_items_reordered/3" do
    test "records bulk reordering with reorder data" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})

      reorder_data = [
        %{id: "item-1", order: 2},
        %{id: "item-2", order: 1}
      ]

      {:ok, history} = History.record_items_reordered(todo_list.id, reorder_data, "drag-client")

      assert history.change_type == "items_reordered"
      assert history.client_id == "drag-client"
      assert history.todo_list_id == todo_list.id

      assert history.new_data.reorder_data == [
               %{id: "item-1", order: 2},
               %{id: "item-2", order: 1}
             ]
    end
  end

  describe "get_list_history/2" do
    test "returns history for a specific list ordered by most recent first" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})

      # Create some history entries with delay to ensure different timestamps
      History.record_list_created(todo_list, "client-1")
      # Ensure different timestamps (1 second apart)
      Process.sleep(1000)
      History.record_list_title_updated(%{todo_list | title: "Updated"}, "Test List", "client-2")

      history = History.get_list_history(todo_list.id)

      assert length(history) == 2
      [first, second] = history

      # Most recent first
      assert first.change_type == "list_title_updated"
      assert first.client_id == "client-2"
      assert second.change_type == "list_created"
      assert second.client_id == "client-1"
    end

    test "respects limit option" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})

      # Create multiple history entries
      Enum.each(1..5, fn i ->
        History.create_history("list_created", "client-#{i}", %{todo_list_id: todo_list.id})
      end)

      history = History.get_list_history(todo_list.id, limit: 3)

      assert length(history) == 3
    end

    test "returns empty list for non-existent list" do
      fake_id = Ecto.UUID.generate()
      history = History.get_list_history(fake_id)

      assert history == []
    end
  end

  describe "get_item_history/2" do
    test "returns history for a specific item" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})
      {:ok, todo_item} = Lists.create_todo_item(todo_list, %{text: "Test Task"})

      History.record_item_created(todo_item, "creator")
      History.record_item_text_updated(%{todo_item | text: "Updated Task"}, "Test Task", "editor")

      history = History.get_item_history(todo_item.id)

      assert length(history) == 2
      assert Enum.all?(history, &(&1.todo_item_id == todo_item.id))
    end
  end

  describe "get_client_history/2" do
    test "returns history for a specific client across all lists" do
      {:ok, todo_list1} = Lists.create_todo_list(%{title: "List 1"})
      {:ok, todo_list2} = Lists.create_todo_list(%{title: "List 2"})

      # Create history for same client across different lists
      History.record_list_created(todo_list1, "multi-client")
      History.record_list_created(todo_list2, "multi-client")
      History.record_list_created(todo_list1, "other-client")

      history = History.get_client_history("multi-client")

      assert length(history) == 2
      assert Enum.all?(history, &(&1.client_id == "multi-client"))

      # Should be preloaded
      [first | _] = history
      assert first.todo_list != %Ecto.Association.NotLoaded{}
    end
  end
end
