// ==========================================================================
// Project Snowball - Главный игровой движок и логика
// Ход игры: Движение -> Действие (Сбор снежка / Метание с кубиком / Пропуск)
// Рендеринг шестиугольников, плавные переходы, анимации и боты FFA
// ==========================================================================

class SnowballGame {
  constructor() {
    // Состояние экранов
    this.currentScreen = 'mainMenu';
    this.gameMode = 'ffa'; // FFA режим
    this.playerCount = 3;
    this.gameType = 'bot'; // 'bot' | 'hotseat' | 'multiplayer'

    // Игровое состояние
    this.map = null;
    this.players = [];
    this.currentPlayerIndex = 0;
    this.currentRound = 1;
    this.winner = null;

    // Фаза текущего хода
    // 'move' (игрок ходит) -> 'action' (выбирает: собрать, бросить, пропустить) -> 'throw_target' (выбирает цель) -> 'ended'
    this.turnPhase = 'move';
    this.movePointsLeft = 4;
    this.selectedSnowballIndex = null;
    this.selectedTargetPlayer = null;

    // Холст и рендерер
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.camera = { x: 0, y: 0, zoom: 1.0 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.hoveredHex = null;

    // Анимация снежинок на фоне
    this.snowCanvas = document.getElementById('snowCanvas');
    this.snowCtx = this.snowCanvas ? this.snowCanvas.getContext('2d') : null;
    this.snowflakes = [];

    // Анимация броска снежка на поле
    this.flyingSnowballs = [];

    // Инициализация
    this.init();
  }

  init() {
    this.setupBackgroundSnow();
    this.setupEventListeners();
    this.setupCharacterSelect();
    this.resizeCanvas();
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    // Запуск цикла анимации
    requestAnimationFrame((t) => this.renderLoop(t));
  }

  // ==========================================================================
  // СИСТЕМА ФОНОВОГО СНЕГОПАДА
  // ==========================================================================
  setupBackgroundSnow() {
    if (!this.snowCanvas) return;
    this.snowCanvas.width = window.innerWidth;
    this.snowCanvas.height = window.innerHeight;

    this.snowflakes = [];
    const count = Math.min(100, Math.floor(window.innerWidth / 15));
    for (let i = 0; i < count; i++) {
      this.snowflakes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: Math.random() * 2.5 + 1,
        density: Math.random() * 1.5 + 0.5,
        wind: Math.random() * 0.5 - 0.25
      });
    }
  }

  updateSnow() {
    if (!this.snowCtx) return;
    const w = this.snowCanvas.width;
    const h = this.snowCanvas.height;
    this.snowCtx.clearRect(0, 0, w, h);
    this.snowCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.snowCtx.beginPath();

    for (let i = 0; i < this.snowflakes.length; i++) {
      const p = this.snowflakes[i];
      this.snowCtx.moveTo(p.x, p.y);
      this.snowCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2, true);

      p.y += Math.cos(p.density) + 1 + p.radius / 2;
      p.x += Math.sin(p.wind);

      if (p.x > w + 5 || p.x < -5 || p.y > h) {
        p.x = Math.random() * w;
        p.y = -10;
      }
    }
    this.snowCtx.fill();
  }

  // ==========================================================================
  // ОБРАБОТЧИКИ СОБЫТИЙ И ИНТЕРФЕЙС
  // ==========================================================================
  setupEventListeners() {
    // Навигация меню
    document.getElementById('btnQuickPlay').addEventListener('click', () => {
      sounds.playClick();
      this.gameType = 'bot';
      this.openCharacterSelect();
    });

    document.getElementById('btnHotseat').addEventListener('click', () => {
      sounds.playClick();
      this.gameType = 'hotseat';
      this.openCharacterSelect();
    });

    document.getElementById('btnMultiplayer').addEventListener('click', () => {
      sounds.playClick();
      this.openMultiplayerLobby();
    });

    document.getElementById('btnRules').addEventListener('click', () => {
      sounds.playClick();
      document.getElementById('rulesModal').classList.add('active');
    });

    document.getElementById('btnCloseRules').addEventListener('click', () => {
      sounds.playClick();
      document.getElementById('rulesModal').classList.remove('active');
    });

    document.getElementById('btnRulesInGame').addEventListener('click', () => {
      sounds.playClick();
      document.getElementById('rulesModal').classList.add('active');
    });

    document.getElementById('btnToggleSound').addEventListener('click', () => {
      const isSound = sounds.toggle();
      document.getElementById('soundIcon').textContent = isSound ? '🔊' : '🔇';
    });

    // Сетевое лобби
    document.getElementById('btnCloseMultiplayer').addEventListener('click', () => {
      sounds.playClick();
      this.switchScreen('mainMenu');
    });

    document.getElementById('btnCancelMultiplayer').addEventListener('click', () => {
      sounds.playClick();
      this.switchScreen('mainMenu');
    });

    document.getElementById('tabCreateRoom').addEventListener('click', (e) => {
      sounds.playClick();
      e.target.classList.add('active');
      document.getElementById('tabJoinRoom').classList.remove('active');
      document.getElementById('panelCreateRoom').classList.add('active');
      document.getElementById('panelJoinRoom').classList.remove('active');
    });

    document.getElementById('tabJoinRoom').addEventListener('click', (e) => {
      sounds.playClick();
      e.target.classList.add('active');
      document.getElementById('tabCreateRoom').classList.remove('active');
      document.getElementById('panelJoinRoom').classList.add('active');
      document.getElementById('panelCreateRoom').classList.remove('active');
    });

    document.getElementById('btnCopyRoomCode').addEventListener('click', () => {
      const code = document.getElementById('generatedRoomCode').textContent;
      navigator.clipboard?.writeText(code);
      alert(`Код комнаты "${code}" скопирован в буфер обмена!`);
    });

    document.getElementById('btnStartMultiplayerGame').addEventListener('click', () => {
      sounds.playClick();
      this.gameType = 'multiplayer';
      this.openCharacterSelect();
    });

    document.getElementById('btnConnectRoom').addEventListener('click', () => {
      sounds.playClick();
      const codeInput = document.getElementById('inputJoinCode');
      const code = codeInput ? codeInput.value.trim() : '';
      if (!code) {
        alert('Пожалуйста, введите код комнаты!');
        return;
      }

      const btnConnect = document.getElementById('btnConnectRoom');
      btnConnect.textContent = 'Подключение...';
      btnConnect.disabled = true;

      network.joinRoom(code, (roomCode) => {
        btnConnect.textContent = 'Подключено! Ожидание хоста...';
        alert(`Вы успешно подключились к комнате ${roomCode}! Ожидайте старта от хоста.`);
      }, (err) => {
        btnConnect.textContent = 'Подключиться к комнате';
        btnConnect.disabled = false;
        alert(`Не удалось подключиться к комнате "${code}". Проверьте код комнаты.`);
      });
    });

    // Экран выбора персонажей
    document.getElementById('btnBackToMenu').addEventListener('click', () => {
      sounds.playClick();
      this.switchScreen('mainMenu');
    });

    document.querySelectorAll('.btn-count').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        sounds.playClick();
        document.querySelectorAll('.btn-count').forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        this.playerCount = parseInt(e.target.dataset.players);
        this.renderPlayerSlots();
      });
    });

    document.getElementById('btnLaunchBattle').addEventListener('click', () => {
      sounds.playClick();
      this.startBattle();
    });

    // Управление внутри боя
    document.getElementById('btnCenterCamera').addEventListener('click', () => {
      sounds.playClick();
      this.centerCamera();
    });

    document.getElementById('btnZoomIn').addEventListener('click', () => {
      this.camera.zoom = Math.min(1.8, this.camera.zoom + 0.15);
    });

    document.getElementById('btnZoomOut').addEventListener('click', () => {
      this.camera.zoom = Math.max(0.6, this.camera.zoom - 0.15);
    });

    document.getElementById('btnMenuInGame').addEventListener('click', () => {
      if (confirm('Выйти в главное меню? Текущий бой будет завершен.')) {
        this.switchScreen('mainMenu');
      }
    });

    document.getElementById('btnClearLog').addEventListener('click', () => {
      document.getElementById('combatLog').innerHTML = '';
    });

    // Игровые действия (Ход)
    document.getElementById('btnActionGather').addEventListener('click', () => {
      this.handlePlayerActionGather();
    });

    document.getElementById('btnActionThrow').addEventListener('click', () => {
      if (this.turnPhase === 'throw_target') {
        this.cancelThrowMode();
      } else {
        this.handlePlayerActionThrowMode();
      }
    });

    const btnCancelAim = document.getElementById('btnActionCancelAim');
    if (btnCancelAim) {
      btnCancelAim.addEventListener('click', () => {
        this.cancelThrowMode();
      });
    }

    document.getElementById('btnActionSkip').addEventListener('click', () => {
      this.handlePlayerActionSkip();
    });

    // Кнопки после броска кубика (обработчик назначается динамически в showDiceAnimation)
    document.getElementById('diceCloseBtn').addEventListener('click', () => {
      document.getElementById('diceOverlay').classList.remove('active');
      document.getElementById('diceCloseBtn').style.display = 'none';
    });

    // Экран победы
    document.getElementById('btnPlayAgain').addEventListener('click', () => {
      sounds.playClick();
      document.getElementById('gameOverModal').classList.remove('active');
      this.startBattle();
    });

    document.getElementById('btnExitToMenu').addEventListener('click', () => {
      sounds.playClick();
      document.getElementById('gameOverModal').classList.remove('active');
      this.switchScreen('mainMenu');
    });

    // Интерактив холста (Перетаскивание и клик по гексам)
    this.setupCanvasInteractions();
  }

  switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      this.currentScreen = screenId;
    }
  }

  openMultiplayerLobby() {
    const code = network.generateRoomCode();
    document.getElementById('generatedRoomCode').textContent = code;

    const slots = document.getElementById('slotsContainer');
    slots.innerHTML = `
      <div class="lobby-slot-item">
        <span>👑 Игрок 1 (Вы - Создатель комнаты)</span>
        <span style="color:#69f0ae; font-weight:800;">Готов</span>
      </div>
      <div class="lobby-slot-item" id="slotStatus2">
        <span>👤 Игрок 2 (Ожидание подключения через интернет...)</span>
        <span style="color:#ffd54f;">Ожидание</span>
      </div>
      <div class="lobby-slot-item" id="slotStatus3">
        <span>👤 Игрок 3 (Ожидание подключения через интернет...)</span>
        <span style="color:#ffd54f;">Ожидание</span>
      </div>
    `;

    network.createRoom(code, (readyCode) => {
      console.log('Комната создана и ждет подключения:', readyCode);
    }, (playerInfo) => {
      // Игрок подключился по WebRTC через интернет
      sounds.playClick();
      const slotEl = document.getElementById(`slotStatus${playerInfo.slot + 1}`);
      if (slotEl) {
        slotEl.innerHTML = `
          <span>👤 Игрок ${playerInfo.slot + 1} (Подключен!)</span>
          <span style="color:#69f0ae; font-weight:800;">Подключен</span>
        `;
      }
    });

    this.switchScreen('multiplayerLobbyScreen');
  }

  // ==========================================================================
  // ВЫБОР ПЕРСОНАЖЕЙ И НАСТРОЙКА СЛОТОВ
  // ==========================================================================
  setupCharacterSelect() {
    this.selectedSlotIndex = 0;
    this.configuredSlots = [
      { character: CHARACTERS[0], isBot: false },
      { character: CHARACTERS[1], isBot: true },
      { character: CHARACTERS[2], isBot: true },
      { character: CHARACTERS[3], isBot: true }
    ];

    // Отрисовка списка персонажей в ростере
    const roster = document.getElementById('rosterContainer');
    roster.innerHTML = '';
    CHARACTERS.forEach((char) => {
      const card = document.createElement('div');
      card.className = 'roster-card';
      card.innerHTML = `
        <div class="roster-art">${char.art}</div>
        <div class="roster-name">${char.name}</div>
        <div class="roster-title-tag">${char.title}</div>
        <div class="roster-stats-grid">
          <div class="roster-stat-item"><span>❤️ ХП</span> <strong>${char.maxHp}</strong></div>
          <div class="roster-stat-item"><span>💥 Урон</span> <strong>${char.damage}</strong></div>
          <div class="roster-stat-item"><span>👟 Шаг</span> <strong>${char.moveSpeed}</strong></div>
          <div class="roster-stat-item"><span>🎯 Прицел</span> <strong>${char.aimRange}</strong></div>
        </div>
      `;

      card.addEventListener('click', () => {
        sounds.playClick();
        this.configuredSlots[this.selectedSlotIndex].character = char;
        this.renderPlayerSlots();
        this.updateRosterSelection();
      });

      roster.appendChild(card);
    });
  }

  openCharacterSelect() {
    if (this.gameType === 'hotseat') {
      this.configuredSlots.forEach((slot) => (slot.isBot = false));
      document.getElementById('setupHeading').textContent = 'Локальная битва (Hotseat)';
      document.getElementById('setupSubheading').textContent = 'Каждый игрок управляет своим героем по очереди на одном экране';
    } else if (this.gameType === 'bot') {
      this.configuredSlots[0].isBot = false;
      for (let i = 1; i < this.configuredSlots.length; i++) {
        this.configuredSlots[i].isBot = true;
      }
      document.getElementById('setupHeading').textContent = 'Одиночная битва против дворовых ребят';
      document.getElementById('setupSubheading').textContent = 'Вы управляете Слотом 1, остальные персонажи управляются ИИ';
    } else {
      document.getElementById('setupHeading').textContent = 'Сетевая комната';
      document.getElementById('setupSubheading').textContent = 'Настройка состава участников для матча';
    }

    this.renderPlayerSlots();
    this.updateRosterSelection();
    this.switchScreen('characterSelectScreen');
  }

  renderPlayerSlots() {
    const container = document.getElementById('playerSlotsGrid');
    container.innerHTML = '';

    for (let i = 0; i < this.playerCount; i++) {
      const slot = this.configuredSlots[i];
      const char = slot.character;

      const card = document.createElement('div');
      card.className = `player-slot-card ${i === this.selectedSlotIndex ? 'active-slot' : ''}`;
      card.innerHTML = `
        <div class="slot-header">
          <span class="slot-label">Игрок ${i + 1}</span>
          <span class="slot-badge-type ${slot.isBot ? 'bot' : 'human'}">${slot.isBot ? '🤖 ИИ Бот' : '👤 Игрок'}</span>
        </div>
        <div class="slot-char-preview">
          <div class="slot-avatar" style="border-color: ${char.color};">${char.art}</div>
          <div class="slot-char-info">
            <h4>${char.name}</h4>
            <div class="slot-stats">
              <span>❤️ ${char.maxHp}</span>
              <span>💥 ${char.damage}</span>
              <span>👟 ${char.moveSpeed}</span>
              <span>🎯 ${char.aimRange}</span>
            </div>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        sounds.playClick();
        this.selectedSlotIndex = i;
        this.renderPlayerSlots();
        this.updateRosterSelection();
      });

      container.appendChild(card);
    }
  }

  updateRosterSelection() {
    const currentSelectedChar = this.configuredSlots[this.selectedSlotIndex].character;
    const cards = document.querySelectorAll('.roster-card');
    cards.forEach((card, idx) => {
      if (CHARACTERS[idx].id === currentSelectedChar.id) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  // ==========================================================================
  // СТАРТ БИТВЫ И РАССТАНОВКА НА КАРТЕ
  // ==========================================================================
  startBattle() {
    this.map = MapGenerator.generateMap();

    // 2. Инициализируем игроков
    this.players = [];
    const spawnPoints = this.findSpawnPoints(this.playerCount);

    for (let i = 0; i < this.playerCount; i++) {
      const slot = this.configuredSlots[i];
      const char = slot.character;
      const spawn = spawnPoints[i] || { q: 0, r: 0 };

      // Стартовая рука: каждому игроку дается 2 случайных снежка
      const hand = [
        this.getRandomSnowballCard(),
        this.getRandomSnowballCard()
      ];

      this.players.push({
        id: i,
        name: char.name,
        art: char.art,
        color: char.color,
        isBot: slot.isBot,
        // Характеристики
        hp: char.maxHp,
        maxHp: char.maxHp,
        damage: char.damage,
        baseMoveSpeed: char.moveSpeed,
        baseAimRange: char.aimRange,
        // Текущее положение на гексе
        q: spawn.q,
        r: spawn.r,
        // Координаты для плавной анимации движения (.5 сек)
        animX: null,
        animY: null,
        isMoving: false,
        // Рука снежков
        hand: hand,
        // Наложенные эффекты (заморозка, ослепление)
        activeEffects: [],
        eliminated: false
      });
    }

    this.currentPlayerIndex = 0;
    this.currentRound = 1;
    this.winner = null;

    // Сброс счетчика раундов в интерфейсе
    const roundBadge = document.getElementById('roundCounter');
    if (roundBadge) roundBadge.textContent = 'Раунд 1';

    this.switchScreen('gameScreen');
    this.resizeCanvas();
    this.centerCamera();
    this.updateStatusSidebar();
    this.logCombat(`Битва за двор началась! Раунд 1.`, 'system');

    // Начинаем ход первого игрока
    this.startTurn();
  }

  // Поиск стартовых точек в разных внешних зонах
  findSpawnPoints(count) {
    const points = [];
    // Для максимального расстояния между игроками:
    // 2 игрока -> противоположные зоны (север и юг): зоны 2 и 5
    // 3 игрока -> через одну зону (равносторонний треугольник): зоны 1, 3, 5
    // 4 игрока -> зоны 1, 2, 4, 5
    let chosenZones = [];
    if (count === 2) {
      chosenZones = [2, 5];
    } else if (count === 3) {
      chosenZones = [1, 3, 5];
    } else {
      chosenZones = [1, 2, 4, 5];
    }

    chosenZones.forEach((zoneId) => {
      const zoneCenter = this.map.zoneCenters.find((z) => z.id === zoneId);
      if (zoneCenter) {
        // Ищем гекс с максимальным удалением от центра поля (0,0), не являющийся препятствием
        let bestTile = null;
        let maxDist = -1;

        for (const [key, tile] of this.map.tiles.entries()) {
          if (tile.zoneId === zoneId && !tile.isObstacle && !tile.isHill) {
            const distFromOrigin = HexMath.distance(tile, { q: 0, r: 0 });
            if (distFromOrigin > maxDist) {
              maxDist = distFromOrigin;
              bestTile = { q: tile.q, r: tile.r };
            }
          }
        }
        points.push(bestTile || { q: zoneCenter.q, r: zoneCenter.r });
      }
    });

    return points;
  }

  // ==========================================================================
  // ЛОГИКА ХОДА ИГРОКА
  // ==========================================================================
  startTurn() {
    const player = this.players[this.currentPlayerIndex];
    if (!player || player.eliminated) {
      this.nextPlayer();
      return;
    }

    // Запоминаем текущего ходящего игрока для валидации таймаутов
    this.activeTurnPlayerId = player.id;

    // Применяем эффекты в начале хода
    let movePenalty = 0;
    player.activeEffects = player.activeEffects.filter((eff) => {
      if (eff.type === 'freeze') movePenalty += eff.movePenalty;
      eff.duration--;
      return eff.duration > 0;
    });

    this.turnPhase = 'move';
    this.movePointsLeft = Math.max(1, player.baseMoveSpeed - movePenalty);
    this.selectedSnowballIndex = null;
    this.selectedTargetPlayer = null;

    this.updateHud();
    this.updateHandDisplay();
    this.updateStatusSidebar();

    this.logCombat(`Ход игрока: ${player.name}. Доступно шагов: ${this.movePointsLeft}`, 'move');

    // Если ходит ИИ (Бот)
    if (player.isBot) {
      this.setButtonsDisabled(true);
      this.updateInstruction(`Сейчас думает и ходит: ${player.name}...`);
      const currentTurnId = player.id;
      setTimeout(() => {
        // Проверяем, что ход всё ещё принадлежит этому же игроку
        if (this.currentPlayerIndex === currentTurnId && this.activeTurnPlayerId === currentTurnId) {
          this.executeBotTurn();
        }
      }, 1000);
    } else {
      this.setButtonsDisabled(false);
      this.updateInstruction('Ваш ход! Выберите клетку для шага или используйте действие внизу.');
    }
  }

  // Проверка попадания на холм (+1 к дальности прицела)
  isPlayerOnHill(player) {
    const tile = this.map.tiles.get(`${player.q},${player.r}`);
    return tile && tile.isHill;
  }

  // Вычисление итоговой прицельной дальности (снежок больше не меняет range, он дает бонус к кубику)
  getEffectiveAimRange(player) {
    let range = player.baseAimRange;
    if (this.isPlayerOnHill(player)) {
      range += 1; // Тактическое преимущество холма в центре
    }
    // Проверка штрафа ослепления
    player.activeEffects.forEach((eff) => {
      if (eff.type === 'blind') range -= eff.rangePenalty;
    });
    return Math.max(1, range);
  }

  // 1. ДЕЙСТВИЕ: Собрать снежок (слепить новый)
  handlePlayerActionGather() {
    const player = this.players[this.currentPlayerIndex];
    if (player.hand.length >= 4) {
      alert('У вас уже полные карманы снежков (максимум 4)! Метните один или пропустите ход.');
      return;
    }

    sounds.playSnowballGather();
    const newCard = this.getRandomSnowballCard();
    player.hand.push(newCard);

    this.logCombat(`${player.name} слепил снежок: "${newCard.name}" ${newCard.art}!`, 'gather');
    this.updateHandDisplay();
    this.endTurn();
  }

  // 2. ДЕЙСТВИЕ: Режим метания снежка
  handlePlayerActionThrowMode() {
    const player = this.players[this.currentPlayerIndex];
    if (player.hand.length === 0) {
      alert('У вас нет готовых снежков! Нажмите "Собрать снежок" чтобы слепить.');
      return;
    }

    // Если снежок еще не выбран, выбираем первый из руки
    if (this.selectedSnowballIndex === null) {
      this.selectedSnowballIndex = 0;
    }

    this.turnPhase = 'throw_target';
    this.updateHandDisplay();
    this.updateInstruction('🎯 Кликните по сопернику для броска, или нажмите "Отмена / Шаг", чтобы продолжить движение!');

    const btnThrow = document.getElementById('btnActionThrow');
    if (btnThrow) btnThrow.classList.add('active');
    const btnCancel = document.getElementById('btnActionCancelAim');
    if (btnCancel) btnCancel.style.display = 'inline-flex';
  }

  // Отмена режима метания снежка (возврат к фазе движения)
  cancelThrowMode() {
    sounds.playClick();
    this.turnPhase = 'move';
    this.selectedSnowballIndex = null;
    this.updateHandDisplay();

    const btnThrow = document.getElementById('btnActionThrow');
    if (btnThrow) btnThrow.classList.remove('active');
    const btnCancel = document.getElementById('btnActionCancelAim');
    if (btnCancel) btnCancel.style.display = 'none';

    if (this.movePointsLeft > 0) {
      this.updateInstruction(`Режим броска отменен. У вас осталось шагов: ${this.movePointsLeft}. Кликните по клетке для шага.`);
    } else {
      this.updateInstruction('Режим броска отменен. Выберите действие: Собрать снежок, Метнуть или Пропустить.');
    }
  }

  // Клик по цели для метания снежка
  performSnowballThrow(targetPlayer) {
    const player = this.players[this.currentPlayerIndex];
    const card = player.hand[this.selectedSnowballIndex] || SNOWBALL_CARDS[0];

    const dist = HexMath.distance(player, targetPlayer);
    const aim = this.getEffectiveAimRange(player);

    // Тратим карту из руки
    player.hand = player.hand.filter((_, idx) => idx !== this.selectedSnowballIndex);
    this.selectedSnowballIndex = null;
    this.updateHandDisplay();

    // Запускаем визуальный бросок и механику кубика D6
    sounds.playSnowballThrow();
    this.spawnFlyingSnowball(player, targetPlayer, () => {
      this.executeDiceThrow(player, targetPlayer, card, dist, aim);
    });
  }

  // Механика кубика: D6 >= (Прицел - Дистанция)
  executeDiceThrow(attacker, target, card, dist, aim) {
    // Новая формула расчета сложности попадания:
    // 1) Дистанция <= половины прицела (округление вниз) -> базово нужно 2+
    // 2) Дистанция > половины и <= прицела -> базово нужно 4+
    // 3) За каждую последующую клетку свыше прицела -> +1 к сложности (4 + dist - aim)
    const halfAim = Math.floor(aim / 2);
    let baseTargetScore = 2;
    if (dist <= halfAim) {
      baseTargetScore = 2;
    } else if (dist <= aim) {
      baseTargetScore = 4;
    } else {
      baseTargetScore = 4 + (dist - aim);
    }

    // Снежок дает модификатор к броску кубика:
    // diceBonus = card.rangeMod (если +2, то к результату кубика прибавляется +2)
    const diceBonus = card.rangeMod || 0;

    // Бросок шестигранного кубика (1..6)
    const rawRoll = Math.floor(Math.random() * 6) + 1;
    const finalRoll = rawRoll + diceBonus;
    sounds.playDiceRoll();

    // Показ окна броска кубика
    this.showDiceAnimation(rawRoll, diceBonus, finalRoll, baseTargetScore, aim, dist, () => {
      const isHit = finalRoll >= baseTargetScore;

      if (isHit) {
        sounds.playHit();
        const totalDamage = Math.max(1, attacker.damage + card.damageMod);
        target.hp -= totalDamage;

        let rollDesc = `${rawRoll}`;
        if (diceBonus > 0) rollDesc += `+${diceBonus} (бонус снежка) = ${finalRoll}`;
        else if (diceBonus < 0) rollDesc += `${diceBonus} = ${finalRoll}`;

        let hitMsg = `ПОПАДАНИЕ! ${attacker.name} попал в ${target.name} на ${totalDamage} урона! (кубик: ${rollDesc} при нужном ${baseTargetScore}+)`;

        if (card.effect) {
          target.activeEffects.push({ ...card.effect });
          hitMsg += ` Наложен эффект: ${card.effect.name}!`;
        }

        this.logCombat(hitMsg, 'damage');

        if (target.hp <= 0) {
          target.hp = 0;
          target.eliminated = true;
          this.logCombat(`😵 ${target.name} сбит с ног в сугроб и выбывает из битвы!`, 'damage');
        }
      } else {
        sounds.playMiss();
        let rollDesc = `${rawRoll}`;
        if (diceBonus !== 0) rollDesc += `${diceBonus >= 0 ? '+' : ''}${diceBonus} = ${finalRoll}`;
        this.logCombat(`МИМО! ${attacker.name} промахнулся по ${target.name} (выпало: ${rollDesc}, требовалось: ${baseTargetScore}+).`, 'system');
      }

      this.updateStatusSidebar();
      if (!this.checkVictoryCondition()) {
        this.endTurn();
      }
    });
  }

  // Анимация 3D кубика с предварительным кувырканием и броском
  showDiceAnimation(rawRoll, diceBonus, finalRoll, neededScore, aim, dist, onComplete) {
    const overlay = document.getElementById('diceOverlay');
    const cube = document.getElementById('diceCube');
    const calc = document.getElementById('diceCalculation');
    const resultMsg = document.getElementById('diceResultMsg');
    const closeBtn = document.getElementById('diceCloseBtn');

    const halfAim = Math.floor(aim / 2);
    let bonusText = '';
    if (diceBonus > 0) bonusText = ` | Снежок: +${diceBonus} к кубику`;
    else if (diceBonus < 0) bonusText = ` | Снежок: ${diceBonus} к кубику`;

    calc.innerHTML = `Дистанция: <strong>${dist}</strong> (Прицел: ${aim}, 1/2: ${halfAim})${bonusText}<br>Нужно выбросить: <strong>${neededScore}+</strong>`;
    resultMsg.textContent = 'Кубик летит и кувыркается...';
    resultMsg.className = 'dice-result-msg';
    closeBtn.style.display = 'none';
    overlay.classList.add('active');

    const rotations = {
      1: { x: 0, y: 0 },
      2: { x: 0, y: 180 },
      3: { x: 0, y: 90 },
      4: { x: 0, y: -90 },
      5: { x: -90, y: 0 },
      6: { x: 90, y: 0 }
    };

    // 1. Фаза быстрого беспорядочного кувыркания кубика (tumble)
    cube.style.transition = 'transform 0.4s ease-in';
    const randTumbleX = (Math.random() > 0.5 ? 360 : -360) + Math.floor(Math.random() * 180);
    const randTumbleY = (Math.random() > 0.5 ? 360 : -360) + Math.floor(Math.random() * 180);
    cube.style.transform = `rotateX(${randTumbleX}deg) rotateY(${randTumbleY}deg)`;

    // 2. Фаза замедления и падения на целевую грань
    setTimeout(() => {
      sounds.playDiceRoll();
      const rot = rotations[rawRoll];
      const extraRotX = 720 + rot.x;
      const extraRotY = 720 + rot.y;

      cube.style.transition = 'transform 1.1s cubic-bezier(0.15, 0.9, 0.2, 1)';
      cube.style.transform = `rotateX(${extraRotX}deg) rotateY(${extraRotY}deg)`;
    }, 420);

    const currentTurnPlayer = this.players[this.currentPlayerIndex];
    const isBot = currentTurnPlayer ? currentTurnPlayer.isBot : false;

    setTimeout(() => {
      const isSuccess = finalRoll >= neededScore;
      let totalStr = `${rawRoll}`;
      if (diceBonus !== 0) {
        totalStr += `${diceBonus >= 0 ? '+' : ''}${diceBonus} = ${finalRoll}`;
      }

      if (isSuccess) {
        resultMsg.textContent = `🎯 Результат: ${totalStr}! УСПЕХ!`;
        resultMsg.classList.add('hit');
      } else {
        resultMsg.textContent = `💨 Результат: ${totalStr}! ПРОМАХ!`;
        resultMsg.classList.add('miss');
      }

      if (isBot) {
        setTimeout(() => {
          overlay.classList.remove('active');
          if (onComplete) onComplete();
        }, 1200);
      } else {
        closeBtn.style.display = 'inline-block';
        closeBtn.onclick = () => {
          overlay.classList.remove('active');
          if (onComplete) onComplete();
        };
      }
    }, 1650);
  }

  // 3. ДЕЙСТВИЕ: Пропуск хода
  handlePlayerActionSkip() {
    sounds.playClick();
    const player = this.players[this.currentPlayerIndex];
    this.logCombat(`${player.name} завершил ход без действий.`, 'system');
    this.endTurn();
  }

  endTurn() {
    this.turnPhase = 'ended';
    this.selectedSnowballIndex = null;
    const btnCancel = document.getElementById('btnActionCancelAim');
    if (btnCancel) btnCancel.style.display = 'none';
    const btnThrow = document.getElementById('btnActionThrow');
    if (btnThrow) btnThrow.classList.remove('active');
    this.setButtonsDisabled(true);

    if (!this.checkVictoryCondition()) {
      // Небольшая естественная пауза перед передачей хода следующему участнику (500 мс)
      setTimeout(() => {
        this.nextPlayer();
      }, 500);
    }
  }

  nextPlayer() {
    // Проверяем, есть ли победитель перед переходом
    if (this.checkVictoryCondition()) return;

    let attempts = 0;
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      if (this.currentPlayerIndex === 0) {
        this.currentRound++;
        const roundBadge = document.getElementById('roundCounter');
        if (roundBadge) roundBadge.textContent = `Раунд ${this.currentRound}`;
      }
      attempts++;
    } while (this.players[this.currentPlayerIndex].eliminated && attempts < this.players.length + 2);

    // Запускаем ход найденного игрока
    this.startTurn();
  }

  // ==========================================================================
  // ЛОГИКА ИСКУССТВЕННОГО ИНТЕЛЛЕКТА (БОТОВ)
  // ==========================================================================
  executeBotTurn() {
    const bot = this.players[this.currentPlayerIndex];
    if (bot.eliminated) {
      this.nextPlayer();
      return;
    }

    // Находим живых соперников
    const opponents = this.players.filter((p) => p.id !== bot.id && !p.eliminated);
    if (opponents.length === 0) return;

    // Сортируем противников по расстоянию
    opponents.sort((a, b) => HexMath.distance(bot, a) - HexMath.distance(bot, b));
    const nearest = opponents[0];
    const initialDist = HexMath.distance(bot, nearest);

    // 1. Движение бота: приближение к цели или отступление
    const proceedWithAction = () => {
      setTimeout(() => {
        // Проверяем, жив ли еще бот и принадлежит ли ему ход
        if (bot.eliminated || this.currentPlayerIndex !== bot.id) return;

        // Если снежков нет в руке — обязательно лепим снежок!
        if (bot.hand.length === 0) {
          sounds.playSnowballGather();
          const card = this.getRandomSnowballCard();
          bot.hand.push(card);
          this.logCombat(`${bot.name} слепил снежок: "${card.name}" ${card.art}`, 'gather');
          this.endTurn();
          return;
        }

        // Если снежки есть — выбираем лучший или первый
        const readyCard = bot.hand[0];
        this.selectedSnowballIndex = 0;
        this.performSnowballThrow(nearest);
      }, 600);
    };

    if (this.movePointsLeft > 0) {
      const bestMove = this.findBestBotMoveTile(bot, nearest, initialDist);
      if (bestMove && (bestMove.q !== bot.q || bestMove.r !== bot.r)) {
        this.logCombat(`${bot.name} перебегает на (${bestMove.q}, ${bestMove.r})...`, 'move');
        this.animatePlayerMove(bot, bestMove.q, bestMove.r, 500, () => {
          proceedWithAction();
        });
      } else {
        proceedWithAction();
      }
    } else {
      proceedWithAction();
    }
  }

  // Поиск наилучшей клетки шага для бота
  findBestBotMoveTile(bot, target, targetDist) {
    const reachable = this.getReachableTiles(bot, this.movePointsLeft);
    if (reachable.length === 0) return null;

    // Предпочитаем клетки с холмом (высотой) или ближе к цели
    reachable.sort((a, b) => {
      const distA = HexMath.distance(a, target);
      const distB = HexMath.distance(b, target);
      if (a.isHill && !b.isHill) return -1;
      return distA - distB;
    });

    return reachable[0];
  }

  // ==========================================================================
  // ПРОВЕРКА ПОБЕДЫ В РЕЖИМЕ FFA
  // ==========================================================================
  checkVictoryCondition() {
    const alivePlayers = this.players.filter((p) => !p.eliminated);
    if (alivePlayers.length <= 1) {
      this.winner = alivePlayers[0] || null;
      this.showGameOverModal(this.winner);
      return true;
    }
    return false;
  }

  showGameOverModal(winner) {
    sounds.playVictory();
    const modal = document.getElementById('gameOverModal');
    const title = document.getElementById('winnerTitle');
    const preview = document.getElementById('winnerPreview');
    const subtitle = document.getElementById('winnerSubtitle');

    if (winner) {
      title.textContent = `ПОБЕДИЛ ${winner.name.toUpperCase()}!`;
      preview.textContent = winner.art;
      preview.style.borderColor = winner.color;
      subtitle.textContent = `Победил всех ребят и стал безоговорочным королем двора!`;
    } else {
      title.textContent = `НИЧЬЯ!`;
      preview.textContent = '❄️';
      subtitle.textContent = `Все попадали в сугробы!`;
    }

    modal.classList.add('active');
  }

  // ==========================================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ГЕКСОВ И КАРТ
  // ==========================================================================
  getRandomSnowballCard() {
    const idx = Math.floor(Math.random() * SNOWBALL_CARDS.length);
    return { ...SNOWBALL_CARDS[idx] };
  }

  // Поиск доступных клеток для хода (BFS)
  getReachableTiles(startPos, maxSteps) {
    const visited = new Map();
    const queue = [{ q: startPos.q, r: startPos.r, dist: 0 }];
    visited.set(`${startPos.q},${startPos.r}`, 0);

    const result = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current.dist >= maxSteps) continue;

      HEX_DIRECTIONS.forEach((dir) => {
        const nq = current.q + dir.q;
        const nr = current.r + dir.r;
        const key = `${nq},${nr}`;

        if (!visited.has(key)) {
          const tile = this.map.tiles.get(key);
          // Клетка существует, не препятствие и на ней не стоит другой игрок
          if (tile && !tile.isObstacle) {
            const hasOtherPlayer = this.players.some(
              (p) => !p.eliminated && p.q === nq && p.r === nr
            );
            if (!hasOtherPlayer) {
              visited.set(key, current.dist + 1);
              queue.push({ q: nq, r: nr, dist: current.dist + 1 });
              result.push(tile);
            }
          }
        }
      });
    }

    return result;
  }

  // Плавное перемещение игрока по гексам за 500 миллисекунд
  animatePlayerMove(player, targetQ, targetR, duration = 500, onDone = null) {
    const startPx = HexMath.axialToPixel(player.q, player.r);
    const endPx = HexMath.axialToPixel(targetQ, targetR);
    const startTime = performance.now();

    player.isMoving = true;
    sounds.playStep();

    const updatePosition = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Easing cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);

      player.animX = startPx.x + (endPx.x - startPx.x) * ease;
      player.animY = startPx.y + (endPx.y - startPx.y) * ease;

      if (progress < 1) {
        requestAnimationFrame(updatePosition);
      } else {
        player.q = targetQ;
        player.r = targetR;
        player.animX = null;
        player.animY = null;
        player.isMoving = false;
        sounds.playStep();
        if (onDone) onDone();
      }
    };

    requestAnimationFrame(updatePosition);
  }

  // ==========================================================================
  // ИНТЕРАКТИВ ХОЛСТА И КЛИКИ МЫШИ
  // ==========================================================================
  setupCanvasInteractions() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        this.camera.x += dx;
        this.camera.y += dy;
        this.dragStart = { x: e.clientX, y: e.clientY };
      }

      this.handleCanvasMouseMove(e);
    });

    this.canvas.addEventListener('click', (e) => {
      this.handleCanvasClick(e);
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.camera.zoom = Math.min(1.8, Math.max(0.5, this.camera.zoom * zoomFactor));
    });
  }

  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Преобразуем экранные координаты в мировые координаты с учетом камеры
    const worldX = (mouseX - this.canvas.width / 2 - this.camera.x) / this.camera.zoom;
    const worldY = (mouseY - this.canvas.height / 2 - this.camera.y) / this.camera.zoom;

    const hex = HexMath.pixelToAxial(worldX, worldY);
    return { worldX, worldY, hex };
  }

  handleCanvasMouseMove(e) {
    const { hex } = this.getCanvasCoords(e);
    const key = `${hex.q},${hex.r}`;
    const tile = this.map?.tiles.get(key);
    this.hoveredHex = tile ? hex : null;

    // Тултип клетки
    const tooltip = document.getElementById('hexTooltip');
    if (tile) {
      const occupant = this.players.find(
        (p) => !p.eliminated && p.q === hex.q && p.r === hex.r
      );
      tooltip.style.display = 'block';
      tooltip.style.left = `${e.clientX + 14}px`;
      tooltip.style.top = `${e.clientY + 14}px`;

      let terrainName = 'Чистый снег';
      if (tile.isHill) terrainName = '⛰️ Снежный холм (+1 к прицелу)';
      if (tile.isSnowdrift) terrainName = '🌨️ Глубокий сугроб';
      if (tile.isObstacle) terrainName = '🌲 Снежная ель (препятствие)';
      if (tile.terrain === 'ice') terrainName = '⛸️ Скользкий лед';

      let text = `<strong>Гекс (${hex.q}, ${hex.r})</strong><br>${terrainName}`;
      if (occupant) {
        text += `<br>👤 <strong>${occupant.name}</strong> (HP: ${occupant.hp}/${occupant.maxHp})`;
      }
      tooltip.innerHTML = text;
    } else {
      tooltip.style.display = 'none';
    }
  }

  handleCanvasClick(e) {
    if (!this.map) return;
    const { hex } = this.getCanvasCoords(e);
    const player = this.players[this.currentPlayerIndex];
    if (!player || player.isBot) return;

    const clickedKey = `${hex.q},${hex.r}`;
    const tile = this.map.tiles.get(clickedKey);
    if (!tile) return;

    // 1. ФАЗА ДВИЖЕНИЯ
    if (this.turnPhase === 'move') {
      if (player.isMoving) return; // Игрок уже плавно перемещается
      const reachable = this.getReachableTiles(player, this.movePointsLeft);
      const isReachable = reachable.some((t) => t.q === hex.q && t.r === hex.r);

      if (isReachable) {
        const dist = HexMath.distance(player, hex);
        this.movePointsLeft -= dist;
        this.logCombat(`${player.name} идет на (${hex.q}, ${hex.r})... Осталось шагов: ${this.movePointsLeft}`, 'move');
        this.updateHud();

        // Запуск плавной интерполяции движения (500 мс)
        this.animatePlayerMove(player, hex.q, hex.r, 500, () => {
          if (this.movePointsLeft <= 0) {
            this.updateInstruction('Очки шагов исчерпаны! Выберите действие: Собрать, Метнуть или Пропустить.');
          }
        });
      }
    }
    // 2. ФАЗА ВЫБОРА ЦЕЛИ ДЛЯ МЕТАНИЯ
    else if (this.turnPhase === 'throw_target') {
      const targetPlayer = this.players.find(
        (p) => !p.eliminated && p.id !== player.id && p.q === hex.q && p.r === hex.r
      );

      if (targetPlayer) {
        this.performSnowballThrow(targetPlayer);
      } else {
        // Если кликнули по свободной клетке поля в режиме прицела:
        // Если у игрока еще есть шаги — переключаем в движение на эту клетку!
        const reachable = this.getReachableTiles(player, this.movePointsLeft);
        const isReachable = reachable.some((t) => t.q === hex.q && t.r === hex.r);
        if (isReachable) {
          this.cancelThrowMode();
          // Перемещаемся на выбранный гекс
          const dist = HexMath.distance(player, hex);
          this.movePointsLeft -= dist;
          this.logCombat(`${player.name} идет на (${hex.q}, ${hex.r})... Осталось шагов: ${this.movePointsLeft}`, 'move');
          this.updateHud();
          this.animatePlayerMove(player, hex.q, hex.r, 500, () => {
            if (this.movePointsLeft <= 0) {
              this.updateInstruction('Очки шагов исчерпаны! Выберите действие: Собрать, Метнуть или Пропустить.');
            }
          });
        } else {
          // Предлагаем отменить прицел или выбрать соперника
          this.updateInstruction('Кликните по сопернику для броска, или нажмите "Отмена / Шаг", чтобы отменить бросок.');
        }
      }
    }
  }

  // ==========================================================================
  // ВИЗУАЛИЗАЦИЯ И РЕНДЕРИНГ ХОЛСТА (CANVAS)
  // ==========================================================================
  resizeCanvas() {
    const wrapper = document.getElementById('battlefieldWrapper');
    if (!wrapper || !this.canvas) return;
    this.canvas.width = wrapper.clientWidth;
    this.canvas.height = wrapper.clientHeight;
  }

  centerCamera() {
    this.camera.x = 0;
    this.camera.y = 0;
    this.camera.zoom = 1.0;
  }

  renderLoop(timestamp) {
    this.updateSnow();

    if (this.currentScreen === 'gameScreen' && this.ctx && this.map) {
      this.drawBattlefield();
    }

    requestAnimationFrame((t) => this.renderLoop(t));
  }

  drawBattlefield() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    // Применяем трансформацию камеры
    ctx.translate(w / 2 + this.camera.x, h / 2 + this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    // Доступные для хода клетки
    const currentPlayer = this.players[this.currentPlayerIndex];
    let reachableTiles = [];
    if (this.turnPhase === 'move' && currentPlayer && !currentPlayer.isBot) {
      reachableTiles = this.getReachableTiles(currentPlayer, this.movePointsLeft);
    }

    // 1. Рисуем гексы поля (фон, снег, холмы, укрытия)
    for (const [key, tile] of this.map.tiles.entries()) {
      const pos = HexMath.axialToPixel(tile.q, tile.r);
      const isReachable = reachableTiles.some((t) => t.q === tile.q && t.r === tile.r);
      const isHovered = this.hoveredHex && this.hoveredHex.q === tile.q && this.hoveredHex.r === tile.r;

      this.drawHexTile(ctx, pos.x, pos.y, tile, isReachable, isHovered);
    }

    // 2. Рисуем игроков на гексах
    this.players.forEach((p) => {
      if (!p.eliminated) {
        const px = p.animX !== null ? p.animX : HexMath.axialToPixel(p.q, p.r).x;
        const py = p.animY !== null ? p.animY : HexMath.axialToPixel(p.q, p.r).y;
        const isCurrent = p.id === this.players[this.currentPlayerIndex]?.id;
        this.drawPlayerToken(ctx, px, py, p, isCurrent);
      }
    });

    // 2.5 Рисуем стрелку прицеливания от активного игрока к цели
    this.drawAimingArrow(ctx, currentPlayer);

    // 3. Анимация летящих снежков
    this.updateAndDrawFlyingSnowballs(ctx);

    ctx.restore();
  }

  drawHexTile(ctx, x, y, tile, isReachable, isHovered) {
    const r = HEX_RADIUS;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      const hx = x + r * Math.cos(angle);
      const hy = y + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();

    // Плавный градиент для снежной текстуры
    let fillColor = '#eaf5ff';
    let strokeColor = 'rgba(160, 205, 240, 0.4)';

    if (tile.isHill) {
      // Центральный холм с высотой
      const hillGrad = ctx.createRadialGradient(x, y, 2, x, y, r);
      hillGrad.addColorStop(0, '#ffffff');
      hillGrad.addColorStop(0.5, '#bce1ff');
      hillGrad.addColorStop(1, '#81bcf0');
      fillColor = hillGrad;
      strokeColor = '#42a5f5';
    } else if (tile.terrain === 'ice') {
      fillColor = '#b3e5fc';
      strokeColor = '#4fc3f7';
    } else if (tile.isSnowdrift) {
      fillColor = '#dcf0ff';
    } else {
      // Обычный снег с мягким переливом зон
      const baseL = 92 + Math.floor(tile.decorSeed * 6);
      fillColor = `hsl(210, 50%, ${baseL}%)`;
    }

    if (isReachable) {
      fillColor = 'rgba(129, 212, 250, 0.7)';
      strokeColor = '#0288d1';
    }

    if (isHovered) {
      fillColor = '#ffecb3';
      strokeColor = '#ffa000';
    }

    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.lineWidth = isHovered ? 2.5 : (tile.isHill ? 2 : 1);
    ctx.strokeStyle = strokeColor;
    ctx.stroke();

    // Декорации клеток (деревья, сугробы, холм)
    if (tile.isHill) {
      ctx.fillStyle = '#1565c0';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⛰️ +1', x, y - 6);
    } else if (tile.isObstacle) {
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🌲', x, y);
    } else if (tile.isSnowdrift) {
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🌨️', x, y);
    }
  }

  drawPlayerToken(ctx, x, y, player, isCurrent) {
    const r = HEX_RADIUS * 0.75;
    const now = performance.now();

    // Яркое пульсирующее кольцо и указатель над активным игроком
    if (isCurrent) {
      ctx.save();
      const pulse = Math.sin(now * 0.006) * 4;
      const ringRadius = r + 7 + pulse;

      // Внешнее свечение
      ctx.beginPath();
      ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffd700';
      ctx.shadowColor = '#ffe082';
      ctx.shadowBlur = 12;
      ctx.stroke();

      // Указатель активного хода над головой (плавающая стрелка-маркер)
      const arrowBounce = Math.sin(now * 0.008) * 4;
      const arrowY = y - r - 22 + arrowBounce;
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.moveTo(x, arrowY + 10);
      ctx.lineTo(x - 7, arrowY);
      ctx.lineTo(x + 7, arrowY);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();

      ctx.restore();
    }

    // Базовый жетон
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = player.color || '#2196f3';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Иконка персонажа
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.art, x, y);

    // Полоска здоровья над головой
    const barW = 26;
    const barH = 4;
    const barX = x - barW / 2;
    const barY = y - r - 8;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, barH);

    const hpRatio = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = hpRatio > 0.5 ? '#4caf50' : (hpRatio > 0.25 ? '#ff9800' : '#f44336');
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
  }

  // Отрисовка тактической стрелки прицела от игрока к цели или курсору
  drawAimingArrow(ctx, currentPlayer) {
    if (!currentPlayer || this.turnPhase !== 'throw_target') return;

    const fromPx = HexMath.axialToPixel(currentPlayer.q, currentPlayer.r);
    let toPx = null;
    let targetPlayer = null;

    // Проверяем, наведен ли курсор на гекс другого игрока
    if (this.hoveredHex) {
      targetPlayer = this.players.find(
        (p) => !p.eliminated && p.id !== currentPlayer.id && p.q === this.hoveredHex.q && p.r === this.hoveredHex.r
      );
    }

    if (targetPlayer) {
      toPx = HexMath.axialToPixel(targetPlayer.q, targetPlayer.r);
    } else if (this.hoveredHex) {
      toPx = HexMath.axialToPixel(this.hoveredHex.q, this.hoveredHex.r);
    }

    if (!toPx) return;

    const card = currentPlayer.hand[this.selectedSnowballIndex] || SNOWBALL_CARDS[0];
    const aim = this.getEffectiveAimRange(currentPlayer);
    const dist = HexMath.distance(currentPlayer, this.hoveredHex);
    const diceBonus = card.rangeMod || 0;

    // В новой системе можно кидать на любую дистанцию, но дальше прицела сложность растет
    const inOptimalRange = dist <= aim;

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -performance.now() * 0.02; // Бегущий пунктир
    ctx.moveTo(fromPx.x, fromPx.y);
    ctx.lineTo(toPx.x, toPx.y);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = inOptimalRange ? '#00e676' : '#ffb300';
    ctx.stroke();

    // Наконечник стрелки
    const angle = Math.atan2(toPx.y - fromPx.y, toPx.x - fromPx.x);
    const headLen = 14;
    ctx.setLineDash([]);
    ctx.fillStyle = inOptimalRange ? '#00e676' : '#ffb300';
    ctx.beginPath();
    ctx.moveTo(toPx.x, toPx.y);
    ctx.lineTo(toPx.x - headLen * Math.cos(angle - Math.PI / 6), toPx.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toPx.x - headLen * Math.cos(angle + Math.PI / 6), toPx.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Значок цели и расчёт броска над целью
    if (targetPlayer) {
      const halfAim = Math.floor(aim / 2);
      let needed = dist <= halfAim ? 2 : (dist <= aim ? 4 : 4 + (dist - aim));
      needed = Math.max(1, needed);

      let badgeText = `Кубик: ${needed}+`;
      if (diceBonus > 0) badgeText += ` (+${diceBonus})`;
      else if (diceBonus < 0) badgeText += ` (${diceBonus})`;

      ctx.fillStyle = 'rgba(10, 25, 47, 0.9)';
      ctx.fillRect(toPx.x - 45, toPx.y - 45, 90, 22);
      ctx.strokeStyle = inOptimalRange ? '#00e676' : '#ffb300';
      ctx.lineWidth = 1;
      ctx.strokeRect(toPx.x - 45, toPx.y - 45, 90, 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, toPx.x, toPx.y - 34);
    }

    ctx.restore();
  }

  // Анимация полета снежка
  spawnFlyingSnowball(fromPlayer, toPlayer, onLand) {
    const start = HexMath.axialToPixel(fromPlayer.q, fromPlayer.r);
    const end = HexMath.axialToPixel(toPlayer.q, toPlayer.r);

    this.flyingSnowballs.push({
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      progress: 0,
      speed: 0.05,
      onLand
    });
  }

  updateAndDrawFlyingSnowballs(ctx) {
    for (let i = this.flyingSnowballs.length - 1; i >= 0; i--) {
      const b = this.flyingSnowballs[i];
      b.progress += b.speed;

      // Параболическая траектория
      const curX = b.startX + (b.endX - b.startX) * b.progress;
      const curY = b.startY + (b.endY - b.startY) * b.progress;
      const arcHeight = Math.sin(b.progress * Math.PI) * -35;

      ctx.save();
      ctx.beginPath();
      ctx.arc(curX, curY + arcHeight, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#90caf9';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();

      if (b.progress >= 1) {
        if (b.onLand) b.onLand();
        this.flyingSnowballs.splice(i, 1);
      }
    }
  }

  // ==========================================================================
  // ОБНОВЛЕНИЕ HUD И БОКОВЫХ ПАНЕЛЕЙ
  // ==========================================================================
  updateHud() {
    const player = this.players[this.currentPlayerIndex];
    if (!player) return;

    document.getElementById('currentTurnAvatar').textContent = player.art;
    document.getElementById('currentTurnAvatar').style.borderColor = player.color;
    document.getElementById('currentTurnName').textContent = `Ход: ${player.name}`;

    let phaseName = 'Фаза движения';
    if (this.turnPhase === 'throw_target') phaseName = 'Выбор цели для броска';
    if (this.turnPhase === 'ended') phaseName = 'Ход завершен';
    document.getElementById('currentTurnPhase').textContent = phaseName;

    document.getElementById('movePointsVal').textContent = this.movePointsLeft;
  }

  updateInstruction(text) {
    document.getElementById('instructionBanner').textContent = text;
  }

  setButtonsDisabled(disabled) {
    document.getElementById('btnActionGather').disabled = disabled;
    document.getElementById('btnActionThrow').disabled = disabled;
    document.getElementById('btnActionSkip').disabled = disabled;
  }

  updateHandDisplay() {
    const player = this.players[this.currentPlayerIndex];
    const container = document.getElementById('cardsCarousel');
    const countBadge = document.getElementById('handCount');

    if (!player) return;
    countBadge.textContent = player.hand.length;
    container.innerHTML = '';

    if (player.hand.length === 0) {
      container.innerHTML = `<div style="color:var(--text-muted); font-size:0.85rem; padding:10px;">В карманах пусто! Слепите снежок нажав кнопку "Собрать".</div>`;
      return;
    }

    player.hand.forEach((card, idx) => {
      const cardEl = document.createElement('div');
      cardEl.className = `snowball-card ${this.selectedSnowballIndex === idx ? 'selected' : ''}`;

      cardEl.innerHTML = `
        <div class="card-top">
          <span class="card-title">${card.name}</span>
          <span>${card.art}</span>
        </div>
        <div class="card-art">${card.art}</div>
        <div class="card-stats">
          <span>💥 ${card.damageMod >= 0 ? '+' + card.damageMod : card.damageMod}</span>
          <span title="Модификатор к броску кубика">🎲 ${card.rangeMod >= 0 ? '+' + card.rangeMod : card.rangeMod}</span>
        </div>
        ${card.effect ? `<div class="card-effect">${card.effect.name}</div>` : ''}
      `;

      cardEl.addEventListener('click', () => {
        if (player.isBot) return;
        sounds.playClick();
        // Если уже был выбран этот же снежок и мы в режиме броска — повторный клик снимает выбор!
        if (this.selectedSnowballIndex === idx && this.turnPhase === 'throw_target') {
          this.cancelThrowMode();
          return;
        }
        this.selectedSnowballIndex = idx;
        this.updateHandDisplay();
        this.handlePlayerActionThrowMode();
      });

      container.appendChild(cardEl);
    });
  }

  updateStatusSidebar() {
    const list = document.getElementById('playersStatusList');
    list.innerHTML = '';

    this.players.forEach((p, idx) => {
      const isCurrent = idx === this.currentPlayerIndex;
      const card = document.createElement('div');
      card.className = `player-status-card ${isCurrent ? 'current' : ''} ${p.eliminated ? 'eliminated' : ''}`;

      const hpPercent = Math.max(0, (p.hp / p.maxHp) * 100);

      card.innerHTML = `
        <div class="p-avatar" style="border-color:${p.color};">${p.art}</div>
        <div class="p-body">
          <div class="p-name-row">
            <span class="p-name">${p.name} ${p.isBot ? '(ИИ)' : ''}</span>
            <span class="p-hp-text">${p.hp}/${p.maxHp} HP</span>
          </div>
          <div class="hp-bar-track">
            <div class="hp-bar-fill" style="width: ${hpPercent}%;"></div>
          </div>
        </div>
      `;
      list.appendChild(card);
    });
  }

  logCombat(text, type = 'system') {
    const log = document.getElementById('combatLog');
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = text;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }
}

// Запуск игры после загрузки DOM
window.addEventListener('DOMContentLoaded', () => {
  window.game = new SnowballGame();
});
