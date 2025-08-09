defmodule TodoLister.TodoList do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "todo_lists" do
    field :title, :string
    field :deleted_at, :naive_datetime
    
    has_many :todo_items, TodoLister.TodoItem

    timestamps()
  end

  @doc false
  def changeset(todo_list, attrs) do
    todo_list
    |> cast(attrs, [:title, :deleted_at])
    |> validate_required([:title])
    |> validate_length(:title, min: 1, max: 255)
  end
end
