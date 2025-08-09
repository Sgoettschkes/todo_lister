defmodule TodoLister.Repo.Migrations.AddOrderToTodoItems do
  use Ecto.Migration

  def change do
    alter table(:todo_items) do
      add :order, :integer, default: 0
    end

    # Set initial order values for existing items using a subquery
    execute """
    UPDATE todo_items 
    SET "order" = subquery.row_num
    FROM (
      SELECT id, row_number() OVER (PARTITION BY todo_list_id ORDER BY inserted_at) AS row_num
      FROM todo_items
    ) AS subquery
    WHERE todo_items.id = subquery.id
      AND (todo_items."order" IS NULL OR todo_items."order" = 0)
    """
  end
end
