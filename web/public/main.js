const modeButtons = document.querySelectorAll(".mode-btn");
const screen = document.getElementById("screen");
const approveBtn = document.getElementById("approveBtn");
const denyBtn = document.getElementById("denyBtn");

var input = "";
const keys = document.querySelectorAll(".keypad .key");

let selectedMode = null;
let messageID = ""
let currentType = null;

let lastKey = null;
let pressCount = 0;
let timeoutId = null;

const KEY_TIMEOUT = 1000; // 1 second

// 🔘 Toggle active mode button
modeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    modeButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedMode = btn.dataset.mode;
    screen.innerHTML = `<p>Mode: ${selectedMode.toUpperCase()}</p>`;
  });
});

// ✅ Validation logic
function validateInputs() {
  const number = document.getElementById("cardNumber").value.trim();
  const expiry = document.getElementById("cardExpiry").value.trim();
  const name = document.getElementById("cardName").value.trim();
  const value = document.getElementById("cardValue").value.trim();

  if (currentType === "balance") {
    // For balance, only check card number and balance value
    const numOk = /^[0-9]{13,19}$/.test(number.replace(/\s+/g, ""));
    const valueOk = parseFloat(value) > 0;
    if (!numOk) return "Invalid card number";
    if (!valueOk) return "Enter valid balance > 0";
    return "ok";
  }

  // Luhn-like check for number length
  const numOk = /^[0-9]{13,19}$/.test(number.replace(/\s+/g, ""));
  const expOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry);
  const nameOk = name.length >= 2;
  const valueOk = parseFloat(value) > 0;

  if (!numOk) return "Invalid card number";
  if (!expOk) return "Invalid expiration (MM/YY)";
  if (!nameOk) return "Enter full cardholder name";
  if (!valueOk) return "Enter valid value > 0";
  if (!selectedMode) return "Select mode (Credit/Debit/Gift)";

  return "ok";
}

// 🟢 Approve button
approveBtn.addEventListener("click", () => {
  const check = validateInputs();
  if (check === "ok") {
    screen.innerHTML = `<p style="color:lime;">Transaction Approved</p>`;
  } else {
    screen.innerHTML = `<p style="color:yellow;">${check}</p>`;
  }
});

// 🔴 Deny button
denyBtn.addEventListener("click", () => {
  screen.innerHTML = `<p style="color:red;">Transaction Denied</p>`;
});

let socket;

function connectWebSocket() {
  socket = new WebSocket("ws://localhost:5014");

  socket.addEventListener("open", () => {
    console.log("✅ Connected to WebSocket server");
    screen.innerHTML = `<p style="color:lightgreen;">Connected to server</p>`;
  });

  socket.addEventListener("message", (event) => {
    console.log("📩 Message from server:", event.data);
    json = JSON.parse(event.data);
    if (json.type == "message") {
      screen.innerHTML = `<p style="text-align: center;color:white;font-size:30px">${json.message}</p>`;
    } else if (json.type == "start_session") {
      screen.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/3/36/McDonald%27s_Golden_Arches.svg"
            alt="McDonald's Logo">`;
    } else if (json.type == "payment") {
      messageID = json.id;
      currentType = "payment";
      document.getElementById("cardValue").value = json.data;
      screen.innerHTML = `<p style="text-align: center;color:white;font-size:30px">Total: ${json.data}</p>`;
    } else if (json.type == "balance") {
      messageID = json.id;
      currentType = "balance";
      screen.innerHTML = `<p style="text-align: center;color:white;font-size:30px">Checking Balance</p>`;
    } else if (json.type == "pair") {
      messageID = json.id;
      screen.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
          <p style="color: white; font-size: 30px; margin-bottom: 20px; text-align: center;">
            Please enter Pairing code, then press #
          </p>
          <input id="textInput" type="text" />
        </div>
      `;
      input = document.getElementById("textInput")
      input.readOnly = true;
    } else if (json.type == "pair_success") {
      screen.innerHTML = `<p style="text-align: center;color:lime;font-size:30px">${json.message}</p>`;
      setTimeout(() => {
        screen.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/3/36/McDonald%27s_Golden_Arches.svg"
            alt="McDonald's Logo">`;
      }, 2000);
    } else if (json.type == "pair_failure") {
      screen.innerHTML = `<p style="text-align: center;color:red;font-size:30px">${json.message}</p>`;
      setTimeout(() => {
        screen.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/3/36/McDonald%27s_Golden_Arches.svg"
            alt="McDonald's Logo">`;
      }, 2000);
    } else if(json.type == "charity") {
      messageID = json.id;
      screen.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
          <p style="color: white; font-size: 24px; text-align: center;">
            ${json.data.text1}
          </p>
          <p style="color: white; font-size: 24px; text-align: center;">
            ${json.data.text2}
          </p>
          <p style="color: white; font-size: 24px; text-align: center;">
            ${json.data.text3}
          </p>
          <div style="display: flex; gap: 20px;">
            <button class="charity-btn" onclick="sendToServer({response: '${json.data.amount1}'})">${json.data.amount1}</button>
            <button class="charity-btn" onclick="sendToServer({response: '${json.data.amount2}'})">${json.data.amount2}</button>
          </div>
        </div>
      `;
    }
    else {
      screen.innerHTML = `<p style="text-align: center;color:cyan;">${event.data}</p>`;
    }
  });

  socket.addEventListener("close", () => {
    console.warn("🔌 Disconnected from WebSocket server");
    screen.innerHTML = `<p style="color:orange;">Disconnected</p>`;
    // Optional: auto-reconnect
    setTimeout(connectWebSocket, 3000);
  });

  socket.addEventListener("error", (err) => {
    console.error("❌ WebSocket error", err);
  });
}

// Connect as soon as the page loads
connectWebSocket();

// 🟢 Override approve / deny handlers
approveBtn.addEventListener("click", () => {
  const check = validateInputs();
  if (check === "ok") {
    const data = collectFormData("approve");
    sendToServer(data);
  } else {
    screen.innerHTML = `<p style="color:yellow;">${check}</p>`;
  }
});

denyBtn.addEventListener("click", () => {
  const data = collectFormData("deny");
  screen.innerHTML = `<p style="color:red;">Denied Locally</p>`;
  sendToServer(data);
});

function collectFormData(action) {
  if (currentType === "balance") {
    return {
      balance: parseFloat(document.getElementById("cardValue").value.trim()),
      cardNumber: document.getElementById("cardNumber").value.trim()
    };
  }
  return {
    action,
    mode: selectedMode,
    cardNumber: document.getElementById("cardNumber").value.trim(),
    expiry: document.getElementById("cardExpiry").value.trim(),
    name: document.getElementById("cardName").value.trim(),
    value: parseFloat(document.getElementById("cardValue").value.trim())
  };
}

function sendToServer(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      id: messageID,
      data:
        data
    }));

    console.log("📤 Sent:", { id: messageID, data: JSON.stringify(data) });
  } else {
    screen.innerHTML = `<p style="color:orange;">Server not connected</p>`;
    console.warn("WebSocket not open. Data not sent:", data);
  }
}

keys.forEach((key) => {
  key.addEventListener("click", () => handleKeyPress(key));
});

function handleKeyPress(key) {
  const digit = key.textContent.trim()[0];
  const letters = key.dataset.letters || "";

  // special keys
  if (digit === "*") return handleBackspace();
  if (digit === "#") return confirmInput();

  // 0 key special: cycle between "0" and " "
  if (digit === "0") {
    const chars = ["0", " "];
    if (digit === lastKey) {
      pressCount++;
      updatePreview(chars);
    } else {
      commitChar();
      lastKey = digit;
      pressCount = 1;
      input.value += chars[0];
    }

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      commitChar();
    }, KEY_TIMEOUT);
    return;
  }

  // normal number/letter keys
  if (digit === lastKey) {
    pressCount++;
    updatePreview(letters);
  } else {
    commitChar();
    lastKey = digit;
    pressCount = 1;
    if (letters.length) input.value += letters[0];
  }

  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    commitChar();
  }, KEY_TIMEOUT);
}

function updatePreview(letters) {
  if (!letters.length) return;
  const index = (pressCount - 1) % letters.length;
  const char = letters[index];
  // replace last character with new one
  input.value = input.value.slice(0, -1) + char;
}

function commitChar() {
  if (!lastKey) return;

  let letters = "";
  if (lastKey === "0") {
    letters = ["0", " "];
  } else {
    const key = [...keys].find(k => k.textContent.trim().startsWith(lastKey));
    letters = key?.dataset.letters || "";
  }

  if (letters.length) {
    const index = (pressCount - 1) % letters.length;
    const char = letters[index];
    input.value = input.value.slice(0, -1) + char;
  }

  lastKey = null;
  pressCount = 0;
}


function handleBackspace() {
  commitChar();
  input.value = input.value.slice(0, -1);
}

function confirmInput() {
  commitChar();
  socket.send(JSON.stringify({ id: messageID, data: input.value }));
}

function appendChar(char) {
  commitChar();
  input.value += char;
}
