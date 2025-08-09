defmodule TodoLister.Lists do
  @moduledoc """
  The Lists context.
  """

  import Ecto.Query, warn: false
  alias TodoLister.Repo
  alias TodoLister.TodoList
  alias TodoLister.TodoItem

  @doc """
  Returns the list of todo_lists.

  ## Examples

      iex> list_todo_lists()
      [%TodoList{}, ...]

  """
  def list_todo_lists do
    Repo.all(TodoList)
  end

  @doc """
  Gets a single todo_list.

  Raises `Ecto.NoResultsError` if the Todo list does not exist.

  ## Examples

      iex> get_todo_list!(123)
      %TodoList{}

      iex> get_todo_list!(456)
      ** (Ecto.NoResultsError)

  """
  def get_todo_list!(id), do: Repo.get!(TodoList, id)

  @doc """
  Creates a todo_list.

  ## Examples

      iex> create_todo_list(%{field: value})
      {:ok, %TodoList{}}

      iex> create_todo_list(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_todo_list(attrs \\ %{}) do
    %TodoList{}
    |> TodoList.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a todo_list.

  ## Examples

      iex> update_todo_list(todo_list, %{field: new_value})
      {:ok, %TodoList{}}

      iex> update_todo_list(todo_list, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_todo_list(%TodoList{} = todo_list, attrs) do
    todo_list
    |> TodoList.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a todo_list.

  ## Examples

      iex> delete_todo_list(todo_list)
      {:ok, %TodoList{}}

      iex> delete_todo_list(todo_list)
      {:error, %Ecto.Changeset{}}

  """
  def delete_todo_list(%TodoList{} = todo_list) do
    Repo.delete(todo_list)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking todo_list changes.

  ## Examples

      iex> change_todo_list(todo_list)
      %Ecto.Changeset{data: %TodoList{}}

  """
  def change_todo_list(%TodoList{} = todo_list, attrs \\ %{}) do
    TodoList.changeset(todo_list, attrs)
  end

  ## Todo Items

  @doc """
  Returns the list of todo_items for a given todo_list.

  ## Examples

      iex> list_todo_items(todo_list)
      [%TodoItem{}, ...]

  """
  def list_todo_items(%TodoList{} = todo_list) do
    Repo.all(
      from ti in TodoItem,
        where: ti.todo_list_id == ^todo_list.id and is_nil(ti.deleted_at),
        order_by: [asc: ti.inserted_at]
    )
  end

  @doc """
  Gets a single todo_item.

  Raises `Ecto.NoResultsError` if the Todo item does not exist.

  ## Examples

      iex> get_todo_item!(123)
      %TodoItem{}

      iex> get_todo_item!(456)
      ** (Ecto.NoResultsError)

  """
  def get_todo_item!(id), do: Repo.get!(TodoItem, id)

  @doc """
  Creates a todo_item.

  ## Examples

      iex> create_todo_item(todo_list, %{field: value})
      {:ok, %TodoItem{}}

      iex> create_todo_item(todo_list, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_todo_item(%TodoList{} = todo_list, attrs \\ %{}) do
    %TodoItem{}
    |> TodoItem.changeset(Map.put(attrs, :todo_list_id, todo_list.id))
    |> Repo.insert()
  end

  @doc """
  Updates a todo_item.

  ## Examples

      iex> update_todo_item(todo_item, %{field: new_value})
      {:ok, %TodoItem{}}

      iex> update_todo_item(todo_item, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_todo_item(%TodoItem{} = todo_item, attrs) do
    todo_item
    |> TodoItem.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Soft deletes a todo_item by setting deleted_at timestamp.

  ## Examples

      iex> delete_todo_item(todo_item)
      {:ok, %TodoItem{}}

      iex> delete_todo_item(todo_item)
      {:error, %Ecto.Changeset{}}

  """
  def delete_todo_item(%TodoItem{} = todo_item) do
    todo_item
    |> TodoItem.changeset(%{deleted_at: NaiveDateTime.utc_now()})
    |> Repo.update()
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking todo_item changes.

  ## Examples

      iex> change_todo_item(todo_item)
      %Ecto.Changeset{data: %TodoItem{}}

  """
  def change_todo_item(%TodoItem{} = todo_item, attrs \\ %{}) do
    TodoItem.changeset(todo_item, attrs)
  end

  @doc """
  Gets a todo_list with its todo_items preloaded.

  ## Examples

      iex> get_todo_list_with_items!(123)
      %TodoList{todo_items: [%TodoItem{}, ...]}

  """
  def get_todo_list_with_items!(id) do
    todo_list = TodoList
    |> Repo.get!(id)
    |> Repo.preload(todo_items: from(ti in TodoItem, where: is_nil(ti.deleted_at), order_by: [asc: ti.inserted_at]))
    
    # Calculate the latest updated_at from the list or any of its items
    latest_updated_at = 
      [todo_list.updated_at | Enum.map(todo_list.todo_items, & &1.updated_at)]
      |> Enum.max(NaiveDateTime)
    
    # Add the calculated latest update time to the struct
    Map.put(todo_list, :latest_updated_at, latest_updated_at)
  end
end
