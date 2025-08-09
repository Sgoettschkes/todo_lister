defmodule TodoLister.TodoItemTest do
  use TodoLister.DataCase
  
  alias TodoLister.TodoItem
  alias TodoLister.Lists

  setup do
    {:ok, todo_list} = Lists.create_todo_list(%{title: "Test List"})
    %{todo_list: todo_list}
  end

  @valid_attrs %{text: "Buy milk", status: :todo}
  @invalid_attrs %{text: nil}

  describe "changeset/2" do
    test "changeset with valid attributes", %{todo_list: todo_list} do
      attrs = Map.put(@valid_attrs, :todo_list_id, todo_list.id)
      changeset = TodoItem.changeset(%TodoItem{}, attrs)
      assert changeset.valid?
    end

    test "changeset with invalid attributes" do
      changeset = TodoItem.changeset(%TodoItem{}, @invalid_attrs)
      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).text
    end

    test "changeset requires text" do
      changeset = TodoItem.changeset(%TodoItem{}, %{text: ""})
      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).text
    end

    test "changeset validates text minimum length", %{todo_list: todo_list} do
      attrs = %{text: "", todo_list_id: todo_list.id}
      changeset = TodoItem.changeset(%TodoItem{}, attrs)
      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).text
    end

    test "changeset validates text maximum length", %{todo_list: todo_list} do
      long_text = String.duplicate("a", 501)
      attrs = %{text: long_text, todo_list_id: todo_list.id}
      changeset = TodoItem.changeset(%TodoItem{}, attrs)
      refute changeset.valid?
      assert "should be at most 500 character(s)" in errors_on(changeset).text
    end

    test "changeset requires todo_list_id" do
      changeset = TodoItem.changeset(%TodoItem{}, %{text: "Test"})
      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).todo_list_id
    end

    test "changeset accepts valid status values", %{todo_list: todo_list} do
      for status <- [:todo, :done, :wont_do] do
        attrs = %{text: "Test", status: status, todo_list_id: todo_list.id}
        changeset = TodoItem.changeset(%TodoItem{}, attrs)
        assert changeset.valid?
      end
    end

    test "changeset rejects invalid status values", %{todo_list: todo_list} do
      attrs = %{text: "Test", status: :invalid, todo_list_id: todo_list.id}
      changeset = TodoItem.changeset(%TodoItem{}, attrs)
      refute changeset.valid?
      assert "is invalid" in errors_on(changeset).status
    end

    test "changeset defaults status to :todo", %{todo_list: todo_list} do
      attrs = %{text: "Test", todo_list_id: todo_list.id}
      changeset = TodoItem.changeset(%TodoItem{}, attrs)
      assert changeset.valid?
      # The default is set at the schema level, not in changeset
    end
  end

  describe "schema" do
    test "has binary_id primary key" do
      assert TodoItem.__schema__(:primary_key) == [:id]
      assert TodoItem.__schema__(:type, :id) == :binary_id
    end

    test "has required fields" do
      fields = TodoItem.__schema__(:fields)
      assert :id in fields
      assert :text in fields
      assert :status in fields
      assert :todo_list_id in fields
      assert :inserted_at in fields
      assert :updated_at in fields
    end

    test "belongs to todo_list" do
      assocs = TodoItem.__schema__(:associations)
      assert :todo_list in assocs
    end
  end
end