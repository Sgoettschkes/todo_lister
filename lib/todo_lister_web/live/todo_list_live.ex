defmodule TodoListerWeb.TodoListLive do
  use TodoListerWeb, :live_view

  alias TodoLister.{Lists, History}

  # Helper function to broadcast updates to all clients except the sender
  defp broadcast_updated(todo_list_id) do
    Phoenix.PubSub.broadcast(
      TodoLister.PubSub,
      "todo_list:#{todo_list_id}",
      {:updated, self()}
    )
  end

  # Helper function to reload history after changes
  defp reload_history(socket) do
    updated_history = History.get_list_history(socket.assigns.todo_list.id, limit: 20)
    assign(socket, :history, updated_history)
  end

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    todo_list = Lists.get_todo_list_with_items!(id)

    # Extract client_id from connection params
    client_id = get_connect_params(socket)["client_id"]

    # Subscribe to PubSub updates for this todo list
    if connected?(socket) do
      Phoenix.PubSub.subscribe(TodoLister.PubSub, "todo_list:#{id}")
    end

    # Get history for this todo list (limit to recent 20 entries)
    history = History.get_list_history(todo_list.id, limit: 20)

    socket =
      socket
      |> assign(:todo_list, todo_list)
      |> assign(:editing_title, false)
      |> assign(:page_title, todo_list.title)
      |> assign(:todo_items, todo_list.todo_items)
      |> assign(:editing_item_id, nil)
      |> assign(:confirming_delete_id, nil)
      |> assign(:client_id, client_id)
      |> assign(:history, history)
      |> assign(:refresh_loading, false)
      |> assign(:focus_timer, %{item_id: nil, timer_ref: nil, show_modal: false})
      |> assign(:focus_item_id, nil)
      |> assign(:focus_end_time, nil)

    {:ok, socket}
  end

  @impl true
  def handle_event("edit_title", _params, socket) do
    {:noreply, assign(socket, :editing_title, true)}
  end

  @impl true
  def handle_event("cancel_edit", _params, socket) do
    {:noreply, assign(socket, :editing_title, false)}
  end

  @impl true
  def handle_event("save_title", params, socket) do
    title =
      case params do
        %{"title" => title} -> title
        %{"value" => title} -> title
        _ -> socket.assigns.todo_list.title
      end

    case Lists.update_todo_list(
           socket.assigns.todo_list,
           %{title: title},
           socket.assigns.client_id
         ) do
      {:ok, updated_todo_list} ->
        broadcast_updated(updated_todo_list.id)

        socket =
          socket
          |> assign(:todo_list, updated_todo_list)
          |> assign(:editing_title, false)
          |> assign(:page_title, updated_todo_list.title)
          |> reload_history()
          |> put_flash(:info, "Title updated successfully")

        {:noreply, socket}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to update title")}
    end
  end

  @impl true
  def handle_event("key_down", %{"key" => "Escape"}, socket) do
    {:noreply, assign(socket, :editing_title, false)}
  end

  @impl true
  def handle_event("key_down", %{"key" => "Enter", "value" => title}, socket) do
    handle_event("save_title", %{"title" => title}, socket)
  end

  @impl true
  def handle_event("key_down", _params, socket) do
    {:noreply, socket}
  end

  @impl true
  def handle_event("copy_share_link", _params, socket) do
    {:noreply,
     put_flash(socket, :info, "Link copied! Share this URL with others to collaborate.")}
  end

  @impl true
  def handle_event("refresh", _params, socket) do
    # Immediately disable the refresh button
    socket = assign(socket, :refresh_loading, true)

    # Schedule the data reload after 1 second
    Process.send_after(self(), :perform_refresh, 1000)

    {:noreply, socket}
  end

  @impl true
  def handle_event("add_item", _params, socket) do
    # Create a new item and immediately put it in edit mode
    case Lists.create_todo_item(
           socket.assigns.todo_list,
           %{text: "New task"},
           socket.assigns.client_id
         ) do
      {:ok, new_item} ->
        broadcast_updated(socket.assigns.todo_list.id)

        # Reload the todo list to get updated latest_updated_at
        updated_todo_list = Lists.get_todo_list_with_items!(socket.assigns.todo_list.id)

        socket =
          socket
          |> assign(:todo_list, updated_todo_list)
          |> assign(:todo_items, socket.assigns.todo_items ++ [new_item])
          |> assign(:editing_item_id, new_item.id)
          |> reload_history()

        {:noreply, socket}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to add item")}
    end
  end

  @impl true
  def handle_event("toggle_status", %{"id" => id}, socket) do
    item = Enum.find(socket.assigns.todo_items, &(&1.id == id))

    new_status =
      case item.status do
        :todo -> :done
        :done -> :todo
        :wont_do -> :todo
      end

    case Lists.update_todo_item(item, %{status: new_status}, socket.assigns.client_id) do
      {:ok, updated_item} ->
        broadcast_updated(socket.assigns.todo_list.id)

        # Reload the todo list to get updated latest_updated_at
        updated_todo_list = Lists.get_todo_list_with_items!(socket.assigns.todo_list.id)

        updated_items =
          Enum.map(socket.assigns.todo_items, fn
            %{id: ^id} -> updated_item
            other -> other
          end)

        socket =
          socket
          |> assign(:todo_list, updated_todo_list)
          |> assign(:todo_items, updated_items)
          |> reload_history()

        {:noreply, socket}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to update status")}
    end
  end

  @impl true
  def handle_event("soft_delete", %{"id" => id}, socket) do
    item = Enum.find(socket.assigns.todo_items, &(&1.id == id))

    case Lists.update_todo_item(item, %{status: :wont_do}, socket.assigns.client_id) do
      {:ok, updated_item} ->
        broadcast_updated(socket.assigns.todo_list.id)

        # Reload the todo list to get updated latest_updated_at
        updated_todo_list = Lists.get_todo_list_with_items!(socket.assigns.todo_list.id)

        updated_items =
          Enum.map(socket.assigns.todo_items, fn
            %{id: ^id} -> updated_item
            other -> other
          end)

        socket =
          socket
          |> assign(:todo_list, updated_todo_list)
          |> assign(:todo_items, updated_items)
          |> reload_history()

        {:noreply, socket}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to mark as won't do")}
    end
  end

  @impl true
  def handle_event("confirm_hard_delete", %{"id" => id}, socket) do
    socket = assign(socket, :confirming_delete_id, id)
    {:noreply, socket}
  end

  @impl true
  def handle_event("hard_delete", %{"id" => id}, socket) do
    item = Enum.find(socket.assigns.todo_items, &(&1.id == id))

    case Lists.delete_todo_item(item, socket.assigns.client_id) do
      {:ok, _deleted_item} ->
        broadcast_updated(socket.assigns.todo_list.id)

        # Reload the todo list to get updated latest_updated_at
        updated_todo_list = Lists.get_todo_list_with_items!(socket.assigns.todo_list.id)

        updated_items = Enum.reject(socket.assigns.todo_items, &(&1.id == id))

        socket =
          socket
          |> assign(:todo_list, updated_todo_list)
          |> assign(:todo_items, updated_items)
          |> assign(:confirming_delete_id, nil)
          |> reload_history()
          |> put_flash(:info, "Item permanently deleted")

        {:noreply, socket}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to delete item")}
    end
  end

  @impl true
  def handle_event("cancel_delete", _params, socket) do
    {:noreply, assign(socket, :confirming_delete_id, nil)}
  end

  @impl true
  def handle_event("prevent_edit", _params, socket) do
    # This event does nothing - it just prevents the edit_item event from firing
    {:noreply, socket}
  end

  @impl true
  def handle_event("edit_item", %{"id" => id}, socket) do
    {:noreply, assign(socket, :editing_item_id, id)}
  end

  @impl true
  def handle_event("cancel_edit_item", _params, socket) do
    {:noreply, assign(socket, :editing_item_id, nil)}
  end

  @impl true
  def handle_event(
        "reorder_item",
        %{"item_id" => item_id, "reference_id" => reference_id, "position" => position},
        socket
      ) do
    # Get all current items ordered
    current_items =
      socket.assigns.todo_items
      |> Enum.sort_by(& &1.order)

    # Find indices
    item_index = Enum.find_index(current_items, &(&1.id == item_id))
    reference_index = Enum.find_index(current_items, &(&1.id == reference_id))

    if item_index && reference_index do
      # Calculate new order values
      new_orders =
        case position do
          "before" ->
            # Insert before reference item
            current_items
            |> List.delete_at(item_index)
            |> List.insert_at(
              if item_index < reference_index do
                reference_index - 1
              else
                reference_index
              end,
              Enum.at(current_items, item_index)
            )
            |> Enum.with_index(1)
            |> Enum.map(fn {item, new_order} -> %{id: item.id, order: new_order} end)

          "after" ->
            # Insert after reference item
            current_items
            |> List.delete_at(item_index)
            |> List.insert_at(
              if item_index < reference_index do
                reference_index
              else
                reference_index + 1
              end,
              Enum.at(current_items, item_index)
            )
            |> Enum.with_index(1)
            |> Enum.map(fn {item, new_order} -> %{id: item.id, order: new_order} end)
        end

      # Update database
      case Lists.reorder_todo_items(
             new_orders,
             socket.assigns.todo_list.id,
             socket.assigns.client_id
           ) do
        {:ok, _} ->
          broadcast_updated(socket.assigns.todo_list.id)

          # Reload the todo list
          updated_todo_list = Lists.get_todo_list_with_items!(socket.assigns.todo_list.id)

          socket =
            socket
            |> assign(:todo_list, updated_todo_list)
            |> assign(:todo_items, updated_todo_list.todo_items)
            |> reload_history()

          {:noreply, socket}

        {:error, _} ->
          {:noreply, put_flash(socket, :error, "Failed to reorder items")}
      end
    else
      {:noreply, put_flash(socket, :error, "Could not find items to reorder")}
    end
  end

  @impl true
  def handle_event("save_item", params, socket) do
    # Handle both form submit (with "text") and blur event (with "value") formats
    {id, text} =
      case params do
        %{"id" => id, "text" => text} ->
          {id, text}

        %{"id" => id, "value" => text} ->
          {id, text}

        %{"text" => text} when is_map(params) ->
          # Form submission from the form itself
          id = get_in(params, ["id"]) || socket.assigns.editing_item_id
          {id, text}
      end

    item = Enum.find(socket.assigns.todo_items, &(&1.id == id))

    # If text is empty or just whitespace, provide a default
    final_text = if String.trim(text) == "", do: "New task", else: text

    case Lists.update_todo_item(item, %{text: final_text}, socket.assigns.client_id) do
      {:ok, updated_item} ->
        broadcast_updated(socket.assigns.todo_list.id)

        # Reload the todo list to get updated latest_updated_at
        updated_todo_list = Lists.get_todo_list_with_items!(socket.assigns.todo_list.id)

        updated_items =
          Enum.map(socket.assigns.todo_items, fn
            %{id: ^id} -> updated_item
            other -> other
          end)

        socket =
          socket
          |> assign(:todo_list, updated_todo_list)
          |> assign(:todo_items, updated_items)
          |> assign(:editing_item_id, nil)
          |> reload_history()

        {:noreply, socket}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to update item")}
    end
  end

  @impl true
  def handle_event("start_focus_timer", %{"id" => id}, socket) do
    {:noreply, assign(socket, :focus_timer, %{item_id: id, timer_ref: nil, show_modal: true})}
  end

  @impl true
  def handle_event("cancel_focus_timer", _params, socket) do
    {:noreply, assign(socket, :focus_timer, %{item_id: nil, timer_ref: nil, show_modal: false})}
  end

  @impl true
  def handle_event(
        "set_focus_timer",
        %{"item_id" => id, "minutes" => min_str, "seconds" => sec_str},
        socket
      ) do
    minutes = String.to_integer(min_str || "0")
    seconds = String.to_integer(sec_str || "0")
    total_seconds = minutes * 60 + seconds

    if total_seconds > 0 do
      # Cancel existing timer if any
      if socket.assigns.focus_timer.timer_ref do
        Process.cancel_timer(socket.assigns.focus_timer.timer_ref)
      end

      # Start new timer
      timer_ref = Process.send_after(self(), {:focus_timer_complete, id}, total_seconds * 1000)
      end_time = System.system_time(:second) + total_seconds

      socket =
        socket
        |> assign(:focus_timer, %{item_id: nil, timer_ref: timer_ref, show_modal: false})
        |> assign(:focus_item_id, id)
        |> assign(:focus_end_time, end_time)

      {:noreply, socket}
    else
      {:noreply, put_flash(socket, :error, "Please enter a valid time")}
    end
  end

  @impl true
  def handle_event("stop_focus_timer", _params, socket) do
    # Cancel the timer if it exists
    if socket.assigns.focus_timer.timer_ref do
      Process.cancel_timer(socket.assigns.focus_timer.timer_ref)
    end

    socket =
      socket
      |> assign(:focus_timer, %{item_id: nil, timer_ref: nil, show_modal: false})
      |> assign(:focus_item_id, nil)
      |> assign(:focus_end_time, nil)

    {:noreply, socket}
  end

  @impl true
  def handle_info({:focus_timer_complete, item_id}, socket) do
    socket =
      socket
      |> assign(:focus_timer, %{item_id: nil, timer_ref: nil, show_modal: false})
      |> assign(:focus_item_id, nil)
      |> assign(:focus_end_time, nil)
      |> push_event("focus-complete", %{item_id: item_id, message: "Focus time complete!"})

    {:noreply, socket}
  end

  @impl true
  def handle_info(:perform_refresh, socket) do
    # Reload all data from database
    updated_todo_list = Lists.get_todo_list_with_items!(socket.assigns.todo_list.id)
    updated_history = History.get_list_history(socket.assigns.todo_list.id, limit: 20)

    socket =
      socket
      |> assign(:todo_list, updated_todo_list)
      |> assign(:todo_items, updated_todo_list.todo_items)
      |> assign(:history, updated_history)
      |> assign(:page_title, updated_todo_list.title)
      |> put_flash(:info, "List refreshed")

    # Schedule re-enabling the button after another second
    Process.send_after(self(), :enable_refresh, 1000)

    {:noreply, socket}
  end

  @impl true
  def handle_info(:enable_refresh, socket) do
    {:noreply, assign(socket, :refresh_loading, false)}
  end

  @impl true
  def handle_info({:updated, sender_pid}, socket) do
    if sender_pid == self() do
      # Ignore updates from this same process to avoid showing "another user" message
      {:noreply, socket}
    else
      # Handle as external update
      handle_info(:updated, socket)
    end
  end

  @impl true
  def handle_info(:updated, socket) do
    # Reload the full todo list from database when any change occurs
    updated_todo_list = Lists.get_todo_list_with_items!(socket.assigns.todo_list.id)

    # Reload history (limit to recent 20 entries)
    updated_history = History.get_list_history(socket.assigns.todo_list.id, limit: 20)

    # Check if user is currently editing something
    currently_editing_title = socket.assigns.editing_title
    currently_editing_item_id = socket.assigns.editing_item_id

    # Preserve editing state for items and apply optimistic locking
    {updated_items, conflict_message} =
      if currently_editing_item_id do
        # Find the item being edited in both current and updated state
        current_editing_item =
          Enum.find(socket.assigns.todo_items, &(&1.id == currently_editing_item_id))

        updated_editing_item =
          Enum.find(updated_todo_list.todo_items, &(&1.id == currently_editing_item_id))

        # Check if the item being edited was changed externally
        conflict =
          current_editing_item && updated_editing_item &&
            current_editing_item.text != updated_editing_item.text

        preserved_items =
          if current_editing_item do
            # Keep current version of editing item, update all others
            Enum.map(updated_todo_list.todo_items, fn item ->
              if item.id == currently_editing_item_id do
                current_editing_item
              else
                item
              end
            end)
          else
            updated_todo_list.todo_items
          end

        message =
          if conflict do
            "List updated by another user. Your current edit is preserved."
          else
            "List updated by another user."
          end

        {preserved_items, message}
      else
        {updated_todo_list.todo_items, "List updated by another user."}
      end

    # Only show title conflict if we're not editing the title
    title_conflict =
      not currently_editing_title and
        socket.assigns.todo_list.title != updated_todo_list.title

    socket =
      socket
      |> assign(:todo_list, updated_todo_list)
      |> assign(:todo_items, updated_items)
      |> assign(:history, updated_history)

    socket =
      if currently_editing_title do
        # Preserve current title while editing
        socket
      else
        assign(socket, :page_title, updated_todo_list.title)
      end

    # Show notification about external changes
    socket =
      if title_conflict or currently_editing_item_id do
        put_flash(socket, :info, conflict_message)
      else
        socket
      end

    {:noreply, socket}
  end

  # Helper function to format history entries for display
  defp format_history_entry(entry) do
    case entry.change_type do
      "list_created" ->
        "List created"

      "list_title_updated" ->
        old_title = get_in(entry.old_data, ["title"])
        new_title = get_in(entry.new_data, ["title"])
        "List title changed from \"#{old_title}\" to \"#{new_title}\""

      "list_deleted" ->
        "List deleted"

      "item_created" ->
        text = get_in(entry.new_data, ["text"])
        "Added task: \"#{text}\""

      "item_text_updated" ->
        old_text = get_in(entry.old_data, ["text"])
        new_text = get_in(entry.new_data, ["text"])
        "Task text changed from \"#{old_text}\" to \"#{new_text}\""

      "item_status_updated" ->
        old_status = get_in(entry.old_data, ["status"])
        new_status = get_in(entry.new_data, ["status"])

        status_text = %{
          "todo" => "Todo",
          "done" => "Done",
          "wont_do" => "Won't Do"
        }

        "Task status changed from #{status_text[old_status]} to #{status_text[new_status]}"

      "item_deleted" ->
        text = get_in(entry.old_data, ["text"])
        "Deleted task: \"#{text}\""

      "items_reordered" ->
        reorder_data = get_in(entry.new_data, ["reorder_data"])
        count = length(reorder_data || [])
        "Reordered #{count} tasks"

      _ ->
        "Unknown change: #{entry.change_type}"
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <.navbar />
    <div class="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      <.flash :if={@flash["info"]} kind={:info} flash={@flash} />
      <.flash :if={@flash["error"]} kind={:error} flash={@flash} />
      <div class="container mx-auto px-4 py-8">
        <div class="max-w-4xl mx-auto">
          <!-- Combined Todo List Card -->
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <!-- Header with Title and Action Buttons -->
              <div class="flex items-start justify-between mb-6">
                <div class="flex-1 cursor-pointer" phx-click="edit_title">
                  <%= if @editing_title do %>
                    <form phx-submit="save_title" class="w-full">
                      <input
                        type="text"
                        name="title"
                        value={@todo_list.title}
                        class="w-full bg-transparent border-0 outline-none focus:outline-none text-3xl font-bold cursor-pointer p-0 m-0 font-inherit leading-inherit"
                        phx-keydown="key_down"
                        phx-blur="save_title"
                        phx-hook="FocusInput"
                        id="title-input"
                      />
                    </form>
                  <% else %>
                    <h1 class="text-3xl font-bold">
                      {@todo_list.title}
                    </h1>
                  <% end %>
                </div>

                <div class="flex items-center gap-3">
                  <button
                    phx-click="add_item"
                    class="btn btn-circle btn-primary bg-orange-500 border-orange-500 hover:bg-orange-600 hover:border-orange-600"
                    title="Add new task"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                  <button
                    phx-click="refresh"
                    class={[
                      "btn btn-circle btn-primary",
                      @refresh_loading && "loading btn-disabled opacity-50",
                      !@refresh_loading &&
                        "bg-orange-500 border-orange-500 hover:bg-orange-600 hover:border-orange-600"
                    ]}
                    disabled={@refresh_loading}
                    title={if @refresh_loading, do: "Refreshing...", else: "Refresh list"}
                  >
                    <%= if !@refresh_loading do %>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    <% end %>
                  </button>
                  <button
                    phx-click="copy_share_link"
                    class="btn btn-circle btn-primary bg-orange-500 border-orange-500 hover:bg-orange-600 hover:border-orange-600"
                    phx-hook="CopyToClipboard"
                    id="share-button"
                    data-url={url(~p"/tl/#{@todo_list.id}")}
                    title="Share this list"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              
    <!-- Todo Items List -->
              <div class="space-y-2 min-h-[100px]" phx-hook="DragDrop" id="todo-items-container">
                <%= if @todo_items == [] do %>
                  <div class="text-center py-12 text-gray-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-16 w-16 mx-auto mb-4 text-gray-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <p class="text-lg">No todo items yet</p>
                    <p class="text-sm">Click the + button to add your first task!</p>
                  </div>
                <% else %>
                  <%= for item <- @todo_items do %>
                    <div
                      class={[
                        "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                        item.status == :done && "bg-green-50 border-green-200",
                        item.status == :wont_do && "bg-red-50 border-red-200 opacity-75",
                        item.status == :todo && "bg-white border-gray-200 hover:border-orange-300",
                        @editing_item_id == item.id &&
                          "bg-orange-50 border-orange-300 ring-2 ring-orange-200"
                      ]}
                      data-draggable
                      data-item-id={item.id}
                      phx-click="edit_item"
                      phx-value-id={item.id}
                    >
                      <!-- Drag Handle -->
                      <div
                        class="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                        data-drag-handle
                        phx-click="prevent_edit"
                        title="Drag to reorder"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <circle cx="5" cy="5" r="2" />
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="19" cy="5" r="2" />
                          <circle cx="5" cy="12" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="19" cy="12" r="2" />
                          <circle cx="5" cy="19" r="2" />
                          <circle cx="12" cy="19" r="2" />
                          <circle cx="19" cy="19" r="2" />
                        </svg>
                      </div>
                      
    <!-- Checkbox/Status Toggle -->
                      <button
                        phx-click="toggle_status"
                        phx-value-id={item.id}
                        class={[
                          "flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
                          item.status == :done && "bg-green-500 border-green-500",
                          item.status == :wont_do && "bg-red-500 border-red-500 hover:bg-red-600",
                          item.status == :todo && "border-gray-400 hover:border-orange-500"
                        ]}
                        disabled={false}
                      >
                        <%= if item.status == :done do %>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="3"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        <% end %>
                        <%= if item.status == :wont_do do %>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="3"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        <% end %>
                      </button>
                      
    <!-- Item Text -->
                      <div class="flex-1">
                        <%= if @editing_item_id == item.id do %>
                          <form phx-submit="save_item" phx-value-id={item.id} class="flex-1">
                            <input
                              type="text"
                              name="text"
                              value={item.text}
                              class={[
                                "w-full bg-transparent border-0 outline-none focus:outline-none cursor-pointer",
                                "p-0 m-0 font-inherit leading-inherit",
                                item.status == :todo && "text-gray-900",
                                item.status == :done && "line-through text-gray-500",
                                item.status == :wont_do && "line-through text-red-600"
                              ]}
                              phx-blur="save_item"
                              phx-value-id={item.id}
                              phx-hook="FocusInput"
                              id={"edit-item-#{item.id}"}
                            />
                          </form>
                        <% else %>
                          <span class={[
                            item.status == :todo && "text-gray-900",
                            item.status == :done && "line-through text-gray-500",
                            item.status == :wont_do && "line-through text-red-600"
                          ]}>
                            {item.text}
                          </span>
                        <% end %>
                      </div>
                      
    <!-- Action Buttons -->
                      <div class="flex gap-1">
                        <!-- Focus Timer Button -->
                        <%= if @focus_item_id != item.id do %>
                          <button
                            phx-click="start_focus_timer"
                            phx-value-id={item.id}
                            class="btn btn-ghost btn-xs text-gray-500 hover:text-blue-600 px-1 py-3"
                            title="Start focus timer"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </button>
                        <% end %>

                        <%= if item.status != :wont_do do %>
                          <button
                            phx-click="soft_delete"
                            phx-value-id={item.id}
                            class="btn btn-ghost btn-xs text-gray-500 hover:text-orange-600 px-1 py-3"
                            title="Mark as won't do"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                              />
                            </svg>
                          </button>
                        <% else %>
                          <%= if @confirming_delete_id == item.id do %>
                            <button
                              phx-click="hard_delete"
                              phx-value-id={item.id}
                              class="btn btn-ghost btn-xs text-red-600 hover:text-red-700 font-semibold"
                              title="Confirm permanent deletion"
                            >
                              Confirm Delete
                            </button>
                            <button
                              phx-click="cancel_delete"
                              class="btn btn-ghost btn-xs text-gray-500 hover:text-gray-700"
                              title="Cancel deletion"
                            >
                              Cancel
                            </button>
                          <% else %>
                            <button
                              phx-click="confirm_hard_delete"
                              phx-value-id={item.id}
                              class="btn btn-ghost btn-xs text-gray-500 hover:text-orange-600 px-1 py-3"
                              title="Delete permanently"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          <% end %>
                        <% end %>
                      </div>
                    </div>
                  <% end %>
                <% end %>
              </div>
              
    <!-- Footer with Metadata and Actions -->
              <div class="mt-8 pt-6 border-t border-gray-200">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div class="flex flex-col sm:flex-row gap-4 sm:gap-6 text-sm text-gray-600">
                    <div>
                      <span class="font-semibold">Created:</span>
                      {Calendar.strftime(@todo_list.inserted_at, "%B %d, %Y at %I:%M %p")}
                    </div>
                    <div>
                      <span class="font-semibold">Last updated:</span>
                      {Calendar.strftime(@todo_list.latest_updated_at, "%B %d, %Y at %I:%M %p")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
    <!-- History Section -->
        <div class="max-w-4xl mx-auto mt-12 mb-8">
          <div class="bg-orange-100/60 px-6 py-6">
            <h2 class="text-base font-normal text-gray-600 mb-4">Recent Changes</h2>

            <%= if @history == [] do %>
              <p class="text-gray-500 text-sm">No changes yet</p>
            <% else %>
              <div class="space-y-1.5">
                <%= for entry <- @history do %>
                  <div class="text-sm text-gray-600 flex items-center justify-between py-1">
                    <span class="text-gray-700">
                      {format_history_entry(entry)}
                    </span>
                    <span class="text-xs text-gray-500 ml-4 flex-shrink-0">
                      {Calendar.strftime(entry.inserted_at, "%m/%d %I:%M %p")}
                    </span>
                  </div>
                <% end %>
              </div>
            <% end %>
          </div>
        </div>
      </div>
    </div>

    <!-- Focus Timer Modal -->
    <%= if @focus_timer.show_modal do %>
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
          <h3 class="text-lg font-semibold mb-4">Set Focus Timer</h3>
          <form phx-submit="set_focus_timer" phx-value-item_id={@focus_timer.item_id}>
            <div class="flex gap-2 mb-4">
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-1">Minutes</label>
                <input
                  type="number"
                  name="minutes"
                  min="0"
                  max="99"
                  value="5"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
              <div class="flex-1">
                <label class="block text-sm font-medium text-gray-700 mb-1">Seconds</label>
                <input
                  type="number"
                  name="seconds"
                  min="0"
                  max="59"
                  value="0"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
              </div>
            </div>
            <div class="flex gap-2">
              <button
                type="submit"
                class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Start Timer
              </button>
              <button
                type="button"
                phx-click="cancel_focus_timer"
                class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    <% end %>

    <!-- Focus Mode -->
    <%= if @focus_item_id do %>
      <div class="fixed inset-0 bg-gray-500 z-50 flex items-center justify-center" id="focus-mode">
        <div class="text-center">
          <h1 class="text-4xl font-bold text-white mb-8">
            {Enum.find(@todo_items, &(&1.id == @focus_item_id)).text}
          </h1>
          <div
            class="text-6xl font-mono text-white mb-8"
            phx-hook="FocusCountdown"
            id="countdown-timer"
            data-end-time={@focus_end_time}
          >
            --:--
          </div>
          <button
            phx-click="stop_focus_timer"
            class="bg-white text-gray-800 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Stop Focus
          </button>
        </div>
      </div>
      <style>
        body { background-color: #6b7280 !important; }
      </style>
    <% end %>
    """
  end
end
