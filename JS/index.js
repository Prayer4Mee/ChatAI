// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", function () {
  // Toggle Sidebar
  document
    .getElementById("toggleSidebar")
    .addEventListener("click", function () {
      const sidebar = document.querySelector(".sidebar");
      sidebar.classList.toggle("collapsed");
    });

  // Emoji Selector Functionality
  const emojiToggle = document.getElementById("emojiToggle");
  const emojiDropdown = document.getElementById("emojiDropdown");
  const emojiOptions = document.querySelectorAll(".emoji-option");

  if (emojiToggle && emojiDropdown) {
    // Toggle emoji dropdown
    emojiToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      emojiDropdown.classList.toggle("active");
    });

    // Handle emoji selection
    emojiOptions.forEach((option) => {
      option.addEventListener("click", function () {
        const selectedEmoji = this.getAttribute("data-emoji");
        // Update the emoji display
        document.querySelector(".emoji-display").textContent = selectedEmoji;
        // Close dropdown
        emojiDropdown.classList.remove("active");
      });
    });

    // Close dropdown when clicking here and there
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".emoji-selector-wrapper")) {
        emojiDropdown.classList.remove("active");
      }
    });
  }

  // Message Input Functionality
  const messageInput = document.getElementById("messageInput");
  const sendButton = document.getElementById("sendButton");

  if (messageInput && sendButton) {
    // Send message on button click
    sendButton.addEventListener("click", () => {
      sendMessage();
    });

    // Send message on Enter key
    messageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
      }
    });
  }
});
// --- Utility tool? WuWa? function select emoji ---
function getSelectedEmoji() {
  const emojiElement = document.querySelector(".emoji-display");
  return emojiElement ? emojiElement.textContent.trim() : '';
}
// --- Function to add a message to the chat (Handles agent names) ---
function addMessage(text, isUser = true) {
    const messagesContainer = document.querySelector(".messages-container");
    
    let senderName = "You"; // Default for user
    let messageText = text;

    // Check if the message is from an agent and extract the name
    if (!isUser) {
        // The server response is formatted as "Name: Message text"
        const match = text.match(/^([^:]+):\s*(.*)/);
        // According to ChatGPT, this is called Regex, a highly specific code used to solve puzzles
        // in strings of text.
        // Interpretation: ^([^:]+)Start at the beginning. Find everything that's NOT a colon, and save it.
        // Interpretation: : Matches the colon
        // Interpretation: \s* Matches any spaces after the colon
        // Interpretation: (.*) Capture the rest of the message.
        if (match) {
            senderName = match[1]; // Sets Sender Name (AI) like Iuno, Augusta, Camellya
            messageText = match[2]; // Set's the Message Text without the name of the agent
        } else {
            senderName = "System"; // error message
        }
    }

    const messageRow = document.createElement("div");
    messageRow.className =
        "message-row mb-3 d-flex " +
        (isUser ? "justify-content-end" : "justify-content-start");

    // Thank you Bootstrap
    const messageHTML = isUser
        ? `
            <div class="message-bubble user-message bg-light p-3 rounded" style="max-width: 60%">
                <p class="sender-name text-muted small mb-1">**${senderName}**</p>
                <p class="mb-0">${messageText}</p>
            </div>
        `
        : `
            <div class="message-bubble bot-message bg-secondary p-3 rounded" style="max-width: 60%">
                <p class="sender-name text-white-50 small mb-1">**${senderName}**</p>
                <p class="mb-0 text-white">${messageText}</p>
            </div>
        `;
    //Sets the message HTML structure - adds new message bubble with sender name and message text
    messageRow.innerHTML = messageHTML;
    messagesContainer.appendChild(messageRow);

    // Auto-scroll to bottom - messenger style!
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// --- Send message function (Triggers turn and sends emoji) ---
function sendMessage() {
  //1. Gets the message from the input box
    const messageInput = document.getElementById("messageInput");
    // 2. Remove Space from start and end of message
    const text = messageInput.value.trim();
    //3. Get selected emoji
    const selectedEmoji = getSelectedEmoji();
    // Combine text and emoji for the message sent to the server and display
    const fullMessage = text + (selectedEmoji ? ` ${selectedEmoji}` : '');
    // Empty space at the ternary operator means if no emoji is selected, don't add anything.
    
    // Only send if there is content (text or emoji)
    if (fullMessage === "") return; //4. Prevent sending empty messages using return statement

    // 5. This is the part that adds the message to the chat window
    // Add the user message (isUser = true)
    addMessage(fullMessage, true);


    // 6. Clear input box/Reset input box
    messageInput.value = "";


    //7. Call API
    callOpenAIAPI(fullMessage);
    // Passes the full message (text + emoji) to the API call function (to your server.js)
    // which handles the Gemini interaction.
} 

// Function to call the API via your backend 
// This function sends the user's message to the backend server and handles the response.
async function callOpenAIAPI(userMessage) {
  // async function means it will run in the background
  // the function must wait for the API response before proceeding
    try { 
        // 1. Show loading indicator
        addMessage("...", false);// false indicates it's from the bot, 
        // the ... is a loading you see on the screen
        //2. Fetch = function used for making HTTPS requests to fetch resources
        const response = await fetch("http://localhost:3000/api/chat", {
            method: "POST", // HTTP method for sending data
            headers: { "Content-Type": "application/json" }, // specifies JSON data - 
            body: JSON.stringify({ message: userMessage }) // turns the data into JSON format
        });
        // 

        const data = await response.json();
        // 3. Waits for the response and parses it as JSON

        // 4. Remove loading indicator
        // And finds the last message in the chat (the loading indicator) and removes it
        // because we are about to add the actual bot response
        const lastMessage = document.querySelector(".messages-container .message-row:last-child");
        if (lastMessage && lastMessage.textContent.includes("...")) {
            lastMessage.remove();
        }
        // 5. Check if response is successful
        // If successful, add the bot reply to the chat
        if (data.success) {
            // Add bot reply to chat (addMessage handles parsing the agent name) (display bot message)
            addMessage(data.reply, false);
            //6. If not successful, log error and show error message in chat
        } else {
            console.error("API Error:", data.error);
            addMessage("Sorry, I encountered an error: " + data.error, false);
        }
        // 7. Only if the initial fetch fails (network error, server down, etc) - no contact with server
    } catch (error) {
        console.error("Network Error:", error);
        
        // Remove loading indicator
        const lastMessage = document.querySelector(".messages-container .message-row:last-child");
        if (lastMessage && lastMessage.textContent.includes("...")) {
            lastMessage.remove();
        }
        
        addMessage("Sorry, I couldn't connect to the server. Make sure your backend is running.", false);
    }
}

