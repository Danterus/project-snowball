// ==========================================================================
// Project Snowball - Мультиплеерный модуль (WebRTC P2P через бесплатный PeerJS)
// Позволяет играть между разными компьютерами, телефонами и вкладками без своего сервера!
// ==========================================================================

class MultiplayerManager {
  constructor() {
    this.peer = null;
    this.connections = []; // Активные P2P соединения
    this.hostConnection = null; // Для гостя: соединение с хостом
    this.roomCode = null;
    this.isHost = false;
    this.myPlayerId = null;
    this.onMessageCallback = null;
    this.onPlayerJoinedCallback = null;
    this.connectedPeers = new Map(); // peerId -> { slotIndex, name }
  }

  // Генерация компактного кода комнаты
  generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'SNOW-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Инициализация хоста: Peer ID привязывается к коду комнаты
  createRoom(code, onReady, onPlayerJoin) {
    this.roomCode = code.toUpperCase().trim();
    this.isHost = true;
    this.onPlayerJoinedCallback = onPlayerJoin;

    // Префикс для уникальности на публичном сервере PeerJS
    const peerId = `snowball_room_${this.roomCode.replace('-', '_').toLowerCase()}`;
    this.myPlayerId = peerId;

    if (this.peer) this.peer.destroy();

    // Подключаемся к бесплатному публичному PeerJS Cloud
    this.peer = new Peer(peerId, {
      debug: 1
    });

    this.peer.on('open', (id) => {
      console.log('Хост комнаты открыт, Peer ID:', id);
      if (onReady) onReady(this.roomCode);
    });

    this.peer.on('connection', (conn) => {
      console.log('Новое входящее подключение игрока:', conn.peer);
      this.setupHostConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.warn('Peer error (хост):', err);
      if (err.type === 'unavailable-id') {
        // Если ID занят, генерируем новый код
        const newCode = this.generateRoomCode();
        this.createRoom(newCode, onReady, onPlayerJoin);
      }
    });
  }

  setupHostConnection(conn) {
    conn.on('open', () => {
      this.connections.push(conn);

      // Отправляем новому игроку подтверждение входа
      conn.send({
        type: 'WELCOME_PLAYER',
        roomCode: this.roomCode,
        assignedSlot: this.connections.length // слот 1, 2, ...
      });

      if (this.onPlayerJoinedCallback) {
        this.onPlayerJoinedCallback({
          peerId: conn.peer,
          slot: this.connections.length
        });
      }
    });

    conn.on('data', (data) => {
      this.handleIncomingData(data);
      // Хост ретранслирует полученное действие всем остальным игрокам
      this.broadcastFromHost(data, conn);
    });

    conn.on('close', () => {
      this.connections = this.connections.filter(c => c !== conn);
      console.log('Игрок отключился:', conn.peer);
    });
  }

  // Подключение гостя к созданной комнате
  joinRoom(code, onConnected, onError) {
    this.roomCode = code.toUpperCase().trim();
    this.isHost = false;

    if (this.peer) this.peer.destroy();

    this.peer = new Peer({
      debug: 1
    });

    this.peer.on('open', (myId) => {
      this.myPlayerId = myId;
      const targetHostPeerId = `snowball_room_${this.roomCode.replace('-', '_').toLowerCase()}`;
      console.log('Подключаемся к хосту комнаты:', targetHostPeerId);

      const conn = this.peer.connect(targetHostPeerId, {
        reliable: true
      });

      conn.on('open', () => {
        this.hostConnection = conn;
        console.log('Успешно подключились к хосту комнаты!');
        if (onConnected) onConnected(this.roomCode);
      });

      conn.on('data', (data) => {
        this.handleIncomingData(data);
      });

      conn.on('error', (err) => {
        console.error('Ошибка соединения с хостом:', err);
        if (onError) onError(err);
      });
    });

    this.peer.on('error', (err) => {
      console.error('Peer error (клиент):', err);
      if (onError) onError(err);
    });
  }

  // Отправка сообщения по сети
  sendNetworkAction(payload) {
    const data = {
      ...payload,
      roomCode: this.roomCode,
      senderId: this.myPlayerId,
      timestamp: Date.now()
    };

    if (this.isHost) {
      // Хост рассылает всем подключенным клиентам
      this.broadcastFromHost(data);
    } else if (this.hostConnection && this.hostConnection.open) {
      // Клиент отправляет хосту
      this.hostConnection.send(data);
    }
  }

  broadcastFromHost(data, exceptConn = null) {
    this.connections.forEach(conn => {
      if (conn !== exceptConn && conn.open) {
        conn.send(data);
      }
    });
  }

  handleIncomingData(data) {
    if (!data) return;
    if (this.onMessageCallback) {
      this.onMessageCallback(data);
    }
  }

  onMessage(callback) {
    this.onMessageCallback = callback;
  }
}

const network = new MultiplayerManager();
