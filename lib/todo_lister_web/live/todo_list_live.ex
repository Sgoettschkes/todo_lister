defmodule TodoListerWeb.TodoListLive do
  use TodoListerWeb, :live_view

  alias TodoLister.Lists

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    try do
      todo_list = Lists.get_todo_list_with_items!(id)
      
      socket =
        socket
        |> assign(:todo_list, todo_list)
        |> assign(:editing_title, false)
        |> assign(:page_title, todo_list.title)
        |> assign(:todo_items, todo_list.todo_items)
        |> assign(:editing_item_id, nil)
        |> assign(:confirming_delete_id, nil)

      {:ok, socket}
    rescue
      Ecto.NoResultsError ->
        {:ok, socket |> put_flash(:error, "Todo list not found") |> push_navigate(to: ~p"/")}
    end
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
    
    case Lists.update_todo_list(socket.assigns.todo_list, %{title: title}) do
      {:ok, updated_todo_list} ->
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
    # Create a new item with placeholder text and immediately put it in edit mode
    case Lists.create_todo_item(socket.assigns.todo_list, %{text: "New task"}) do
      {:ok, new_item} ->
        socket =
          socket
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

    case Lists.update_todo_item(item, %{status: new_status}) do
      {:ok, updated_item} ->
        updated_items = Enum.map(socket.assigns.todo_items, fn
          %{id: ^id} -> updated_item
          other -> other
        end)

        {:noreply, assign(socket, :todo_items, updated_items)}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to update status")}
    end
  end

  @impl true
  def handle_event("soft_delete", %{"id" => id}, socket) do
    item = Enum.find(socket.assigns.todo_items, &(&1.id == id))

    case Lists.update_todo_item(item, %{status: :wont_do}) do
      {:ok, updated_item} ->
        updated_items = Enum.map(socket.assigns.todo_items, fn
          %{id: ^id} -> updated_item
          other -> other
        end)

        {:noreply, assign(socket, :todo_items, updated_items)}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to mark as won't do")}
    end
  end

  @impl true
  def handle_event("confirm_hard_delete", %{"id" => id}, socket) do
    item = Enum.find(socket.assigns.todo_items, &(&1.id == id))
    
    socket = 
      socket
      |> assign(:confirming_delete_id, id)
      |> put_flash(:info, "Click 'Confirm Delete' again to permanently delete '#{item.text}'")
    
    {:noreply, socket}
  end

  @impl true
  def handle_event("hard_delete", %{"id" => id}, socket) do
    item = Enum.find(socket.assigns.todo_items, &(&1.id == id))

    case Lists.delete_todo_item(item) do
      {:ok, _deleted_item} ->
        updated_items = Enum.reject(socket.assigns.todo_items, &(&1.id == id))
        
        socket =
          socket
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
  def handle_event("edit_item", %{"id" => id}, socket) do
    {:noreply, assign(socket, :editing_item_id, id)}
  end

  @impl true
  def handle_event("cancel_edit_item", _params, socket) do
    {:noreply, assign(socket, :editing_item_id, nil)}
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
    
    case Lists.update_todo_item(item, %{text: text}) do
      {:ok, updated_item} ->
        updated_items = Enum.map(socket.assigns.todo_items, fn
          %{id: ^id} -> updated_item
          other -> other
        end)

        socket =
          socket
          |> assign(:todo_items, updated_items)
          |> assign(:editing_item_id, nil)

        {:noreply, socket}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to update item")}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      <.flash :if={@flash["info"]} kind={:info} flash={@flash} />
      <.flash :if={@flash["error"]} kind={:error} flash={@flash} />
      <div class="container mx-auto px-4 py-8">
        <div class="max-w-4xl mx-auto">
          <!-- Header Section -->
          <div class="card bg-base-100 shadow-xl mb-8">
            <div class="card-body">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <%= if @editing_title do %>
                    <form phx-submit="save_title">
                      <input
                        type="text"
                        name="title"
                        value={@todo_list.title}
                        class="input input-lg w-full bg-transparent border-0 text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                        phx-keydown="key_down"
                        phx-blur="save_title"
                        phx-hook="FocusInput"
                        id="title-input"
                        autofocus
                      />
                    </form>
                  <% else %>
                    <h1 
                      class="text-3xl font-bold cursor-pointer hover:text-orange-600 transition-colors"
                      phx-click="edit_title"
                    >
                      <%= @todo_list.title %>
                      <span class="text-gray-400 text-lg ml-2">✏️</span>
                    </h1>
                  <% end %>
                </div>
                
                <div class="flex gap-2">
                  <button 
                    phx-click="copy_share_link" 
                    class="btn btn-outline btn-sm"
                    phx-hook="CopyToClipboard"
                    id="share-button"
                    data-url={url(~p"/tl/#{@todo_list.id}")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a9.001 9.001 0 01-7.432 0m9.032-4.026A9.001 9.001 0 0112 3c-4.474 0-8.268 3.12-9.032 7.326m0 0A9.001 9.001 0 0012 21c4.474 0 8.268-3.12 9.032-7.326" />
                    </svg>
                    Share
                  </button>
                  <.link navigate={~p"/"} class="btn btn-ghost btn-sm">
                    ← Back to Home
                  </.link>
                </div>
              </div>
              
              <!-- Metadata -->
              <div class="divider"></div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span class="font-semibold">Created:</span>
                  <%= Calendar.strftime(@todo_list.inserted_at, "%B %d, %Y at %I:%M %p") %>
                </div>
                <div>
                  <span class="font-semibold">Last updated:</span>
                  <%= Calendar.strftime(@todo_list.updated_at, "%B %d, %Y at %I:%M %p") %>
                </div>
              </div>
            </div>
          </div>

          <!-- Todo Items Section -->
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <!-- Add New Item Button -->
              <div class="mb-6 flex justify-between items-center">
                <h2 class="card-title">Todo Items</h2>
                <button 
                  phx-click="add_item"
                  class="btn btn-circle btn-primary bg-orange-500 border-orange-500 hover:bg-orange-600 hover:border-orange-600"
                  title="Add new task"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              <!-- Todo Items List -->
              <div class="space-y-2">
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
                      item.status == :todo && "bg-white border-gray-200 hover:border-orange-300"
                    ]}
                    phx-click="edit_item"
                    phx-value-id={item.id}>
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
                            class="btn btn-ghost btn-xs text-gray-500 hover:text-red-600"
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
                              class="btn btn-ghost btn-xs text-gray-500 hover:text-red-600"
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
            </div>
          </div>
        </div>
      </div>
    </div>
    """
  end
end