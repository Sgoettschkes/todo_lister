defmodule TodoLister.Repo.Migrations.CreateTodoLists do
  use Ecto.Migration

  def change do
    create table(:todo_lists, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :title, :string, null: false

      timestamps()
    end

    create index(:todo_lists, [:inserted_at])
  end
end
