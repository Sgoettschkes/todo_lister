defmodule TodoLister.Lists do
  @moduledoc """
  The Lists context.
  """

  import Ecto.Query, warn: false
  alias TodoLister.Repo
  alias TodoLister.TodoList
  alias TodoLister.TodoItem
  alias TodoLister.History

  @doc """
  Returns the list of todo_lists.

  ## Examples

      iex> list_todo_lists()
      [%TodoList{}, ...]

  """
  def list_todo_lists do
    Repo.all(from tl in TodoList, where: is_nil(tl.deleted_at))
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
  def get_todo_list!(id) do
    Repo.one!(from tl in TodoList, where: tl.id == ^id and is_nil(tl.deleted_at))
  end

  @doc """
  Creates a todo_list.

  ## Examples

      iex> create_todo_list(%{field: value}, client_id)
      {:ok, %TodoList{}}

      iex> create_todo_list(%{field: bad_value}, client_id)
      {:error, %Ecto.Changeset{}}

  """
  def create_todo_list(attrs \\ %{}, client_id \\ nil) do
    case %TodoList{}
         |> TodoList.changeset(attrs)
         |> Repo.insert() do
      {:ok, todo_list} = result ->
        # Record history if client_id is provided
        if client_id do
          History.record_list_created(todo_list, client_id)
        end
        result

      error ->
        error
    end
  end

  @doc """
  Updates a todo_list.

  ## Examples

      iex> update_todo_list(todo_list, %{field: new_value}, client_id)
      {:ok, %TodoList{}}

      iex> update_todo_list(todo_list, %{field: bad_value}, client_id)
      {:error, %Ecto.Changeset{}}

  """
  def update_todo_list(%TodoList{} = todo_list, attrs, client_id \\ nil) do
    old_title = todo_list.title

    case todo_list
         |> TodoList.changeset(attrs)
         |> Repo.update() do
      {:ok, updated_todo_list} = result ->
        # Record history if title changed and client_id is provided
        if client_id && updated_todo_list.title != old_title do
          History.record_list_title_updated(updated_todo_list, old_title, client_id)
        end
        result

      error ->
        error
    end
  end

  @doc """
  Soft deletes a todo_list by setting deleted_at timestamp.

  ## Examples

      iex> delete_todo_list(todo_list, client_id)
      {:ok, %TodoList{}}

      iex> delete_todo_list(todo_list, client_id)
      {:error, %Ecto.Changeset{}}

  """
  def delete_todo_list(%TodoList{} = todo_list, client_id \\ nil) do
    case todo_list
         |> TodoList.changeset(%{deleted_at: NaiveDateTime.utc_now()})
         |> Repo.update() do
      {:ok, deleted_todo_list} = result ->
        # Record history if client_id is provided
        if client_id do
          History.record_list_deleted(deleted_todo_list, client_id)
        end
        result

      error ->
        error
    end
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
        order_by: [asc: ti.order, asc: ti.inserted_at]
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

      iex> create_todo_item(todo_list, %{field: value}, client_id)
      {:ok, %TodoItem{}}

      iex> create_todo_item(todo_list, %{field: bad_value}, client_id)
      {:error, %Ecto.Changeset{}}

  """
  def create_todo_item(%TodoList{} = todo_list, attrs \\ %{}, client_id \\ nil) do
    # Get the next order value
    next_order = get_next_order(todo_list.id)
    attrs_with_order = attrs
    |> Map.put(:todo_list_id, todo_list.id)
    |> Map.put_new(:order, next_order)
    
    case %TodoItem{}
         |> TodoItem.changeset(attrs_with_order)
         |> Repo.insert() do
      {:ok, todo_item} = result ->
        # Record history if client_id is provided, but not for placeholder "New task" items
        if client_id && todo_item.text != "New task" do
          History.record_item_created(todo_item, client_id)
        end
        result

      error ->
        error
    end
  end

  defp get_next_order(todo_list_id) do
    case Repo.one(
      from ti in TodoItem,
        where: ti.todo_list_id == ^todo_list_id and is_nil(ti.deleted_at),
        select: max(ti.order)
    ) do
      nil -> 1
      max_order -> max_order + 1
    end
  end

  @doc """
  Updates a todo_item.

  ## Examples

      iex> update_todo_item(todo_item, %{field: new_value}, client_id)
      {:ok, %TodoItem{}}

      iex> update_todo_item(todo_item, %{field: bad_value}, client_id)
      {:error, %Ecto.Changeset{}}

  """
  def update_todo_item(%TodoItem{} = todo_item, attrs, client_id \\ nil) do
    old_text = todo_item.text
    old_status = todo_item.status

    case todo_item
         |> TodoItem.changeset(attrs)
         |> Repo.update() do
      {:ok, updated_todo_item} = result ->
        # Record history if client_id is provided
        if client_id do
          # Check what changed and record appropriate history
          if updated_todo_item.text != old_text do
            # Special case: if old text was "New task", this is actually creating the item
            if old_text == "New task" do
              History.record_item_created(updated_todo_item, client_id)
            else
              History.record_item_text_updated(updated_todo_item, old_text, client_id)
            end
          end
          
          if updated_todo_item.status != old_status do
            History.record_item_status_updated(updated_todo_item, old_status, client_id)
          end
        end
        result

      error ->
        error
    end
  end

  @doc """
  Soft deletes a todo_item by setting deleted_at timestamp.

  ## Examples

      iex> delete_todo_item(todo_item, client_id)
      {:ok, %TodoItem{}}

      iex> delete_todo_item(todo_item, client_id)
      {:error, %Ecto.Changeset{}}

  """
  def delete_todo_item(%TodoItem{} = todo_item, client_id \\ nil) do
    case todo_item
         |> TodoItem.changeset(%{deleted_at: NaiveDateTime.utc_now()})
         |> Repo.update() do
      {:ok, deleted_todo_item} = result ->
        # Record history if client_id is provided
        if client_id do
          History.record_item_deleted(deleted_todo_item, client_id)
        end
        result

      error ->
        error
    end
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
  Reorders todo items by updating their order values.
  
  ## Examples
  
      iex> reorder_todo_items([%{id: "1", order: 2}, %{id: "2", order: 1}], todo_list_id, client_id)
      {:ok, _}
  """
  def reorder_todo_items(item_orders, todo_list_id \\ nil, client_id \\ nil) do
    case Repo.transaction(fn ->
      Enum.each(item_orders, fn %{id: id, order: order} ->
        from(ti in TodoItem, where: ti.id == ^id)
        |> Repo.update_all(set: [order: order])
      end)
    end) do
      {:ok, result} ->
        # Record history if client_id and todo_list_id are provided
        if client_id && todo_list_id do
          History.record_items_reordered(todo_list_id, item_orders, client_id)
        end
        {:ok, result}

      error ->
        error
    end
  end

  @doc """
  Gets a todo_list with its todo_items preloaded.

  ## Examples

      iex> get_todo_list_with_items!(123)
      %TodoList{todo_items: [%TodoItem{}, ...]}

  """
  def get_todo_list_with_items!(id) do
    todo_list = from(tl in TodoList, where: tl.id == ^id and is_nil(tl.deleted_at))
    |> Repo.one!()
    |> Repo.preload(todo_items: from(ti in TodoItem, where: is_nil(ti.deleted_at), order_by: [asc: ti.order, asc: ti.inserted_at]))
    
    # Calculate the latest updated_at from the list or any of its items
    latest_updated_at = 
      [todo_list.updated_at | Enum.map(todo_list.todo_items, & &1.updated_at)]
      |> Enum.max(NaiveDateTime)
    
    # Add the calculated latest update time to the struct
    Map.put(todo_list, :latest_updated_at, latest_updated_at)
  end
end
