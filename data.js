// ==========================================================================
// Project Snowball - База данных персонажей и карт снежков
// ==========================================================================

// Виды снежков
// Поля: id, name, art, damageMod, rangeMod, effect, description
const SNOWBALL_CARDS = [
  {
    id: 'standard',
    name: 'Обычный снежок',
    art: '⚪',
    damageMod: 0,
    rangeMod: 0,
    effect: null,
    description: 'Классический плотный снежок без излишеств.'
  },
  {
    id: 'heavy',
    name: 'Тяжелый снежок',
    art: '🪨',
    damageMod: +2,
    rangeMod: -1, // -1 к броску кубика
    effect: null,
    description: 'Увесистый снежок. -1 к результату кубика, но сокрушительный урон (+2 HP)!'
  },
  {
    id: 'light',
    name: 'Легкий снежок',
    art: '⚡',
    damageMod: 0,
    rangeMod: +2, // +2 к броску кубика
    effect: null,
    description: 'Маленький аэродинамичный снежок. Дает +2 к результату броска кубика!'
  },
  {
    id: 'ice_shard',
    name: 'Ледяной осколок',
    art: '🧊',
    damageMod: +1,
    rangeMod: 0,
    effect: {
      type: 'freeze',
      duration: 1,
      movePenalty: 2,
      name: 'Обморожение (-2 очка шага)'
    },
    description: 'Холод сковывает ноги жертвы! В следующий ход отнимает 2 очка движения.'
  },
  {
    id: 'powder',
    name: 'Рассыпчатый',
    art: '💨',
    damageMod: -1,
    rangeMod: +1,
    effect: {
      type: 'blind',
      duration: 1,
      rangePenalty: 1,
      name: 'Снег в глаза (-1 прицел)'
    },
    description: 'Ослепляет хлопьями снега, снижая дальность прицела цели на 1 ход.'
  }
];

// Персонажи детей со двора
// Стандарты: HP=10, Damage=1, Move=4, Range=4
const CHARACTERS = [
  {
    id: 'vanya',
    name: 'Ваня "Снайпер"',
    title: 'Капитан двора',
    art: '🧢',
    color: '#2196f3',
    maxHp: 10,
    damage: 1,
    moveSpeed: 4,
    aimRange: 5, // +1 к дальности
    bio: 'Никогда не мажет из-за сугроба. Лучший глазомер на районе.'
  },
  {
    id: 'misha',
    name: 'Миша "Крепыш"',
    title: 'Снежный танк',
    art: '🧣',
    color: '#e53935',
    maxHp: 12, // +2 HP
    damage: 2, // +1 Урон
    moveSpeed: 3, // чуть медленнее
    aimRange: 3,
    bio: 'Носит три свитера и две шапки. Лепит такие снежки, что содрогаются окна.'
  },
  {
    id: 'alisa',
    name: 'Алиса "Вихрь"',
    title: 'Быстроногая',
    art: '👧',
    color: '#ab47bc',
    maxHp: 9,
    damage: 1,
    moveSpeed: 5, // +1 к скорости
    aimRange: 4,
    bio: 'Быстрее ветра оббегает противников и ловко прячется за деревьями.'
  },
  {
    id: 'dima',
    name: 'Дима "Тактик"',
    title: 'Защитник базы',
    art: '🧤',
    color: '#26a69a',
    maxHp: 10,
    damage: 1,
    moveSpeed: 4,
    aimRange: 4,
    bio: 'Универсальный и дисциплинированный боец снежного фронта.'
  },
  {
    id: 'polina',
    name: 'Полина "Ловкач"',
    title: 'Шустрая заводила',
    art: '🎀',
    color: '#ff7043',
    maxHp: 10,
    damage: 1,
    moveSpeed: 4,
    aimRange: 4,
    bio: 'Всегда имеет в запасе пару свежих снежков прямо в кармане!'
  }
];
