// If you want to use Phoenix channels, run `mix help phx.gen.channel`
// to get started and then uncomment the line below.
// import "./user_socket.js"

// You can include dependencies in two ways.
//
// The simplest option is to put them in assets/vendor and
// import them using relative paths:
//
//     import "../vendor/some-package.js"
//
// Alternatively, you can `npm install some-package --prefix assets` and import
// them using a path starting with the package name:
//
//     import "some-package"
//
// If you have dependencies that try to import CSS, esbuild will generate a separate `app.css` file.
// To load it, simply add a second `<link>` to your `root.html.heex` file.

// Include phoenix_html to handle method=PUT/DELETE in forms and buttons.
import "phoenix_html"
// Establish Phoenix Socket and LiveView configuration.
import {Socket} from "phoenix"
import {LiveSocket} from "phoenix_live_view"
import {hooks as colocatedHooks} from "phoenix-colocated/todo_lister"
import topbar from "../vendor/topbar"

// Generate or retrieve client ID from localStorage
function getOrCreateClientId() {
  let clientId = localStorage.getItem('todo_client_id')
  if (!clientId) {
    // Generate a UUID v4 compatible string (same format as Ecto binary_id)
    clientId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
    localStorage.setItem('todo_client_id', clientId)
  }
  return clientId
}

// Make client ID available globally
window.clientId = getOrCreateClientId()

const Hooks = {
  FocusInput: {
    mounted() {
      this.el.focus()
      // If the value is "New task" (default for new items), clear it and select all
      if (this.el.value.trim() === "" || this.el.value === "New task") {
        this.el.value = ""
        this.el.select()
      } else {
        // Place cursor at the end of the text instead of selecting all
        const length = this.el.value.length
        this.el.setSelectionRange(length, length)
      }
    }
  },
  CopyToClipboard: {
    mounted() {
      this.el.addEventListener("click", (e) => {
        e.preventDefault()
        const url = this.el.dataset.url
        
        // Try to use the modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => {
            // Success is handled by the server-side event
          }).catch(() => {
            // Fallback to the old method
            this.fallbackCopy(url)
          })
        } else {
          // Fallback for older browsers
          this.fallbackCopy(url)
        }
      })
    },
    
    fallbackCopy(text) {
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      try {
        document.execCommand('copy')
      } catch (err) {
        console.error('Failed to copy: ', err)
      }
      
      document.body.removeChild(textArea)
    }
  },
  DragDrop: {
    mounted() {
      this.initializeDragDrop()
    },
    
    updated() {
      this.initializeDragDrop()
    },
    
    initializeDragDrop() {
      const container = this.el
      let draggedElement = null
      let placeholder = null
      
      // Add CSS for smooth transitions
      const style = document.createElement('style')
      style.textContent = `
        .drag-transition {
          transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .drag-placeholder {
          opacity: 0.5;
          background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
          border: 2px dashed #f97316;
          min-height: 60px;
          margin: 2px 0;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ea580c;
          font-size: 14px;
        }
        .dragging-item {
          opacity: 0.8;
          transform: rotate(3deg);
          z-index: 1000;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        }
      `
      if (!document.querySelector('#drag-drop-styles')) {
        style.id = 'drag-drop-styles'
        document.head.appendChild(style)
      }
      
      // Make items draggable only from drag handle
      container.querySelectorAll('[data-draggable]').forEach(item => {
        const dragHandle = item.querySelector('[data-drag-handle]')
        
        item.classList.add('drag-transition')
        
        if (dragHandle) {
          // Make the drag handle itself draggable
          dragHandle.draggable = true
          
          dragHandle.addEventListener('dragstart', (e) => {
            draggedElement = item
            item.classList.add('dragging-item')
            
            // Create placeholder
            placeholder = document.createElement('div')
            placeholder.className = 'drag-placeholder'
            placeholder.innerHTML = '↕ Drop here'
            
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/html', item.outerHTML)
            
            // Hide original item after drag starts
            setTimeout(() => {
              item.style.display = 'none'
            }, 0)
            
            // Prevent the click from bubbling up to trigger edit
            e.stopPropagation()
          })
          
          dragHandle.addEventListener('dragend', (e) => {
            // Clean up
            item.classList.remove('dragging-item')
            item.style.display = ''
            
            if (placeholder && placeholder.parentNode) {
              placeholder.remove()
            }
            
            draggedElement = null
            placeholder = null
          })
        }
        
        // The drag events are now handled on the drag handle
        
        item.addEventListener('dragover', (e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          
          if (draggedElement && item !== draggedElement && placeholder) {
            const rect = item.getBoundingClientRect()
            const midY = rect.top + rect.height / 2
            
            // Remove placeholder from current position
            if (placeholder.parentNode) {
              placeholder.remove()
            }
            
            // Insert placeholder in new position
            if (e.clientY < midY) {
              item.parentNode.insertBefore(placeholder, item)
            } else {
              item.parentNode.insertBefore(placeholder, item.nextSibling)
            }
          }
        })
        
        item.addEventListener('drop', (e) => {
          e.preventDefault()
          
          if (draggedElement && placeholder) {
            // Move the actual element optimistically
            const dropPosition = placeholder.nextSibling
            placeholder.remove()
            
            // Insert the dragged element in the new position
            draggedElement.style.display = ''
            if (dropPosition) {
              container.insertBefore(draggedElement, dropPosition)
            } else {
              container.appendChild(draggedElement)
            }
            
            // Find target element for server update
            let targetElement, position
            if (dropPosition) {
              targetElement = dropPosition
              position = 'before'
            } else {
              // Dropped at the end, find the previous element
              const allItems = Array.from(container.querySelectorAll('[data-draggable]'))
              const draggedIndex = allItems.indexOf(draggedElement)
              if (draggedIndex > 0) {
                targetElement = allItems[draggedIndex - 1]
                position = 'after'
              }
            }
            
            // Send to server
            if (targetElement && targetElement.dataset.itemId) {
              this.pushEvent("reorder_item", {
                item_id: draggedElement.dataset.itemId,
                reference_id: targetElement.dataset.itemId,
                position: position
              })
            }
          }
        })
        
        // Handle container drop for empty areas
        container.addEventListener('dragover', (e) => {
          e.preventDefault()
        })
        
        container.addEventListener('drop', (e) => {
          if (e.target === container && draggedElement && placeholder) {
            // Dropped in empty space, put at end
            placeholder.remove()
            container.appendChild(draggedElement)
            draggedElement.style.display = ''
            
            // Find previous element
            const allItems = Array.from(container.querySelectorAll('[data-draggable]'))
            const draggedIndex = allItems.indexOf(draggedElement)
            if (draggedIndex > 0) {
              const prevElement = allItems[draggedIndex - 1]
              this.pushEvent("reorder_item", {
                item_id: draggedElement.dataset.itemId,
                reference_id: prevElement.dataset.itemId,
                position: 'after'
              })
            }
          }
        })
      })
    }
  }
}

const csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content")
const liveSocket = new LiveSocket("/live", Socket, {
  longPollFallbackMs: 2500,
  params: {_csrf_token: csrfToken, client_id: window.clientId},
  hooks: {...colocatedHooks, ...Hooks},
})

// Show progress bar on live navigation and form submits
topbar.config({barColors: {0: "#29d"}, shadowColor: "rgba(0, 0, 0, .3)"})
window.addEventListener("phx:page-loading-start", _info => topbar.show(300))
window.addEventListener("phx:page-loading-stop", _info => topbar.hide())

// connect if there are any LiveViews on the page
liveSocket.connect()

// expose liveSocket on window for web console debug logs and latency simulation:
// >> liveSocket.enableDebug()
// >> liveSocket.enableLatencySim(1000)  // enabled for duration of browser session
// >> liveSocket.disableLatencySim()
window.liveSocket = liveSocket

// The lines below enable quality of life phoenix_live_reload
// development features:
//
//     1. stream server logs to the browser console
//     2. click on elements to jump to their definitions in your code editor
//
if (process.env.NODE_ENV === "development") {
  window.addEventListener("phx:live_reload:attached", ({detail: reloader}) => {
    // Enable server log streaming to client.
    // Disable with reloader.disableServerLogs()
    reloader.enableServerLogs()

    // Open configured PLUG_EDITOR at file:line of the clicked element's HEEx component
    //
    //   * click with "c" key pressed to open at caller location
    //   * click with "d" key pressed to open at function component definition location
    let keyDown
    window.addEventListener("keydown", e => keyDown = e.key)
    window.addEventListener("keyup", e => keyDown = null)
    window.addEventListener("click", e => {
      if(keyDown === "c"){
        e.preventDefault()
        e.stopImmediatePropagation()
        reloader.openEditorAtCaller(e.target)
      } else if(keyDown === "d"){
        e.preventDefault()
        e.stopImmediatePropagation()
        reloader.openEditorAtDef(e.target)
      }
    }, true)

    window.liveReloader = reloader
  })
}

