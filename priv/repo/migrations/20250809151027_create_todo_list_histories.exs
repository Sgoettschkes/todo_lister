defmodule TodoLister.Repo.Migrations.CreateTodoListHistories do
  use Ecto.Migration

  def change do
    create table(:todo_list_histories, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :change_type, :string, null: false
      add :client_id, :string, null: false
      add :old_data, :map
      add :new_data, :map

      add :todo_list_id, references(:todo_lists, on_delete: :delete_all, type: :binary_id),
        null: false

      add :todo_item_id, references(:todo_items, on_delete: :delete_all, type: :binary_id),
        null: true

      add :inserted_at, :naive_datetime, null: false
    end

    create index(:todo_list_histories, [:todo_list_id])
  end
end
