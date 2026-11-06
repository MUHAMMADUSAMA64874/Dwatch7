/* ==========================================================================
   WRISTLAB GAME REGISTRY
   Single source of truth for the arcade. To add a game:
     1. copy games/template.html -> games/your-game.html
     2. add one object below
   The UI, search, filters, manager and stats all read from this array.
   ========================================================================== */
window.WRIST_CATEGORIES = ['All', 'Arcade', 'Action', 'Puzzle', 'Rhythm', 'Strategy'];

window.WRIST_GAMES = [
  {
    id: 'neon-serpent', title: 'Neon Serpent', tagline: 'Grow. Glow. Don\u2019t bite yourself.',
    category: 'Arcade', icon: '🐍', accent: '#c9f56b', accent2: '#1f3a12',
    file: 'games/neon-serpent.html', featured: true, difficulty: 2, since: 'v1.0',
    controls: [{ keys: '← →', label: 'STEER' }, { keys: 'WATCH', label: 'LEFT / RIGHT' }],
    tags: ['classic', 'endless', 'high-score', 'haptics'],
    desc: 'A precision snake for the wrist era. Collect signal cores, chain combos, and keep your tail out of its own glow. Speed ramps every five pickups.'
  },
  {
    id: 'pulse-pong', title: 'Pulse Pong', tagline: 'The original duel, with a heartbeat.',
    category: 'Arcade', icon: '🏓', accent: '#6be8ff', accent2: '#0b2a33',
    file: 'games/pulse-pong.html', featured: false, difficulty: 1, since: 'v1.0',
    controls: [{ keys: '↑ ↓', label: 'PADDLE' }, { keys: 'WATCH', label: 'LEFT / RIGHT' }],
    tags: ['classic', 'versus-ai', 'reflex'], 
    desc: 'Neon table tennis against a machine that learns your rhythm. First to 7. Your paddle accelerates with every return, so calm hands win.'
  },
  {
    id: 'brick-storm', title: 'Brick Storm', tagline: 'Break the wall. Catch the power.',
    category: 'Arcade', icon: '🧱', accent: '#ffb84d', accent2: '#33220a',
    file: 'games/brick-storm.html', featured: false, difficulty: 2, since: 'v1.0',
    controls: [{ keys: '← →', label: 'PADDLE' }, { keys: 'SPACE', label: 'LAUNCH' }],
    tags: ['breakout', 'powerups', 'levels'], 
    desc: 'A chunky breakout with falling power-ups: widen, multi-ball, laser and slow-motion. Three lives, five hand-built wall patterns.'
  },
  {
    id: 'star-drifter', title: 'Star Drifter', tagline: 'Thread the belt. Return fire.',
    category: 'Action', icon: '🚀', accent: '#a78bfa', accent2: '#1d1536',
    file: 'games/star-drifter.html', featured: true, difficulty: 2, since: 'v1.0',
    controls: [{ keys: '← → ↑ ↓', label: 'FLY' }, { keys: 'SPACE', label: 'FIRE' }],
    tags: ['shooter', 'space', 'waves', 'particles'],
    desc: 'An endless side-scrolling shooter through a collapsing asteroid belt. Bank, fire, chain kills and grab the occasional overdrive core.'
  },
  {
    id: 'wrist-runner', title: 'Wrist Runner', tagline: 'One button. Zero mercy.',
    category: 'Action', icon: '🏃', accent: '#ff7a45', accent2: '#361208',
    file: 'games/wrist-runner.html', featured: false, difficulty: 2, since: 'v1.0',
    controls: [{ keys: 'SPACE / ↑', label: 'JUMP' }, { keys: '↓', label: 'SLIDE' }],
    tags: ['endless runner', 'one-button', 'speed'],
    desc: 'A silhouette runner across a neon skyline. Jump barriers, slide under beams, and survive long enough for the city to blur.'
  },
  {
    id: 'hex-memory', title: 'Hex Memory', tagline: 'Repeat the pattern. Trust the glow.',
    category: 'Puzzle', icon: '🔮', accent: '#6ee7b7', accent2: '#0c2b22',
    file: 'games/hex-memory.html', featured: false, difficulty: 1, since: 'v1.0',
    controls: [{ keys: '1 2 3 4', label: 'PADS' }, { keys: 'WATCH', label: 'LEFT / ACTION / RIGHT' }],
    tags: ['memory', 'simon', 'focus', 'chill'],
    desc: 'Six pads, one evolving sequence. Watch the pattern, echo it back, and push one step further each round. A calm brain-training counterpoint.'
  },
  {
    id: 'tilt-labyrinth', title: 'Tilt Labyrinth', tagline: 'Steady hands. Sharp corners.',
    category: 'Puzzle', icon: '🌀', accent: '#7dd3fc', accent2: '#0b2733',
    file: 'games/tilt-labyrinth.html', featured: false, difficulty: 3, since: 'v1.0',
    controls: [{ keys: '← → ↑ ↓', label: 'TILT' }, { keys: 'DRAG', label: 'TILT' }],
    tags: ['maze', 'physics', 'precision'], 
    desc: 'Roll a marble through a procedurally generated labyrinth. Walls bite, keys open gates, and the clock is always against you.'
  },
  {
    id: 'meteor-rush', title: 'Meteor Rush', tagline: 'Everything is falling. Move.',
    category: 'Action', icon: '☄️', accent: '#fb7185', accent2: '#361018',
    file: 'games/meteor-rush.html', featured: false, difficulty: 3, since: 'v1.0',
    controls: [{ keys: '← → ↑ ↓', label: 'MOVE' }, { keys: 'SPACE', label: 'DASH' }],
    tags: ['survival', 'dodge', 'dash', 'particles'],
    desc: 'A top-down survival rush. Weave through meteor showers, collect shield shards, and dash through the gaps when the sky goes red.'
  },
  {
    id: 'wrist-hop', title: 'Wrist Hop', tagline: 'Tap. Float. Regret nothing.',
    category: 'Arcade', icon: '🐦', accent: '#fbbf24', accent2: '#33280a',
    file: 'games/wrist-hop.html', featured: false, difficulty: 3, since: 'v1.0',
    controls: [{ keys: 'SPACE', label: 'HOP' }, { keys: 'WATCH', label: 'ACTION' }],
    tags: ['one-button', 'flappy', 'rage', 'high-score'],
    desc: 'The one-button classic, rebuilt with weighted feathers and a very smug bird. Clear the pylons. Do not clip the pylons.'
  },
  {
    id: 'rhythm-grid', title: 'Rhythm Grid', tagline: 'Four lanes. One pulse.',
    category: 'Rhythm', icon: '🎵', accent: '#f472b6', accent2: '#33101f',
    file: 'games/rhythm-grid.html', featured: true, difficulty: 2, since: 'v1.0',
    controls: [{ keys: 'D F J K', label: 'LANES' }, { keys: 'WATCH', label: 'LEFT / ACTION / RIGHT' }],
    tags: ['music', 'timing', 'combo', 'synth'],
    desc: 'A four-lane rhythm runner with a procedurally generated synth track. Hit the notes, build the combo, and let the wrist buzz on perfects.'
  },
  {
    id: 'mole-mayhem', title: 'Mole Mayhem', tagline: 'Bonk first. Ask later.',
    category: 'Arcade', icon: '🔨', accent: '#f59e0b', accent2: '#33260b',
    file: 'games/mole-mayhem.html', featured: false, difficulty: 1, since: 'v1.0',
    controls: [{ keys: 'CLICK', label: 'BONK' }, { keys: '1 2 3', label: 'LANES' }],
    tags: ['whack-a-mole', 'reaction', 'casual', 'fun'],
    desc: 'Nine burrows, one hammer, increasingly rude moles. Golden moles pay triple, bombs end your run. A pure reflexes palate cleanser.'
  },
  {
    id: 'grid-2048', title: 'Grid 2048', tagline: 'Merge gently. Lose loudly.',
    category: 'Puzzle', icon: '🔢', accent: '#a3e635', accent2: '#24330b',
    file: 'games/grid-2048.html', featured: false, difficulty: 2, since: 'v1.0',
    controls: [{ keys: '← → ↑ ↓', label: 'SLIDE' }, { keys: 'WATCH', label: 'LEFT / RIGHT' }],
    tags: ['numbers', 'merge', 'strategy', 'chill'],
    desc: 'The sliding-tile classic, tuned for the watch arcade. Merge your way to 2048 with smooth thumb-friendly animation and undo-free tension.'
  },
  {
    id: 'tank-duel', title: 'Tank Duel', tagline: 'One shot. One bounce.',
    category: 'Strategy', icon: '🎯', accent: '#f87171', accent2: '#331010',
    file: 'games/tank-duel.html', featured: false, difficulty: 3, since: 'v1.0',
    controls: [{ keys: '← →', label: 'AIM' }, { keys: 'SPACE', label: 'FIRE' }],
    tags: ['tanks', 'artillery', 'versus-ai', 'physics'],
    desc: 'Turn-based artillery against a calculating opponent. Read the wind, arc the shell, and land the shot before the return fire finds you.'
  },
  {
    id: 'laser-grid', title: 'Laser Grid', tagline: 'Leave a wall. Outlast the machine.',
    category: 'Strategy', icon: '⚡', accent: '#22d3ee', accent2: '#062b33',
    file: 'games/laser-grid.html', featured: false, difficulty: 2, since: 'v1.0',
    controls: [{ keys: '← → ↑ ↓', label: 'TURN' }, { keys: 'WATCH', label: 'LEFT / RIGHT' }],
    tags: ['tron', 'light-cycle', 'versus-ai', 'speed'],
    desc: 'Light-cycle duel on a dark grid. Leave a lethal trail, cut the AI off, and survive the arena as the walls start to close.'
  },
  {
    id: 'fruit-frenzy', title: 'Fruit Frenzy', tagline: 'Slice clean. Miss nothing.',
    category: 'Action', icon: '🍉', accent: '#fb923c', accent2: '#33190a',
    file: 'games/fruit-frenzy.html', featured: false, difficulty: 1, since: 'v1.0',
    controls: [{ keys: 'DRAG', label: 'SLICE' }, { keys: 'CLICK', label: 'SLICE' }],
    tags: ['slice', 'pointer', 'combo', 'juicy'],
    desc: 'A juicy pointer-slicer. Draw through fruit to split it, chain combos for multipliers, and avoid the black bombs. Pure arcade sugar.'
  },
  {
    id: 'tower-stack', title: 'Tower Stack', tagline: 'Build high. Land true.',
    category: 'Arcade', icon: '🏗️', accent: '#c4b5fd', accent2: '#221b3a',
    file: 'games/tower-stack.html', featured: false, difficulty: 2, since: 'v1.0',
    controls: [{ keys: 'SPACE', label: 'DROP' }, { keys: 'CLICK', label: 'DROP' }],
    tags: ['stacking', 'timing', 'precision', 'minimal'],
    desc: 'A minimal timing tower. Stack swinging slabs as high as you can; perfect drops rebuild your width, sloppy drops shave it away.'
  },
  {
    id: 'reflex-duel', title: 'Reflex Duel', tagline: 'Wait for green. Then commit.',
    category: 'Arcade', icon: '⚡', accent: '#fde047', accent2: '#332d0a',
    file: 'games/reflex-duel.html', featured: false, difficulty: 1, since: 'v1.0',
    controls: [{ keys: 'SPACE', label: 'STRIKE' }, { keys: 'WATCH', label: 'ACTION' }],
    tags: ['reaction', 'timing', 'duel', 'quick'],
    desc: 'A best-of-nine reaction duel against a rival with human-ish nerves. False starts cost a round; the faster thumb takes the crown.'
  },
  {
    id: 'circuit-breaker', title: 'Circuit Breaker', tagline: 'Connect the grid before it dies.',
    category: 'Puzzle', icon: '🔌', accent: '#34d399', accent2: '#0a2b1f',
    file: 'games/circuit-breaker.html', featured: false, difficulty: 3, since: 'v1.0',
    controls: [{ keys: 'CLICK', label: 'ROTATE' }, { keys: 'R', label: 'SHUFFLE' }],
    tags: ['pipes', 'logic', 'relaxing', 'brain'],
    desc: 'A rotate-the-pipes logic puzzle with a live power flow. Light every node before the timer drains. Procedural boards never repeat.'
  },
  {
    id: 'orbit-sling', title: 'Orbit Sling', tagline: 'Gravity is your friend. Mostly.',
    category: 'Puzzle', icon: '🪐', accent: '#38bdf8', accent2: '#082538',
    file: 'games/orbit-sling.html', featured: false, difficulty: 3, since: 'v1.0',
    controls: [{ keys: 'DRAG', label: 'AIM' }, { keys: 'SPACE / CLICK', label: 'LAUNCH' }],
    tags: ['gravity', 'physics', 'aim', 'space'],
    desc: 'A one-shot orbital slingshot. Drag to aim, release to launch, and use planetary gravity to curve your probe into the beacon.'
  },
  {
    id: 'dungeon-dash', title: 'Dungeon Dash', tagline: 'One more room. One more run.',
    category: 'Action', icon: '🗡️', accent: '#e879f9', accent2: '#2f0d36',
    file: 'games/dungeon-dash.html', featured: false, difficulty: 3, since: 'v1.0',
    controls: [{ keys: '← → ↑ ↓', label: 'MOVE' }, { keys: 'SPACE', label: 'STRIKE' }, { keys: 'WATCH', label: 'LEFT / RIGHT' }],
    tags: ['roguelite', 'grid', 'combat', 'loot'],
    desc: 'A tiny grid roguelite. Clear each room, grab the relic, and descend. Every floor remixes the layout, the enemies and the loot. (If the game fails to load, use its New Tab button.)'
  }
];
