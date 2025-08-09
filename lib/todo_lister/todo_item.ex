defmodule TodoLister.TodoItem do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "todo_items" do
    field :text, :string
    field :status, Ecto.Enum, values: [:todo, :done, :wont_do], default: :todo
    field :deleted_at, :naive_datetime
    field :order, :integer, default: 0

    belongs_to :todo_list, TodoLister.TodoList

    timestamps()
  end

  @doc false
  def changeset(todo_item, attrs) do
    todo_item
    |> cast(attrs, [:text, :status, :todo_list_id, :deleted_at, :order])
    |> validate_required([:todo_list_id])
    |> validate_required([:text])
    |> validate_length(:text, min: 1, max: 500)
    |> validate_inclusion(:status, [:todo, :done, :wont_do])
    |> foreign_key_constraint(:todo_list_id)
  end
end
