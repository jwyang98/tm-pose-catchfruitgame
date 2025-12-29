/**
 * gameEngine.js
 * Fruit Catch Game Logic
 * Handles game state, item spawning, collision detection, and UI updates.
 */

class GameEngine {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.timeLeft = 60;
    this.lives = 3;
    this.state = "STOPPED"; // 'STOPPED', 'RUNNING', 'GAMEOVER'
    this.basketZone = "CENTER"; // 'LEFT', 'CENTER', 'RIGHT'
    this.items = [];
    this.lastSpawnTime = 0;
    this.spawnInterval = 2000; // ms
    this.baseSpeed = 3; // px per frame
    this.gameLoopId = null;
    this.timerInterval = null;

    // DOM Elements
    this.scoreEl = document.getElementById("score");
    this.levelEl = document.getElementById("level");
    this.timeEl = document.getElementById("time");
    this.livesEl = document.getElementById("lives");
    this.basketEl = document.getElementById("basket");
    this.itemsContainer = document.getElementById("items-container");
    this.overlay = document.getElementById("game-overlay");
    this.overlayTitle = document.getElementById("overlay-title");
    this.overlayDesc = document.getElementById("overlay-desc");
    this.finalScoreDisplay = document.getElementById("final-score-display");
    this.startBtn = document.getElementById("start-btn");

    // Event Listener for Start Button
    if (this.startBtn) {
      this.startBtn.addEventListener("click", () => this.start());
    }

    // Item Definitions
    this.itemTypes = [
      { type: "apple", emoji: "🍎", score: 100 },
      { type: "pear", emoji: "🍐", score: 150 },
      { type: "orange", emoji: "🍊", score: 200 },
      { type: "bomb", emoji: "💣", score: 0 },
    ];
  }

  start() {
    if (this.state === "RUNNING") return;

    this.resetGame();
    this.state = "RUNNING";
    this.overlay.classList.add("hidden");

    // Start Loops
    this.lastSpawnTime = performance.now();
    this.gameLoopId = requestAnimationFrame((timestamp) => this.loop(timestamp));

    // Start Timer
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      this.updateUI();

      // Level Up every 20 seconds
      if ((60 - this.timeLeft) % 20 === 0 && this.timeLeft !== 60) {
        this.levelUp();
      }

      if (this.timeLeft <= 0) {
        this.gameOver("Time's Up!");
      }
    }, 1000);
  }

  stop() {
    this.state = "STOPPED";
    cancelAnimationFrame(this.gameLoopId);
    clearInterval(this.timerInterval);
  }

  resetGame() {
    this.score = 0;
    this.level = 1;
    this.timeLeft = 60;
    this.lives = 3;
    this.items = [];
    this.spawnInterval = 2000;
    this.baseSpeed = 3;
    this.itemsContainer.innerHTML = "";
    this.updateUI();
    this.setBasketZone("CENTER");
  }

  gameOver(reason) {
    this.stop();
    this.state = "GAMEOVER";

    this.overlayTitle.innerText = "GAME OVER";
    this.overlayDesc.innerText = reason;
    this.finalScoreDisplay.style.display = "block";
    this.finalScoreDisplay.innerText = `Final Score: ${this.score}`;
    this.startBtn.innerText = "RESTART";
    this.overlay.classList.remove("hidden");
  }

  levelUp() {
    this.level++;
    this.baseSpeed += 1; // Increase speed
    this.spawnInterval = Math.max(500, 2000 - (this.level - 1) * 300); // Decrease interval
    this.updateUI();

    // Visual indicator (optional)
    const originalColor = this.levelEl.parentElement.style.backgroundColor;
    this.levelEl.parentElement.style.backgroundColor = "#ffeb3b";
    setTimeout(() => {
      this.levelEl.parentElement.style.backgroundColor = originalColor;
    }, 500);
  }

  // Called from PoseEngine
  setBasketZone(zone) {
    // zone: 'LEFT', 'CENTER', 'RIGHT'
    this.basketZone = zone;

    // Calculate Position (Percent)
    let leftPercent = "50%"; // Default Center
    if (zone === "LEFT") leftPercent = "16.66%";
    if (zone === "RIGHT") leftPercent = "83.33%";

    // Update Basket CSS. Center the element (subtract half width)
    // Using calc in CSS: left: calc(16.66% - 40px)
    // But we set inline style directly
    this.basketEl.style.left = `calc(${leftPercent} - 40px)`;
  }

  loop(timestamp) {
    if (this.state !== "RUNNING") return;

    const deltaTime = timestamp - this.lastTime || 16;
    this.lastTime = timestamp;

    this.spawnSystem(timestamp);
    this.updateItems();
    this.checkCollisions();

    this.gameLoopId = requestAnimationFrame((t) => this.loop(t));
  }

  spawnSystem(timestamp) {
    if (timestamp - this.lastSpawnTime > this.spawnInterval) {
      this.spawnItem();
      this.lastSpawnTime = timestamp;
    }
  }

  spawnItem() {
    // Pick zone
    const zones = ["LEFT", "CENTER", "RIGHT"];
    const zone = zones[Math.floor(Math.random() * zones.length)];

    // Pick Item Type
    // Bomb probability increases with level
    const bombChance = Math.min(0.1 + (this.level * 0.05), 0.4); // Max 40%
    let itemType;

    if (Math.random() < bombChance) {
      itemType = this.itemTypes.find(i => i.type === 'bomb');
    } else {
      const fruits = this.itemTypes.filter(i => i.type !== 'bomb');
      itemType = fruits[Math.floor(Math.random() * fruits.length)];
    }

    const item = {
      id: Math.random().toString(36).substr(2, 9),
      ...itemType,
      zone: zone,
      y: -50, // Start above screen
      element: document.createElement('div')
    };

    // Create DOM Element
    item.element.className = "item";
    item.element.innerText = item.emoji;

    let leftPercent = "50%";
    if (zone === "LEFT") leftPercent = "16.66%";
    if (zone === "RIGHT") leftPercent = "83.33%";

    item.element.style.left = `calc(${leftPercent} - 25px)`; // Center 50px item
    item.element.style.top = item.y + "px";

    this.itemsContainer.appendChild(item.element);
    this.items.push(item);
  }

  updateItems() {
    const gameHeight = document.getElementById("game-area").offsetHeight;

    this.items.forEach((item, index) => {
      item.y += this.baseSpeed;
      item.element.style.top = item.y + "px";

      // Remove if out of bounds (Missed)
      if (item.y > gameHeight) {
        this.handleMiss(item, index);
      }
    });
  }

  handleMiss(item, index) {
    // Remove element
    item.element.remove();
    this.items.splice(index, 1);

    // If fruit, lose life
    if (item.type !== 'bomb') {
      this.lives--;
      this.updateUI();
      if (this.lives <= 0) {
        this.gameOver("Too many fruits missed!");
      }
    }
  }

  checkCollisions() {
    // Simple Collision: Basket Y is fixed at bottom 20px. 
    // Basket Height 80px. Game Area Height approx 90vh.
    // Let's assume Basket top edge is at bottom: 100px (20px bottom + 80px height)
    // Actually, standard collision:
    // Basket Y range: [containerHeight - 100, containerHeight - 20]

    const gameArea = document.getElementById("game-area");
    const containerHeight = gameArea.offsetHeight;
    const basketTop = containerHeight - 100; // rough estimate
    const basketBottom = containerHeight - 20;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      const itemBottom = item.y + 50; // item height 50
      const itemTop = item.y;

      // Check Y Collision (overlapping vertical range)
      if (itemBottom >= basketTop && itemTop <= basketBottom) {
        // Check Zone Collision
        if (item.zone === this.basketZone) {
          this.handleCatch(item, i);
        }
      }
    }
  }

  handleCatch(item, index) {
    // Remove item
    item.element.remove();
    this.items.splice(index, 1);

    if (item.type === 'bomb') {
      this.gameOver("You caught a Bomb!");
    } else {
      this.score += item.score;
      this.updateUI();

      // Optional: Add floating text effect?
    }
  }

  updateUI() {
    this.scoreEl.innerText = this.score;
    this.levelEl.innerText = this.level;
    this.timeEl.innerText = this.timeLeft;
    this.livesEl.innerText = "❤️".repeat(Math.max(0, this.lives));
  }
}

// Export
window.GameEngine = GameEngine;
