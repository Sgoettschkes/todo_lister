defmodule TodoListerWeb.ErrorHTML do
  @moduledoc """
  This module is invoked by your endpoint in case of errors on HTML requests.

  See config/config.exs.
  """
  use TodoListerWeb, :html

  # If you want to customize your error pages,
  # uncomment the embed_templates/1 call below
  # and add pages to the error directory:
  #
  #   * lib/todo_lister_web/controllers/error_html/404.html.heex
  #   * lib/todo_lister_web/controllers/error_html/500.html.heex
  #
  embed_templates "error_html/*"

  # Handle specific error cases
  def render(template, assigns) do
    case template do
      "404.html" ->
        # Use our custom 404 template
        render("404.html.heex", assigns)

      "400.html" ->
        # Use our custom 400 template
        render("400.html.heex", assigns)

      _ ->
        # The default is to render a plain text page based on
        # the template name. For example, "500.html" becomes
        # "Internal Server Error".
        Phoenix.Controller.status_message_from_template(template)
    end
  end
end
