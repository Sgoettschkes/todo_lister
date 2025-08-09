defmodule TodoLister.Repo.Migrations.AddDeletedAtToTodoLists do
  use Ecto.Migration

  def change do
    alter table(:todo_lists) do
      add :deleted_at, :naive_datetime
    end
  end
end
