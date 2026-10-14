// ==========================================================================
// Project Snowball - Гексагональная сетка, генерация 7 зон и математика гексов
// ==========================================================================

/*
  Координатная система: осевые координаты (q, r).
  Расстояние: distance(a, b) = (abs(a.q - b.q) + abs(a.q + a.r - b.q - b.r) + abs(a.r - b.r)) / 2
  
  Поле: 7 больших шестиугольных зон.
  - 1 Центральная зона (зона 0) с центром в (0, 0)
  - 6 Окружающих зон (зоны 1..6)
  
  Каждая шестиугольная зона состоит из гексов радиуса R_ZONE = 2 
  (радиус 2 дает 1 + 6 + 12 = 19 гексов в каждой зоне, 7 * 19 = 133 гекса на поле).
  Центральная зона фиксирована: в центре (0,0) ВСЕГДА Холм.
  Остальные 6 зон имеют фиксированное положение, но случайно вращаются на угол k * 60° (k в 0..5).
  Текстура и высота плавно перетекают благодаря шуму (smooth height blend).
*/

const HEX_RADIUS = 26; // Размер гекса на холсте (пиксели)
const ZONE_RADIUS = 2; // Радиус одной шестиугольной зоны в гексах
const ZONE_DISTANCE = 3; // Шаг между центрами зон для бесшовного смыкания

// 6 осевых направлений гекса
const HEX_DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

class HexMath {
  static axialToPixel(q, r, radius = HEX_RADIUS) {
    // Расположение flat-topped или pointy-topped. Выбираем pointy-topped:
    const x = radius * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    const y = radius * ((3 / 2) * r);
    return { x, y };
  }

  static pixelToAxial(px, py, radius = HEX_RADIUS) {
    const q = ((Math.sqrt(3) / 3) * px - (1 / 3) * py) / radius;
    const r = ((2 / 3) * py) / radius;
    return this.axialRound(q, r);
  }

  static axialRound(q, r) {
    let s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }
    return { q: rq, r: rr };
  }

  static distance(a, b) {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
  }

  // Линия между двумя гексами (линейная интерполяция)
  static hexLine(a, b) {
    const N = this.distance(a, b);
    if (N === 0) return [this.axialRound(a.q, a.r)];
    const results = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const q = a.q + (b.q - a.q) * t;
      const r = a.r + (b.r - a.r) * t;
      results.push(this.axialRound(q, r));
    }
    return results;
  }

  // Поворот осевой координаты вокруг центра (0,0) на шаг 60° по часовой стрелке
  // Осевой поворот: (q, r, s) -> (-r, -s, -q) где s = -q-r -> (-r, q+r)
  static rotate60(q, r, steps = 1) {
    let curQ = q;
    let curR = r;
    const sCount = ((steps % 6) + 6) % 6;
    for (let i = 0; i < sCount; i++) {
      const nextQ = -curR;
      const nextR = curQ + curR;
      curQ = nextQ;
      curR = nextR;
    }
    return { q: curQ, r: curR };
  }
}

// Генератор карты из 7 зон
class MapGenerator {
  static generateMap(seed = null) {
    const tiles = new Map(); // key: "q,r" -> TileData

    // Псевдослучайный генератор от seed для синхронизации карты у всех игроков
    let s = seed !== null ? seed : Math.floor(Math.random() * 1000000);
    const pseudoRandom = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    // 7 шестиугольных зон: 1 центральная (0,0) и 6 окружающих зон.
    const zoneCenters = [
      { id: 0, q: 0, r: 0, isCenter: true, rotation: 0, name: 'Центральная высота (Холм)' },
      { id: 1, q: 3, r: 0, isCenter: false, rotation: Math.floor(pseudoRandom() * 6), name: 'Сектор двора №1' },
      { id: 2, q: 0, r: 3, isCenter: false, rotation: Math.floor(pseudoRandom() * 6), name: 'Сектор двора №2' },
      { id: 3, q: -3, r: 3, isCenter: false, rotation: Math.floor(pseudoRandom() * 6), name: 'Сектор двора №3' },
      { id: 4, q: -3, r: 0, isCenter: false, rotation: Math.floor(pseudoRandom() * 6), name: 'Сектор двора №4' },
      { id: 5, q: 0, r: -3, isCenter: false, rotation: Math.floor(pseudoRandom() * 6), name: 'Сектор двора №5' },
      { id: 6, q: 3, r: -3, isCenter: false, rotation: Math.floor(pseudoRandom() * 6), name: 'Сектор двора №6' }
    ];

    // Шаблоны ландшафта внутри зоны (до вращения)
    // Гексы локального радиуса ZONE_RADIUS: relativeQ, relativeR
    const zoneTemplates = this.getZoneTemplates();

    zoneCenters.forEach((zone) => {
      const template = zoneTemplates[zone.id % zoneTemplates.length];

      // Проходим по всем локальным гексам зоны в радиусе ZONE_RADIUS
      for (let lq = -ZONE_RADIUS; lq <= ZONE_RADIUS; lq++) {
        const r1 = Math.max(-ZONE_RADIUS, -lq - ZONE_RADIUS);
        const r2 = Math.min(ZONE_RADIUS, -lq + ZONE_RADIUS);
        for (let lr = r1; lr <= r2; lr++) {
          // Применяем вращение к локальным координатам, если это не центральная зона
          const rotated = HexMath.rotate60(lq, lr, zone.rotation);
          const worldQ = zone.q + rotated.q;
          const worldR = zone.r + rotated.r;
          const key = `${worldQ},${worldR}`;

          // Определяем тип ландшафта из шаблона с учетом поворота
          // В центральной зоне (0,0) ВСЕГДА ХОЛМ!
          let terrain = 'snow'; // базовый снег
          let isHill = false;
          let isSnowdrift = false; // сугроб (укрытие)
          let isObstacle = false; // дерево / снеговик (непроходимо)

          if (zone.isCenter && worldQ === 0 && worldR === 0) {
            isHill = true;
            terrain = 'hill';
          } else {
            // Находим исходный тип из локального шаблона
            const localKey = `${lq},${lr}`;
            const localData = template[localKey] || { type: 'snow' };
            terrain = localData.type;
            if (terrain === 'hill') isHill = true;
            if (terrain === 'drift') isSnowdrift = true;
            if (terrain === 'tree') isObstacle = true;
          }

          // Плавное перетекание высот и текстур (шум снега)
          const pixelPos = HexMath.axialToPixel(worldQ, worldR);
          const noiseValue = Math.sin(pixelPos.x * 0.02) * Math.cos(pixelPos.y * 0.02);

          tiles.set(key, {
            q: worldQ,
            r: worldR,
            zoneId: zone.id,
            terrain, // 'snow' | 'hill' | 'drift' | 'tree' | 'ice'
            isHill,
            isSnowdrift,
            isObstacle,
            height: isHill ? 2 : (noiseValue > 0.4 ? 1 : 0),
            decorSeed: Math.abs(Math.sin(worldQ * 12.9898 + worldR * 78.233))
          });
        }
      }
    });

    return {
      tiles,
      zoneCenters
    };
  }

  // Шаблоны зон двора
  static getZoneTemplates() {
    // Каждая зона имеет характерные объекты: снеговики, сугробы для укрытия, ледяные дорожки
    return [
      // Шаблон 0: Холм в центре + кольцо чистого снега (для центральной зоны)
      {
        '0,0': { type: 'hill' },
        '1,-1': { type: 'drift' },
        '-1,1': { type: 'drift' }
      },
      // Шаблон 1: Снежная рощица (дерево и сугроб)
      {
        '0,1': { type: 'tree' },
        '1,0': { type: 'drift' },
        '-1,-1': { type: 'snow' },
        '0,-1': { type: 'ice' }
      },
      // Шаблон 2: Каток и снежная крепость
      {
        '0,0': { type: 'ice' },
        '1,-1': { type: 'drift' },
        '0,-1': { type: 'tree' }
      },
      // Шаблон 3: Двойной сугроб
      {
        '1,1': { type: 'drift' },
        '-1,0': { type: 'drift' },
        '0,0': { type: 'snow' }
      },
      // Шаблон 4: Ледяная тропа
      {
        '-1,1': { type: 'ice' },
        '0,0': { type: 'ice' },
        '1,-1': { type: 'ice' },
        '0,1': { type: 'tree' }
      }
    ];
  }
}
