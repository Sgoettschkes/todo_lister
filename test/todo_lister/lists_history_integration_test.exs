defmodule TodoLister.ListsHistoryIntegrationTest do
  use TodoLister.DataCase

  alias TodoLister.{Lists, History}

  describe "todo list operations with history" do
    test "create_todo_list/2 records history when client_id provided" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"}, "creator-123")

      history = History.get_list_history(todo_list.id)
      assert length(history) == 1

      [entry] = history
      assert entry.change_type == "list_created"
      assert entry.client_id == "creator-123"
      assert entry.new_data["title"] == "Test List"
    end

    test "create_todo_list/2 does not record history when client_id is nil" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})

      history = History.get_list_history(todo_list.id)
      assert history == []
    end

    test "update_todo_list/3 records history for title changes" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Original Title"})

      {:ok, _updated_list} = Lists.update_todo_list(todo_list, %{title: "New Title"}, "editor-456")

      history = History.get_list_history(todo_list.id)
      assert length(history) == 1

      [entry] = history
      assert entry.change_type == "list_title_updated"
      assert entry.client_id == "editor-456"
      assert entry.old_data["title"] == "Original Title"
      assert entry.new_data["title"] == "New Title"
    end

    test "update_todo_list/3 does not record history when title unchanged" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Same Title"})

      {:ok, _updated_list} =
        Lists.update_todo_list(todo_list, %{title: "Same Title"}, "editor-456")

      history = History.get_list_history(todo_list.id)
      assert history == []
    end

    test "delete_todo_list/2 records history when client_id provided" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "To Delete"})

      {:ok, _deleted_list} = Lists.delete_todo_list(todo_list, "deleter-789")

      history = History.get_list_history(todo_list.id)
      assert length(history) == 1

      [entry] = history
      assert entry.change_type == "list_deleted"
      assert entry.client_id == "deleter-789"
      assert entry.old_data["title"] == "To Delete"
      assert entry.old_data["deleted_at"] != nil
    end
  end

  describe "todo item operations with history" do
    setup do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})
      %{todo_list: todo_list}
    end

    test "create_todo_item/3 records history when client_id provided", %{todo_list: todo_list} do
      {:ok, todo_item} = Lists.create_todo_item(todo_list, %{text: "New Task"}, "item-creator")

      history = History.get_list_history(todo_list.id)
      assert length(history) == 1

      [entry] = history
      assert entry.change_type == "item_created"
      assert entry.client_id == "item-creator"
      assert entry.todo_item_id == todo_item.id
      assert entry.new_data["text"] == "New Task"
      assert entry.new_data["status"] == "todo"
      assert entry.new_data["order"] == 1
    end

    test "create_todo_item/3 assigns correct order values", %{todo_list: todo_list} do
      {:ok, _item1} = Lists.create_todo_item(todo_list, %{text: "First Task"}, "creator")
      {:ok, _item2} = Lists.create_todo_item(todo_list, %{text: "Second Task"}, "creator")

      history = History.get_list_history(todo_list.id)
      assert length(history) == 2

      # Find entries by order value (history is sorted by most recent first)
      first_item_entry = Enum.find(history, fn entry -> entry.new_data["order"] == 1 end)
      second_item_entry = Enum.find(history, fn entry -> entry.new_data["order"] == 2 end)

      assert first_item_entry != nil
      assert second_item_entry != nil
      assert first_item_entry.new_data["order"] == 1
      assert second_item_entry.new_data["order"] == 2
    end

    test "update_todo_item/3 records text changes", %{todo_list: todo_list} do
      {:ok, todo_item} = Lists.create_todo_item(todo_list, %{text: "Original Text"})

      {:ok, _updated_item} =
        Lists.update_todo_item(todo_item, %{text: "Updated Text"}, "text-editor")

      history = History.get_list_history(todo_list.id)
      text_updates = Enum.filter(history, &(&1.change_type == "item_text_updated"))

      assert length(text_updates) == 1
      [entry] = text_updates

      assert entry.client_id == "text-editor"
      assert entry.old_data["text"] == "Original Text"
      assert entry.new_data["text"] == "Updated Text"
    end

    test "update_todo_item/3 records status changes", %{todo_list: todo_list} do
      {:ok, todo_item} = Lists.create_todo_item(todo_list, %{text: "Test Task"})

      {:ok, _updated_item} = Lists.update_todo_item(todo_item, %{status: :done}, "status-changer")

      history = History.get_list_history(todo_list.id)
      status_updates = Enum.filter(history, &(&1.change_type == "item_status_updated"))

      assert length(status_updates) == 1
      [entry] = status_updates

      assert entry.client_id == "status-changer"
      assert entry.old_data["status"] == "todo"
      assert entry.new_data["status"] == "done"
    end

    test "update_todo_item/3 records both text and status changes in single update", %{
      todo_list: todo_list
    } do
      {:ok, todo_item} = Lists.create_todo_item(todo_list, %{text: "Original", status: :todo})

      {:ok, _updated_item} =
        Lists.update_todo_item(
          todo_item,
          %{
            text: "Updated Text",
            status: :done
          },
          "multi-editor"
        )

      history = History.get_list_history(todo_list.id)

      # Should have both text and status update entries
      text_entry = Enum.find(history, &(&1.change_type == "item_text_updated"))
      status_entry = Enum.find(history, &(&1.change_type == "item_status_updated"))

      assert text_entry != nil
      assert status_entry != nil
      assert text_entry.client_id == "multi-editor"
      assert status_entry.client_id == "multi-editor"
    end

    test "update_todo_item/3 does not record history when nothing changes", %{
      todo_list: todo_list
    } do
      {:ok, todo_item} = Lists.create_todo_item(todo_list, %{text: "Same Text", status: :todo})

      {:ok, _updated_item} =
        Lists.update_todo_item(
          todo_item,
          %{
            text: "Same Text",
            status: :todo
          },
          "no-change-client"
        )

      history = History.get_list_history(todo_list.id)

      updates =
        Enum.filter(history, &(&1.change_type in ["item_text_updated", "item_status_updated"]))

      assert updates == []
    end

    test "delete_todo_item/2 records history when client_id provided", %{todo_list: todo_list} do
      {:ok, todo_item} = Lists.create_todo_item(todo_list, %{text: "To Delete", status: :done})

      {:ok, _deleted_item} = Lists.delete_todo_item(todo_item, "item-deleter")

      history = History.get_list_history(todo_list.id)
      delete_entries = Enum.filter(history, &(&1.change_type == "item_deleted"))

      assert length(delete_entries) == 1
      [entry] = delete_entries

      assert entry.client_id == "item-deleter"
      assert entry.todo_item_id == todo_item.id
      assert entry.old_data["text"] == "To Delete"
      assert entry.old_data["status"] == "done"
      assert entry.old_data["deleted_at"] != nil
    end
  end

  describe "reorder operations with history" do
    test "reorder_todo_items/3 records history when client_id provided" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})
      {:ok, item1} = Lists.create_todo_item(todo_list, %{text: "Task 1"})
      {:ok, item2} = Lists.create_todo_item(todo_list, %{text: "Task 2"})

      reorder_data = [
        %{id: item1.id, order: 2},
        %{id: item2.id, order: 1}
      ]

      {:ok, _result} = Lists.reorder_todo_items(reorder_data, todo_list.id, "drag-client")

      history = History.get_list_history(todo_list.id)
      reorder_entries = Enum.filter(history, &(&1.change_type == "items_reordered"))

      assert length(reorder_entries) == 1
      [entry] = reorder_entries

      assert entry.client_id == "drag-client"
      assert entry.todo_list_id == todo_list.id

      assert entry.new_data["reorder_data"] == [
               %{"id" => item1.id, "order" => 2},
               %{"id" => item2.id, "order" => 1}
             ]
    end

    test "reorder_todo_items/3 does not record history when client_id is nil" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})
      {:ok, item1} = Lists.create_todo_item(todo_list, %{text: "Task 1"})

      reorder_data = [%{id: item1.id, order: 1}]
      {:ok, _result} = Lists.reorder_todo_items(reorder_data, todo_list.id, nil)

      history = History.get_list_history(todo_list.id)
      reorder_entries = Enum.filter(history, &(&1.change_type == "items_reordered"))

      assert reorder_entries == []
    end
  end

  describe "complex scenarios" do
    test "multiple operations create chronological history" do
      client_id = "test-client"

      # Create list
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Project List"}, client_id)

      # Add items  
      {:ok, item1} = Lists.create_todo_item(todo_list, %{text: "Task 1"}, client_id)
      {:ok, item2} = Lists.create_todo_item(todo_list, %{text: "Task 2"}, client_id)

      # Update title
      {:ok, _} = Lists.update_todo_list(todo_list, %{title: "Updated Project"}, client_id)

      # Update item status
      {:ok, _} = Lists.update_todo_item(item1, %{status: :done}, client_id)

      # Reorder items
      {:ok, _} =
        Lists.reorder_todo_items(
          [
            %{id: item2.id, order: 1},
            %{id: item1.id, order: 2}
          ],
          todo_list.id,
          client_id
        )

      history = History.get_list_history(todo_list.id)

      # Should have all operations recorded
      change_types = Enum.map(history, & &1.change_type)

      assert "list_created" in change_types
      assert "item_created" in change_types
      assert "list_title_updated" in change_types
      assert "item_status_updated" in change_types
      assert "items_reordered" in change_types

      # All should be from same client
      assert Enum.all?(history, &(&1.client_id == client_id))

      # Should be chronologically ordered (most recent first)
      timestamps = Enum.map(history, & &1.inserted_at)
      assert timestamps == Enum.sort(timestamps, {:desc, NaiveDateTime})
    end

    test "different clients create separate audit trails" do
      {:ok, todo_list} = Lists.create_todo_list(%{title: "Shared List"}, "creator")
      {:ok, item} = Lists.create_todo_item(todo_list, %{text: "Shared Task"}, "creator")

      # Different client updates
      {:ok, _} = Lists.update_todo_list(todo_list, %{title: "Updated by Editor"}, "editor")
      {:ok, _} = Lists.update_todo_item(item, %{text: "Updated by Collaborator"}, "collaborator")
      {:ok, _} = Lists.update_todo_item(item, %{status: :done}, "completer")

      history = History.get_list_history(todo_list.id)

      # Verify different clients recorded
      clients = Enum.map(history, & &1.client_id) |> Enum.uniq()
      assert "creator" in clients
      assert "editor" in clients
      assert "collaborator" in clients
      assert "completer" in clients
      assert length(clients) == 4
    end
  end

  describe "backwards compatibility" do
    test "all Lists functions work without client_id (no history recorded)" do
      # Test all operations work without client_id
      {:ok, todo_list} = Lists.create_todo_list(%{title: "No History List"})
      {:ok, todo_item} = Lists.create_todo_item(todo_list, %{text: "No History Task"})
      {:ok, _} = Lists.update_todo_list(todo_list, %{title: "Updated No History"})
      {:ok, _} = Lists.update_todo_item(todo_item, %{text: "Updated Task", status: :done})
      {:ok, _} = Lists.delete_todo_item(todo_item)
      {:ok, _} = Lists.delete_todo_list(todo_list)

      # Should have no history recorded
      history = History.get_list_history(todo_list.id)
      assert history == []
    end
  end
end
