defmodule TodoLister.Repo.Migrations.AddDeletedAtToTodoItems do
  use Ecto.Migration

  def change do
    alter table(:todo_items) do
      add :deleted_at, :naive_datetime
    end
  end
end
