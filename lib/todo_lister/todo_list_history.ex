defmodule TodoLister.TodoListHistory do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  # Define all possible change types
  @change_types [
    # Todo List operations
    "list_created",
    "list_title_updated",
    "list_deleted",
    
    # Todo Item operations
    "item_created",
    "item_text_updated", 
    "item_status_updated",
    "item_order_updated",
    "item_deleted",
    
    # Bulk operations
    "items_reordered"
  ]

  schema "todo_list_histories" do
    field :change_type, :string
    field :client_id, :string
    field :old_data, :map
    field :new_data, :map
    
    belongs_to :todo_list, TodoLister.TodoList
    belongs_to :todo_item, TodoLister.TodoItem

    field :inserted_at, :naive_datetime
  end

  @doc false
  def changeset(todo_list_history, attrs) do
    todo_list_history
    |> cast(attrs, [:change_type, :client_id, :old_data, :new_data, :todo_list_id, :todo_item_id])
    |> validate_required([:change_type, :client_id, :todo_list_id])
    |> validate_inclusion(:change_type, @change_types)
    |> foreign_key_constraint(:todo_list_id)
    |> foreign_key_constraint(:todo_item_id)
    |> put_change(:inserted_at, NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second))
  end

  def change_types, do: @change_types
end