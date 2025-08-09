defmodule TodoLister.ListsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `TodoLister.Lists` context.
  """

  @doc """
  Generate a todo_list.
  """
  def todo_list_fixture(attrs \\ %{}) do
    {:ok, todo_list} =
      attrs
      |> Enum.into(%{
        title: "Test Todo List"
      })
      |> TodoLister.Lists.create_todo_list()

    todo_list
  end
end