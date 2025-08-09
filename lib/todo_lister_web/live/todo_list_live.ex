defmodule TodoListerWeb.TodoListLive do
  use TodoListerWeb, :live_view

  alias TodoLister.Lists

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    try do
      todo_list = Lists.get_todo_list!(id)
      
      socket =
        socket
        |> assign(:todo_list, todo_list)
        |> assign(:editing_title, false)
        |> assign(:page_title, todo_list.title)

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

          <!-- Todo Items Section (Placeholder) -->
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <h2 class="card-title">Todo Items</h2>
              <div class="text-center py-12 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p class="text-lg">No todo items yet</p>
                <p class="text-sm">Start by adding your first task!</p>
                <button class="btn btn-primary mt-4 bg-orange-500 border-orange-500 hover:bg-orange-600 hover:border-orange-600">
                  Add First Task
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    """
  end
end