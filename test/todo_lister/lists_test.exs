defmodule TodoLister.ListsTest do
  use TodoLister.DataCase

  alias TodoLister.Lists
  alias TodoLister.TodoList

  @valid_attrs %{title: "My Todo List"}
  @update_attrs %{title: "Updated Todo List"}
  @invalid_attrs %{title: nil}

  def todo_list_fixture(attrs \\ %{}) do
    {:ok, todo_list} =
      attrs
      |> Enum.into(@valid_attrs)
      |> Lists.create_todo_list()

    todo_list
  end

  describe "list_todo_lists/0" do
    test "returns all todo_lists" do
      todo_list = todo_list_fixture()
      assert Lists.list_todo_lists() == [todo_list]
    end

    test "returns empty list when no todo_lists exist" do
      assert Lists.list_todo_lists() == []
    end

    test "returns multiple todo_lists" do
      todo_list1 = todo_list_fixture(%{title: "First List"})
      todo_list2 = todo_list_fixture(%{title: "Second List"})

      todo_lists = Lists.list_todo_lists()
      assert length(todo_lists) == 2
      assert todo_list1 in todo_lists
      assert todo_list2 in todo_lists
    end
  end

  describe "get_todo_list!/1" do
    test "returns the todo_list with given id" do
      todo_list = todo_list_fixture()
      assert Lists.get_todo_list!(todo_list.id) == todo_list
    end

    test "raises Ecto.NoResultsError when todo_list does not exist" do
      non_existent_id = Ecto.UUID.generate()

      assert_raise Ecto.NoResultsError, fn ->
        Lists.get_todo_list!(non_existent_id)
      end
    end
  end

  describe "create_todo_list/1" do
    test "with valid data creates a todo_list" do
      assert {:ok, %TodoList{} = todo_list} = Lists.create_todo_list(@valid_attrs)
      assert todo_list.title == "My Todo List"
      assert is_binary(todo_list.id)
      assert %NaiveDateTime{} = todo_list.inserted_at
      assert %NaiveDateTime{} = todo_list.updated_at
    end

    test "with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Lists.create_todo_list(@invalid_attrs)
    end

    test "creates todo_list with binary_id" do
      assert {:ok, %TodoList{} = todo_list} = Lists.create_todo_list(@valid_attrs)
      assert is_binary(todo_list.id)
      # UUID length with dashes
      assert String.length(todo_list.id) == 36
    end
  end

  describe "update_todo_list/2" do
    setup do
      todo_list = todo_list_fixture()
      %{todo_list: todo_list}
    end

    test "with valid data updates the todo_list", %{todo_list: todo_list} do
      assert {:ok, %TodoList{} = updated_todo_list} =
               Lists.update_todo_list(todo_list, @update_attrs)

      assert updated_todo_list.title == "Updated Todo List"
    end

    test "with invalid data returns error changeset", %{todo_list: todo_list} do
      assert {:error, %Ecto.Changeset{}} = Lists.update_todo_list(todo_list, @invalid_attrs)
      assert todo_list == Lists.get_todo_list!(todo_list.id)
    end
  end

  describe "delete_todo_list/1" do
    setup do
      todo_list = todo_list_fixture()
      %{todo_list: todo_list}
    end

    test "deletes the todo_list", %{todo_list: todo_list} do
      assert {:ok, %TodoList{}} = Lists.delete_todo_list(todo_list)

      assert_raise Ecto.NoResultsError, fn ->
        Lists.get_todo_list!(todo_list.id)
      end
    end

    test "returns the deleted todo_list", %{todo_list: todo_list} do
      assert {:ok, deleted_todo_list} = Lists.delete_todo_list(todo_list)
      assert deleted_todo_list.id == todo_list.id
      assert deleted_todo_list.title == todo_list.title
    end
  end

  describe "change_todo_list/1" do
    test "returns a todo_list changeset" do
      todo_list = todo_list_fixture()
      assert %Ecto.Changeset{} = Lists.change_todo_list(todo_list)
    end

    test "returns changeset with given attributes" do
      todo_list = todo_list_fixture()
      changeset = Lists.change_todo_list(todo_list, @update_attrs)

      assert %Ecto.Changeset{} = changeset
      assert changeset.changes.title == "Updated Todo List"
    end

    test "returns changeset for new todo_list" do
      changeset = Lists.change_todo_list(%TodoList{}, @valid_attrs)

      assert %Ecto.Changeset{} = changeset
      assert changeset.changes.title == "My Todo List"
    end
  end
end
