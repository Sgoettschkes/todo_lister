defmodule TodoLister.TodoListTest do
  use TodoLister.DataCase

  alias TodoLister.TodoList

  @valid_attrs %{title: "My Todo List"}
  @invalid_attrs %{title: nil}

  describe "changeset/2" do
    test "changeset with valid attributes" do
      changeset = TodoList.changeset(%TodoList{}, @valid_attrs)
      assert changeset.valid?
    end

    test "changeset with invalid attributes" do
      changeset = TodoList.changeset(%TodoList{}, @invalid_attrs)
      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).title
    end

    test "changeset requires title" do
      changeset = TodoList.changeset(%TodoList{}, %{title: ""})
      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).title
    end

    test "changeset validates title minimum length" do
      changeset = TodoList.changeset(%TodoList{}, %{title: ""})
      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).title
    end

    test "changeset validates title maximum length" do
      long_title = String.duplicate("a", 256)
      changeset = TodoList.changeset(%TodoList{}, %{title: long_title})
      refute changeset.valid?
      assert "should be at most 255 character(s)" in errors_on(changeset).title
    end
  end
end
