defmodule TodoLister.TodoItemsContextTest do
  use TodoLister.DataCase

  alias TodoLister.Lists
  alias TodoLister.TodoItem

  @todo_list_attrs %{title: "Test Todo List"}
  @valid_attrs %{text: "Buy groceries", status: :todo}
  @update_attrs %{text: "Buy organic groceries", status: :done}
  @invalid_attrs %{text: nil}

  def todo_list_fixture(attrs \\ %{}) do
    {:ok, todo_list} =
      attrs
      |> Enum.into(@todo_list_attrs)
      |> Lists.create_todo_list()

    todo_list
  end

  def todo_item_fixture(todo_list, attrs \\ %{}) do
    {:ok, todo_item} =
      attrs
      |> Enum.into(@valid_attrs)
      |> then(&Lists.create_todo_item(todo_list, &1))

    todo_item
  end

  describe "list_todo_items/1" do
    setup do
      todo_list = todo_list_fixture()
      %{todo_list: todo_list}
    end

    test "returns all todo_items for a todo_list", %{todo_list: todo_list} do
      todo_item = todo_item_fixture(todo_list)
      assert Lists.list_todo_items(todo_list) == [todo_item]
    end

    test "returns empty list when no todo_items exist", %{todo_list: todo_list} do
      assert Lists.list_todo_items(todo_list) == []
    end

    test "returns items ordered by insertion", %{todo_list: todo_list} do
      item1 = todo_item_fixture(todo_list, %{text: "First"})
      :timer.sleep(10)
      item2 = todo_item_fixture(todo_list, %{text: "Second"})
      :timer.sleep(10)
      item3 = todo_item_fixture(todo_list, %{text: "Third"})
      
      items = Lists.list_todo_items(todo_list)
      assert [item1, item2, item3] == items
    end

    test "only returns items for specific todo_list", %{todo_list: todo_list} do
      other_list = todo_list_fixture(%{title: "Other List"})
      
      item1 = todo_item_fixture(todo_list)
      _item2 = todo_item_fixture(other_list)
      
      assert Lists.list_todo_items(todo_list) == [item1]
    end
  end

  describe "get_todo_item!/1" do
    setup do
      todo_list = todo_list_fixture()
      todo_item = todo_item_fixture(todo_list)
      %{todo_list: todo_list, todo_item: todo_item}
    end

    test "returns the todo_item with given id", %{todo_item: todo_item} do
      assert Lists.get_todo_item!(todo_item.id) == todo_item
    end

    test "raises Ecto.NoResultsError when todo_item does not exist" do
      non_existent_id = Ecto.UUID.generate()
      
      assert_raise Ecto.NoResultsError, fn ->
        Lists.get_todo_item!(non_existent_id)
      end
    end
  end

  describe "create_todo_item/2" do
    setup do
      todo_list = todo_list_fixture()
      %{todo_list: todo_list}
    end

    test "with valid data creates a todo_item", %{todo_list: todo_list} do
      assert {:ok, %TodoItem{} = todo_item} = Lists.create_todo_item(todo_list, @valid_attrs)
      assert todo_item.text == "Buy groceries"
      assert todo_item.status == :todo
      assert todo_item.todo_list_id == todo_list.id
      assert is_binary(todo_item.id)
    end

    test "with invalid data returns error changeset", %{todo_list: todo_list} do
      assert {:error, %Ecto.Changeset{}} = Lists.create_todo_item(todo_list, @invalid_attrs)
    end

    test "creates todo_item with binary_id", %{todo_list: todo_list} do
      assert {:ok, %TodoItem{} = todo_item} = Lists.create_todo_item(todo_list, @valid_attrs)
      assert is_binary(todo_item.id)
      assert String.length(todo_item.id) == 36  # UUID length with dashes
    end

    test "creates todo_item with different status values", %{todo_list: todo_list} do
      for status <- [:todo, :done, :wont_do] do
        attrs = %{text: "Task #{status}", status: status}
        assert {:ok, %TodoItem{} = todo_item} = Lists.create_todo_item(todo_list, attrs)
        assert todo_item.status == status
      end
    end
  end

  describe "update_todo_item/2" do
    setup do
      todo_list = todo_list_fixture()
      todo_item = todo_item_fixture(todo_list)
      %{todo_list: todo_list, todo_item: todo_item}
    end

    test "with valid data updates the todo_item", %{todo_item: todo_item} do
      assert {:ok, %TodoItem{} = updated_todo_item} = Lists.update_todo_item(todo_item, @update_attrs)
      assert updated_todo_item.text == "Buy organic groceries"
      assert updated_todo_item.status == :done
      assert updated_todo_item.id == todo_item.id
    end

    test "with invalid data returns error changeset", %{todo_item: todo_item} do
      assert {:error, %Ecto.Changeset{}} = Lists.update_todo_item(todo_item, @invalid_attrs)
      assert todo_item == Lists.get_todo_item!(todo_item.id)
    end

    test "can update status independently", %{todo_item: todo_item} do
      assert {:ok, %TodoItem{} = updated} = Lists.update_todo_item(todo_item, %{status: :done})
      assert updated.status == :done
      assert updated.text == todo_item.text
    end
  end

  describe "delete_todo_item/1" do
    setup do
      todo_list = todo_list_fixture()
      todo_item = todo_item_fixture(todo_list)
      %{todo_list: todo_list, todo_item: todo_item}
    end

    test "soft deletes the todo_item", %{todo_item: todo_item} do
      assert {:ok, %TodoItem{}} = Lists.delete_todo_item(todo_item)
      
      # Item still exists in database but marked as deleted
      deleted_item = Lists.get_todo_item!(todo_item.id)
      assert not is_nil(deleted_item.deleted_at)
      assert deleted_item.text == todo_item.text
    end

    test "returns the deleted todo_item", %{todo_item: todo_item} do
      assert {:ok, deleted_todo_item} = Lists.delete_todo_item(todo_item)
      assert deleted_todo_item.id == todo_item.id
      assert deleted_todo_item.text == todo_item.text
    end
  end

  describe "change_todo_item/1" do
    setup do
      todo_list = todo_list_fixture()
      todo_item = todo_item_fixture(todo_list)
      %{todo_list: todo_list, todo_item: todo_item}
    end

    test "returns a todo_item changeset", %{todo_item: todo_item} do
      assert %Ecto.Changeset{} = Lists.change_todo_item(todo_item)
    end

    test "returns changeset with given attributes", %{todo_item: todo_item} do
      changeset = Lists.change_todo_item(todo_item, @update_attrs)
      
      assert %Ecto.Changeset{} = changeset
      assert changeset.changes.text == "Buy organic groceries"
      assert changeset.changes.status == :done
    end
  end

  describe "get_todo_list_with_items!/1" do
    setup do
      todo_list = todo_list_fixture()
      %{todo_list: todo_list}
    end

    test "returns todo_list with preloaded items", %{todo_list: todo_list} do
      item1 = todo_item_fixture(todo_list, %{text: "First"})
      item2 = todo_item_fixture(todo_list, %{text: "Second"})
      
      loaded_list = Lists.get_todo_list_with_items!(todo_list.id)
      
      assert loaded_list.id == todo_list.id
      assert length(loaded_list.todo_items) == 2
      assert item1 in loaded_list.todo_items
      assert item2 in loaded_list.todo_items
    end

    test "returns empty todo_items when none exist", %{todo_list: todo_list} do
      loaded_list = Lists.get_todo_list_with_items!(todo_list.id)
      
      assert loaded_list.id == todo_list.id
      assert loaded_list.todo_items == []
    end
  end
end