defmodule TodoLister.History do
  @moduledoc """
  The History context for managing todo list and item change history.
  """

  import Ecto.Query, warn: false
  alias TodoLister.Repo
  alias TodoLister.TodoListHistory

  @doc """
  Creates a history entry for a todo list change.
  
  ## Examples

      iex> create_history("list_created", client_id, %{todo_list_id: list_id, new_data: %{title: "New List"}})
      {:ok, %TodoListHistory{}}
      
      iex> create_history("invalid_type", client_id, %{})
      {:error, %Ecto.Changeset{}}

  """
  def create_history(change_type, client_id, attrs \\ %{}) do
    attrs_with_defaults = attrs
    |> Map.put(:change_type, change_type)
    |> Map.put(:client_id, client_id)

    %TodoListHistory{}
    |> TodoListHistory.changeset(attrs_with_defaults)
    |> Repo.insert()
  end

  @doc """
  Records a todo list creation.
  """
  def record_list_created(todo_list, client_id) do
    create_history("list_created", client_id, %{
      todo_list_id: todo_list.id,
      new_data: %{
        title: todo_list.title,
        inserted_at: todo_list.inserted_at
      }
    })
  end

  @doc """
  Records a todo list title update.
  """
  def record_list_title_updated(todo_list, old_title, client_id) do
    create_history("list_title_updated", client_id, %{
      todo_list_id: todo_list.id,
      old_data: %{title: old_title},
      new_data: %{title: todo_list.title}
    })
  end

  @doc """
  Records a todo list deletion.
  """
  def record_list_deleted(todo_list, client_id) do
    create_history("list_deleted", client_id, %{
      todo_list_id: todo_list.id,
      old_data: %{
        title: todo_list.title,
        deleted_at: todo_list.deleted_at
      }
    })
  end

  @doc """
  Records a todo item creation.
  """
  def record_item_created(todo_item, client_id) do
    create_history("item_created", client_id, %{
      todo_list_id: todo_item.todo_list_id,
      todo_item_id: todo_item.id,
      new_data: %{
        text: todo_item.text,
        status: to_string(todo_item.status),
        order: todo_item.order,
        inserted_at: todo_item.inserted_at
      }
    })
  end

  @doc """
  Records a todo item text update.
  """
  def record_item_text_updated(todo_item, old_text, client_id) do
    create_history("item_text_updated", client_id, %{
      todo_list_id: todo_item.todo_list_id,
      todo_item_id: todo_item.id,
      old_data: %{text: old_text},
      new_data: %{text: todo_item.text}
    })
  end

  @doc """
  Records a todo item status update.
  """
  def record_item_status_updated(todo_item, old_status, client_id) do
    create_history("item_status_updated", client_id, %{
      todo_list_id: todo_item.todo_list_id,
      todo_item_id: todo_item.id,
      old_data: %{status: to_string(old_status)},
      new_data: %{status: to_string(todo_item.status)}
    })
  end

  @doc """
  Records a todo item deletion.
  """
  def record_item_deleted(todo_item, client_id) do
    create_history("item_deleted", client_id, %{
      todo_list_id: todo_item.todo_list_id,
      todo_item_id: todo_item.id,
      old_data: %{
        text: todo_item.text,
        status: to_string(todo_item.status),
        order: todo_item.order,
        deleted_at: todo_item.deleted_at
      }
    })
  end

  @doc """
  Records bulk item reordering.
  """
  def record_items_reordered(todo_list_id, reorder_data, client_id) do
    create_history("items_reordered", client_id, %{
      todo_list_id: todo_list_id,
      new_data: %{reorder_data: reorder_data}
    })
  end

  @doc """
  Gets the history for a todo list, ordered by most recent first.
  
  ## Examples

      iex> get_list_history(todo_list_id)
      [%TodoListHistory{}, ...]

  """
  def get_list_history(todo_list_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)

    from(h in TodoListHistory,
      where: h.todo_list_id == ^todo_list_id,
      order_by: [desc: h.inserted_at],
      limit: ^limit,
      preload: [:todo_item]
    )
    |> Repo.all()
  end

  @doc """
  Gets the history for a specific todo item.
  
  ## Examples

      iex> get_item_history(todo_item_id)
      [%TodoListHistory{}, ...]

  """
  def get_item_history(todo_item_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)

    from(h in TodoListHistory,
      where: h.todo_item_id == ^todo_item_id,
      order_by: [desc: h.inserted_at],
      limit: ^limit
    )
    |> Repo.all()
  end

  @doc """
  Gets recent history across all lists for a specific client.
  """
  def get_client_history(client_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 25)

    from(h in TodoListHistory,
      where: h.client_id == ^client_id,
      order_by: [desc: h.inserted_at],
      limit: ^limit,
      preload: [:todo_list, :todo_item]
    )
    |> Repo.all()
  end
end