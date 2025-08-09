defmodule TodoLister.Repo.Migrations.CreateTodoItems do
  use Ecto.Migration

  def change do
    create table(:todo_items, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :text, :string, null: false
      add :status, :string, null: false, default: "todo"

      add :todo_list_id, references(:todo_lists, type: :binary_id, on_delete: :delete_all),
        null: false

      timestamps()
    end

    create index(:todo_items, [:todo_list_id])
  end
end
