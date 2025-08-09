defmodule TodoListerWeb.LandingLive do
  use TodoListerWeb, :live_view

  alias TodoLister.Lists

  @impl true
  def mount(_params, _session, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_event("create_list", _params, socket) do
    case Lists.create_todo_list(%{title: "New Todo List"}) do
      {:ok, todo_list} ->
        {:noreply, push_navigate(socket, to: ~p"/tl/#{todo_list.id}")}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to create todo list")}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      <div class="container mx-auto px-4 py-16">
        <div class="max-w-6xl mx-auto">
          <div class="hero mb-12">
            <div class="hero-content text-center">
              <div>
                <h1 class="text-6xl font-bold text-orange-600 mb-4">
                  TodoLister
                </h1>
                <p class="text-2xl text-gray-700 mb-8">
                  Real-time collaborative todo lists powered by Phoenix LiveView
                </p>
                <div class="flex justify-center gap-4">
                  <button phx-click="create_list" class="btn btn-primary bg-orange-500 border-orange-500 hover:bg-orange-600 hover:border-orange-600 text-white">
                    Create New List
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="card shadow-2xl mt-16">
            <figure>
              <img
                src="https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=1200&h=600&fit=crop"
                alt="Collaborative workspace"
                class="w-full h-96 object-cover"
              />
            </figure>
          </div>

          <div class="mt-16 grid md:grid-cols-3 gap-8">
            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <div class="text-orange-500 mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h2 class="card-title">Real-time Updates</h2>
                <p>See changes instantly as your team updates the todo list. No refresh needed.</p>
              </div>
            </div>

            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <div class="text-orange-500 mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <h2 class="card-title">Collaborative</h2>
                <p>
                  Share your list with anyone. Work together seamlessly without accounts or sign-ups.
                </p>
              </div>
            </div>

            <div class="card bg-base-100 shadow-xl">
              <div class="card-body">
                <div class="text-orange-500 mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 class="card-title">Simple & Fast</h2>
                <p>
                  No complex setup required. Just create a list and start collaborating immediately.
                </p>
              </div>
            </div>
          </div>

          <div class="mt-16">
            <h2 class="text-3xl font-bold text-gray-800 mb-8 text-center">How It Works</h2>
            <div class="steps steps-vertical lg:steps-horizontal w-full">
              <div class="step step-primary" data-content="1">
                <div class="step-content text-gray-800">
                  <h3 class="font-bold text-lg">Create or Join</h3>
                  <p class="text-sm text-gray-600 mt-1">
                    Start a new list
                  </p>
                </div>
              </div>
              <div class="step step-primary" data-content="2">
                <div class="step-content text-gray-800">
                  <h3 class="font-bold text-lg">Add Tasks</h3>
                  <p class="text-sm text-gray-600 mt-1">Add, edit, and complete tasks in real-time</p>
                </div>
              </div>
              <div class="step step-primary" data-content="3">
                <div class="step-content text-gray-800">
                  <h3 class="font-bold text-lg">Collaborate</h3>
                  <p class="text-sm text-gray-600 mt-1">
                    Share the code with others to work together
                  </p>
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
