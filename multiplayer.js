// ==========================================================================
// Project Snowball - Мультиплеерный модуль (WebRTC P2P через бесплатный PeerJS)
// Полноценный обмен состоянием лобби, готовностью, синхронизацией слотов и имен!
// ==========================================================================

class MultiplayerManager {
  constructor() {
    this.peer = null;
    this.connections = []; // Активные P2P соединения у хоста
    this.hostConnection = null; // Для гостя: соединение с хостом
    this.roomCode = null;
    this.isHost = false;
    this.myPlayerId = null;
    this.mySlotIndex = 0;
    this.isReady = false;
    this.playerName = 'Игрок';

    this.onMessageCallback = null;
    this.onRoomStateUpdateCallback = null;

    // Состояние комнаты (синхронизируется хостом)
    this.roomState = {
      playerCount: 3,
      slots: []
    };
  }

  generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'SNOW-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Хост создает комнату
  createRoom(code, hostName, onReady) {
    this.roomCode = code.toUpperCase().trim();
    this.isHost = true;
    this.mySlotIndex = 0;
    this.isReady = true; // Хост всегда готов
    this.playerName = hostName || 'Хост';

    const peerId = `snowball_room_${this.roomCode.replace('-', '_').toLowerCase()}`;
    this.myPlayerId = peerId;

    // Инициализируем слоты комнаты
    this.roomState = {
      playerCount: this.roomState.playerCount || 3,
      slots: [
        { slot: 0, name: this.playerName, isHost: true, isReady: true, isConnected: true, peerId }
      ]
    };
    this.fillEmptySlots();

    if (this.peer) this.peer.destroy();

    this.peer = new Peer(peerId, { debug: 1 });

    this.peer.on('open', (id) => {
      console.log('Хост комнаты открыт:', id);
      if (onReady) onReady(this.roomCode);
      if (this.onRoomStateUpdateCallback) {
        this.onRoomStateUpdateCallback(this.roomState);
      }
    });

    this.peer.on('connection', (conn) => {
      this.setupHostConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.warn('Peer error (хост):', err);
      if (err.type === 'unavailable-id') {
        const newCode = this.generateRoomCode();
        this.createRoom(newCode, hostName, onReady);
      }
    });
  }

  fillEmptySlots() {
    // Заполняем остальные слоты
    for (let i = 1; i < this.roomState.playerCount; i++) {
      if (!this.roomState.slots[i]) {
        this.roomState.slots[i] = {
          slot: i,
          name: `Игрок ${i + 1}`,
          isHost: false,
          isReady: false,
          isConnected: false,
          peerId: null
        };
      }
    }
    // Обрезаем, если уменьшили количество слотов
    this.roomState.slots = this.roomState.slots.slice(0, this.roomState.playerCount);
  }

  // Хост меняет количество игроков
  setPlayerCount(count) {
    if (!this.isHost) return;
    this.roomState.playerCount = count;
    this.fillEmptySlots();
    this.syncRoomState();
  }

  setupHostConnection(conn) {
    conn.on('open', () => {
      // Ищем свободный слот для игрока
      let freeSlot = this.roomState.slots.findIndex(s => !s.isConnected && !s.isHost);
      if (freeSlot === -1 && this.roomState.slots.length < this.roomState.playerCount) {
        freeSlot = this.roomState.slots.length;
      }

      if (freeSlot === -1) {
        conn.send({ type: 'ROOM_FULL' });
        conn.close();
        return;
      }

      conn.slotIndex = freeSlot;
      this.connections.push(conn);

      this.roomState.slots[freeSlot] = {
        slot: freeSlot,
        name: `Игрок ${freeSlot + 1}`,
        isHost: false,
        isReady: false,
        isConnected: true,
        peerId: conn.peer
      };

      // Отправляем игроку его слот и актуальное состояние лобби
      conn.send({
        type: 'ROOM_STATE_SYNC',
        roomState: this.roomState,
        assignedSlot: freeSlot
      });

      this.syncRoomState();
    });

    conn.on('data', (data) => {
      this.handleHostReceivedData(data, conn);
    });

    conn.on('close', () => {
      this.connections = this.connections.filter(c => c !== conn);
      if (conn.slotIndex !== undefined && this.roomState.slots[conn.slotIndex]) {
        this.roomState.slots[conn.slotIndex].isConnected = false;
        this.roomState.slots[conn.slotIndex].isReady = false;
        this.syncRoomState();
      }
    });
  }

  // Клиент подключается к комнате
  joinRoom(code, clientName, onConnected, onError) {
    this.roomCode = code.toUpperCase().trim();
    this.isHost = false;
    this.isReady = false;
    this.playerName = clientName || 'Гость';

    if (this.peer) this.peer.destroy();

    this.peer = new Peer({ debug: 1 });

    this.peer.on('open', (myId) => {
      this.myPlayerId = myId;
      const targetHostPeerId = `snowball_room_${this.roomCode.replace('-', '_').toLowerCase()}`;

      const conn = this.peer.connect(targetHostPeerId, { reliable: true });

      conn.on('open', () => {
        this.hostConnection = conn;
        // Отправляем хосту инфо о себе (имя)
        conn.send({
          type: 'CLIENT_HELLO',
          name: this.playerName
        });
        if (onConnected) onConnected(this.roomCode);
      });

      conn.on('data', (data) => {
        this.handleClientReceivedData(data);
      });

      conn.on('error', (err) => {
        if (onError) onError(err);
      });
    });

    this.peer.on('error', (err) => {
      if (onError) onError(err);
    });
  }

  // Обработка данных хостом
  handleHostReceivedData(data, conn) {
    if (!data) return;

    if (data.type === 'CLIENT_HELLO') {
      const slot = conn.slotIndex;
      if (slot !== undefined && this.roomState.slots[slot]) {
        this.roomState.slots[slot].name = data.name || `Игрок ${slot + 1}`;
        this.syncRoomState();
      }
    } else if (data.type === 'CLIENT_READY_TOGGLE') {
      const slot = conn.slotIndex;
      if (slot !== undefined && this.roomState.slots[slot]) {
        this.roomState.slots[slot].isReady = data.isReady;
        this.syncRoomState();
      }
    } else {
      // Игровое действие — транслируем
      if (this.onMessageCallback) this.onMessageCallback(data);
      this.broadcastFromHost(data, conn);
    }
  }

  // Обработка данных клиентом
  handleClientReceivedData(data) {
    if (!data) return;

    if (data.type === 'ROOM_STATE_SYNC') {
      this.roomState = data.roomState;
      if (data.assignedSlot !== undefined) {
        this.mySlotIndex = data.assignedSlot;
      }
      if (this.onRoomStateUpdateCallback) {
        this.onRoomStateUpdateCallback(this.roomState);
      }
    } else if (data.type === 'GAME_START') {
      if (this.onMessageCallback) this.onMessageCallback(data);
    } else {
      if (this.onMessageCallback) this.onMessageCallback(data);
    }
  }

  // Переключение статуса готовности клиентом
  toggleReady() {
    this.isReady = !this.isReady;
    if (!this.isHost && this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({
        type: 'CLIENT_READY_TOGGLE',
        isReady: this.isReady
      });
    }
    return this.isReady;
  }

  // Проверка: все ли подключенные клиенты нажали готовность?
  areAllClientsReady() {
    // Проверяем всех, кто подключен (кроме хоста, хост по умолчанию готов)
    const connectedClients = this.roomState.slots.filter(s => s.isConnected && !s.isHost);
    if (connectedClients.length === 0) return true; // Если только хост и боты
    return connectedClients.every(s => s.isReady);
  }

  // Хост рассылает состояние комнаты всем
  syncRoomState() {
    if (!this.isHost) return;
    this.broadcastFromHost({
      type: 'ROOM_STATE_SYNC',
      roomState: this.roomState
    });
    if (this.onRoomStateUpdateCallback) {
      this.onRoomStateUpdateCallback(this.roomState);
    }
  }

  broadcastFromHost(data, exceptConn = null) {
    this.connections.forEach(conn => {
      if (conn !== exceptConn && conn.open) {
        conn.send(data);
      }
    });
  }

  onRoomStateUpdate(callback) {
    this.onRoomStateUpdateCallback = callback;
  }

  onMessage(callback) {
    this.onMessageCallback = callback;
  }
}

const network = new MultiplayerManager();
