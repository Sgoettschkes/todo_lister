defmodule TodoListerWeb.TodoListLive do
  use TodoListerWeb, :live_view

  alias TodoLister.Lists

  # Helper function to broadcast updates to all clients except the sender
  defp broadcast_updated(todo_list_id) do
    Phoenix.PubSub.broadcast(
      TodoLister.PubSub,
      "todo_list:#{todo_list_id}",
      {:updated, self()}
    )
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
    
    socket =
      socket
      |> assign(:todo_list, todo_list)
      |> assign(:editing_title, false)
      |> assign(:page_title, todo_list.title)
      |> assign(:todo_items, todo_list.todo_items)
      |> assign(:editing_item_id, nil)
      |> assign(:confirming_delete_id, nil)
      |> assign(:client_id, client_id)

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
    title = case params do
      %{"title" => title} -> title
      %{"value" => title} -> title
      _ -> socket.assigns.todo_list.title
    end
    
    case Lists.update_todo_list(socket.assigns.todo_list, %{title: title}, socket.assigns.client_id) do
      {:ok, updated_todo_list} ->
        broadcast_updated(updated_todo_list.id)
        
        socket =
          socket
          |> assign(:todo_list, updated_todo_list)
          |> assign(:editing_title, false)
          |> assign(:page_title, updated_todo_list.title)
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
    {:noreply, put_flash(socket, :info, "Link copied! Share this URL with others to collaborate.")}
  end

  @impl true
  def handle_event("add_item", _params, socket) do
    # Create a new item and immediately put it in edit mode
    case Lists.create_todo_item(socket.assigns.todo_list, %{text: "New task"}, socket.assigns.client_id) do
      {:ok, new_item} ->
        broadcast_updated(socket.assigns.todo_list.id)
        
        # Reload the todo list to get updated latest_updated_at
        updated_todo_list = Lists.get_todo_list_with_items!(socket.assigns.todo_list.id)
        
        socket =
          socket
          |> assign(:todo_list, updated_todo_list)
          |> assign(:todo_items, socket.assigns.todo_items ++ [new_item])
          |> assign(:editing_item_id, new_item.id)

        {:noreply, socket}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to add item")}
    end
  end

  @impl true
  def handle_event("toggle_status", %{"id" => id}, socket) do
    item = Enum.find(socket.assigns.todo_items, &(&1.id == id))
    
    new_status = case item.status do
      :todo -> :done
      :done -> :todo
      :wont_do -> :todo
    end

    case Lists.update_todo_item(item, %{status: new_status}, socket.assigns.client_id) do
      {:ok, updated_item} ->
        broadcast_updated(socket.assigns.todo_list.id)
        
        # Reload the todo list to get updated latest_updated_at
        updated_todo_list = Lists.get_todo_list_with_items!(socket.assigns.todo_list.id)
        
        updated_items = Enum.map(socket.assigns.todo_items, fn
          %{id: ^id} -> updated_item
          other -> other
        end)

        socket =
          socket
          |> assign(:todo_list, updated_todo_list)
          |> assign(:todo_items, updated_items)
          
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
        
        updated_items = Enum.map(socket.assigns.todo_items, fn
          %{id: ^id} -> updated_item
          other -> other
        end)

        socket =
          socket
          |> assign(:todo_list, updated_todo_list)
          |> assign(:todo_items, updated_items)
          
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
  def handle_event("reorder_item", %{"item_id" => item_id, "reference_id" => reference_id, "position" => position}, socket) do
    # Get all current items ordered
    current_items = socket.assigns.todo_items
    |> Enum.sort_by(& &1.order)
    
    # Find indices
    item_index = Enum.find_index(current_items, &(&1.id == item_id))
    reference_index = Enum.find_index(current_items, &(&1.id == reference_id))
    
    if item_index && reference_index do
      # Calculate new order values
      new_orders = case position do
        "before" ->
          # Insert before reference item
          current_items
          |> List.delete_at(item_index)
          |> List.insert_at(if item_index < reference_index do reference_index - 1 else reference_index end, Enum.at(current_items, item_index))
          |> Enum.with_index(1)
          |> Enum.map(fn {item, new_order} -> %{id: item.id, order: new_order} end)
        
        "after" ->
          # Insert after reference item
          current_items
          |> List.delete_at(item_index)
          |> List.insert_at(if item_index < reference_index do reference_index else reference_index + 1 end, Enum.at(current_items, item_index))
          |> Enum.with_index(1)
          |> Enum.map(fn {item, new_order} -> %{id: item.id, order: new_order} end)
      end
      
      # Update database
      case Lists.reorder_todo_items(new_orders, socket.assigns.todo_list.id, socket.assigns.client_id) do
        {:ok, _} ->
          broadcast_updated(socket.assigns.todo_list.id)
          
          # Reload the todo list
          updated_todo_list = Lists.get_todo_list_with_items!(socket.assigns.todo_list.id)
          
          socket =
            socket
            |> assign(:todo_list, updated_todo_list)
            |> assign(:todo_items, updated_todo_list.todo_items)
          
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
    {id, text} = case params do
      %{"id" => id, "text" => text} -> {id, text}
      %{"id" => id, "value" => text} -> {id, text}
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
        
        updated_items = Enum.map(socket.assigns.todo_items, fn
          %{id: ^id} -> updated_item
          other -> other
        end)

        socket =
          socket
          |> assign(:todo_list, updated_todo_list)
          |> assign(:todo_items, updated_items)
          |> assign(:editing_item_id, nil)

        {:noreply, socket}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to update item")}
    end
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
    
    # Check if user is currently editing something
    currently_editing_title = socket.assigns.editing_title
    currently_editing_item_id = socket.assigns.editing_item_id
    
    # Preserve editing state for items and apply optimistic locking
    {updated_items, conflict_message} = if currently_editing_item_id do
      # Find the item being edited in both current and updated state
      current_editing_item = Enum.find(socket.assigns.todo_items, &(&1.id == currently_editing_item_id))
      updated_editing_item = Enum.find(updated_todo_list.todo_items, &(&1.id == currently_editing_item_id))
      
      # Check if the item being edited was changed externally
      conflict = current_editing_item && updated_editing_item && 
                 current_editing_item.text != updated_editing_item.text
      
      preserved_items = if current_editing_item do
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
      
      message = if conflict do
        "List updated by another user. Your current edit is preserved."
      else
        "List updated by another user."
      end
      
      {preserved_items, message}
    else
      {updated_todo_list.todo_items, "List updated by another user."}
    end
    
    # Only show title conflict if we're not editing the title
    title_conflict = not currently_editing_title and 
                     socket.assigns.todo_list.title != updated_todo_list.title
    
    socket =
      socket
      |> assign(:todo_list, updated_todo_list)
      |> assign(:todo_items, updated_items)
      
    socket = if currently_editing_title do
      # Preserve current title while editing
      socket
    else
      assign(socket, :page_title, updated_todo_list.title)
    end
    
    # Show notification about external changes
    socket = if title_conflict or currently_editing_item_id do
      put_flash(socket, :info, conflict_message)
    else
      socket
    end
    
    {:noreply, socket}
  end

  @impl true
  def render(assigns) do
    ~H"""
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
                      <%= @todo_list.title %>
                    </h1>
                  <% end %>
                </div>
                
                <div class="flex items-center gap-3">
                  <button 
                    phx-click="add_item"
                    class="btn btn-circle btn-primary bg-orange-500 border-orange-500 hover:bg-orange-600 hover:border-orange-600"
                    title="Add new task"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button 
                    phx-click="copy_share_link" 
                    class="btn btn-circle btn-primary bg-orange-500 border-orange-500 hover:bg-orange-600 hover:border-orange-600"
                    phx-hook="CopyToClipboard"
                    id="share-button"
                    data-url={url(~p"/tl/#{@todo_list.id}")}
                    title="Share this list"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Todo Items List -->
              <div class="space-y-2 min-h-[100px]" phx-hook="DragDrop" id="todo-items-container">
                <%= if @todo_items == [] do %>
                  <div class="text-center py-12 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p class="text-lg">No todo items yet</p>
                    <p class="text-sm">Click the + button to add your first task!</p>
                  </div>
                <% else %>
                  <%= for item <- @todo_items do %>
                    <div class={[
                      "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                      item.status == :done && "bg-green-50 border-green-200",
                      item.status == :wont_do && "bg-red-50 border-red-200 opacity-75",
                      item.status == :todo && "bg-white border-gray-200 hover:border-orange-300",
                      @editing_item_id == item.id && "bg-orange-50 border-orange-300 ring-2 ring-orange-200"
                    ]}
                    data-draggable
                    data-item-id={item.id}
                    phx-click="edit_item"
                    phx-value-id={item.id}>
                      <!-- Drag Handle -->
                      <div class="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors" 
                           data-drag-handle 
                           phx-click="prevent_edit"
                           title="Drag to reorder">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="5" cy="5" r="2"/>
                          <circle cx="12" cy="5" r="2"/>
                          <circle cx="19" cy="5" r="2"/>
                          <circle cx="5" cy="12" r="2"/>
                          <circle cx="12" cy="12" r="2"/>
                          <circle cx="19" cy="12" r="2"/>
                          <circle cx="5" cy="19" r="2"/>
                          <circle cx="12" cy="19" r="2"/>
                          <circle cx="19" cy="19" r="2"/>
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
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                          </svg>
                        <% end %>
                        <%= if item.status == :wont_do do %>
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
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
                          <span 
                            class={[
                              item.status == :todo && "text-gray-900",
                              item.status == :done && "line-through text-gray-500",
                              item.status == :wont_do && "line-through text-red-600"
                            ]}
                          >
                            <%= item.text %>
                          </span>
                        <% end %>
                      </div>

                      <!-- Action Buttons -->
                      <div class="flex gap-1">
                        <%= if item.status != :wont_do do %>
                          <button 
                            phx-click="soft_delete" 
                            phx-value-id={item.id}
                            class="btn btn-ghost btn-xs text-gray-500 hover:text-orange-600 px-1 py-3"
                            title="Mark as won't do"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
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
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                      <%= Calendar.strftime(@todo_list.inserted_at, "%B %d, %Y at %I:%M %p") %>
                    </div>
                    <div>
                      <span class="font-semibold">Last updated:</span>
                      <%= Calendar.strftime(@todo_list.latest_updated_at, "%B %d, %Y at %I:%M %p") %>
                    </div>
                  </div>
                  
                  <.link navigate={~p"/"} class="btn btn-ghost btn-sm">
                    ← Back to Home
                  </.link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    """
  end
end