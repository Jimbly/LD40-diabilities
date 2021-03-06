/*jshint noempty:false, bitwise:false*/

/*global $: false */
/*global math_device: false */
/*global assert: false */
/*global Z: false */

window.Z = window.Z || {};
Z.BACKGROUND = 0;
Z.SPRITES = 10;
Z.BEAMS = 15;
Z.CHARACTER = 20;
Z.LASERS = 25;
Z.UI = 100;
Z.FADE = 110;
Z.UI2 = 120;
Z.LETTERBOX = 200;

// Virtual viewport for our game logic
const game_width = 1280;
const game_height = 960;

const COMPO_VERSION = location.toString().indexOf('compo=1') !== -1;

export function main(canvas)
{
  const glov_engine = require('./glov/engine.js');
  const glov_font = require('./glov/font.js');
  const score = require('./score.js');
  const util = require('./glov/util.js');

  glov_engine.startup({
    canvas,
    game_width,
    game_height,
    pixely: true,
  });

  const sound_manager = glov_engine.sound_manager;
  const glov_camera = glov_engine.glov_camera;
  const glov_input = glov_engine.glov_input;
  const glov_sprite = glov_engine.glov_sprite;
  const glov_ui = glov_engine.glov_ui;
  const draw_list = glov_engine.draw_list;
  const font = glov_engine.font;

  glov_ui.button_width *= 2;
  glov_ui.button_height *= 2;
  glov_ui.font_height *= 2;

  const DEBUG = (location.host.indexOf('localhost') !== -1);

  if (DEBUG && false) {
    sound_manager.sound_on = sound_manager.music_on = false;
  }

  const loadTexture = glov_sprite.loadTexture.bind(glov_sprite);
  const createSprite = glov_sprite.createSprite.bind(glov_sprite);

  glov_ui.bindSounds(sound_manager, {
    button_click: 'button_click',
    rollover: 'rollover',
  });

  const color_white = math_device.v4Build(1, 1, 1, 1);
  const color_red = math_device.v4Build(1, 0, 0, 1);
  const color_green = math_device.v4Build(0, 1, 0, 1);
  const color_black = math_device.v4Build(0, 0, 0, 1);
  const color_beam_green_warmup = math_device.v4Build(0, 1, 0, 0.19);
  const color_beam_green_fire = math_device.v4Build(0, 1, 0, 1);
  const color_beam_red_warmup = math_device.v4Build(1, 0, 0, 0.19);
  const color_beam_red_fire = math_device.v4Build(1, 0, 0, 1);
  const color_bricks = math_device.v4Build(0.8, 0.5, 0.5, 1);
  // Cache key_codes
  const key_codes = glov_input.key_codes;
  const pad_codes = glov_input.pad_codes;
  const MUSIC_VOLUME = 0.5;

  let game_state;

  let sprites = {};

  const TILESIZE = 64;
  const CHAR_W = 0.5 * 1.5;
  const CHAR_H = 1 * 1.5;
  const LEVEL_W = 18;
  const LEVEL_H = 14;
  const COUNTDOWN_SUCCESS = 1500;
  let COUNTDOWN_FAIL = 1500;


  // higher score is "better"
  const score_mod1 = 10000;
  const score_mod2 = 100;
  const deaths_inv = 9999;
  function scoreToValue(score) {
    return score.disabil_index * score_mod1 * score_mod2 + score.level_index * score_mod1 + (deaths_inv - score.deaths);
  }
  function valueToScore(score) {
    let deaths = deaths_inv - score % score_mod1;
    score = Math.floor(score / score_mod1);
    let level_index = score % score_mod2;
    score = Math.floor(score / score_mod2);
    let disabil_index = score;
    return { disabil_index, level_index, deaths };
  }
  score.init(scoreToValue, valueToScore, { all: { name: 'all' }}, 'LD40');
  score.getScore('all');

  function initGraphics() {
    if (sprites.white) {
      return;
    }

    // sound_manager.loadSound('pegstep1');
    // sound_manager.loadSound('pegstep2');
    // sound_manager.loadSound('pegstep3');
    // sound_manager.loadSound('pegstep4');
    sound_manager.loadSound('pegstep5');
    // sound_manager.loadSound('footstep1');
    // sound_manager.loadSound('footstep2');
    // sound_manager.loadSound('footstep3');
    sound_manager.loadSound('footstep4');
    // sound_manager.loadSound('footstep5');
    sound_manager.loadSound('jump');
    sound_manager.loadSound('jump_land');
    sound_manager.loadSound('dead_land');
    sound_manager.loadSound('death_spike');
    sound_manager.loadSound('death_laser');
    sound_manager.loadSound('death_beam');
    sound_manager.loadSound('beam_fire');
    sound_manager.loadSound('beam_charge');
    sound_manager.loadSound('laser');
    sound_manager.loadSound('respawn');
    sound_manager.loadSound('victory');

    sprites.white = createSprite('white', {
      width : 1,
      height : 1,
      x : 0,
      y : 0,
      rotation : 0,
      color : [1,1,1, 1],
      origin: [0, 0],
      textureRectangle : math_device.v4Build(0, 0, 1, 1)
    });

    sprites.avatar = glov_ui.loadSpriteRect('avatar2.png', [13, 13, 13, 13], [26, 26, 26, 26, 26, 26]);
    sprites.avatar_pegged = glov_ui.loadSpriteRect('avatar3-pegged.png', [13, 13, 13, 13], [26, 26, 26, 26, 26, 26]);
    sprites.avatar_colorblind = glov_ui.loadSpriteRect('avatar3-colorblind.png', [13, 13, 13, 13], [26, 26, 26, 26, 26, 26]);
    sprites.lasers = glov_ui.loadSpriteRect('lasers.png', [16, 16, 16, 16], [32]);

    sprites.solid = glov_ui.loadSpriteRect('bricks2.png', [64], [16, 16, 16, 16]);

    sprites.bricks = createSprite('bricks.png', {
      width : TILESIZE,
      height : TILESIZE,
      rotation : 0,
      color : color_white,
      origin: [0, 0],
      textureRectangle : math_device.v4Build(0, 0, 16, 16)
    });

    sprites.exit = createSprite('exit.png', {
      width : TILESIZE,
      height : TILESIZE,
      rotation : 0,
      color : color_white,
      origin: [0, 0],
      textureRectangle : math_device.v4Build(0, 0, 16, 32)
    });
    sprites.exit_desat = createSprite('exit_desat.png', {
      width : TILESIZE,
      height : TILESIZE,
      rotation : 0,
      color : color_white,
      origin: [0, 0],
      textureRectangle : math_device.v4Build(0, 0, 16, 32)
    });

    sprites.spikes = createSprite('spikes.png', {
      width : TILESIZE,
      height : TILESIZE,
      rotation : 0,
      color : color_white,
      origin: [0, 0],
      textureRectangle : math_device.v4Build(0, 0, 16, 16)
    });

    // sprites.game_bg = createSprite('white', {
    //   width : LEVEL_W * TILESIZE,
    //   height : LEVEL_H * TILESIZE,
    //   x : 0,
    //   y : 0,
    //   rotation : 0,
    //   color : [0, 0.72, 1, 1],
    //   origin: [0, 0],
    //   textureRectangle : math_device.v4Build(0, 0, spriteSize, spriteSize)
    // });
    sprites.game_bg = createSprite('bg2.png', {
      width : TILESIZE,
      height : TILESIZE,
      x : 0,
      y : 0,
      rotation : 0,
      color : color_white,
      origin: [0, 0],
      textureRectangle : math_device.v4Build(0, 0, 16, 16)
    });
  }

  let have_scores = false;
  let character;
  let level;
  let level_index = 0;
  let disabil_index = 0;
  let disabil = {
    limp: false,
    color_blindness: false,
    vertigo: false,
    deaf: false,
    amnesia: false,
    blindness: false,
    paranoia: false,
    nearsighted: false,
    dead: false,
  };
  let disabil_flow = [
    { song: 'song1', hint: 'TIP: If you can\'t beat this, maybe platformers aren\'t your thing.'},
    { add: ['limp'], remove: [], song: 'song1-slow', hint: 'TIP: Jump from your good leg, listen for the soft footstep when walking, or don\'t walk at all and just jump!' },
    { add: ['vertigo'], remove: [], song: 'song2', hint: 'TIP: Close your eyes after you jump! Or, skip and it will go away anyway.' },
    { add: ['paranoia'], remove: ['vertigo'], song: 'song2-wahwah', hint: 'TIP: You\'re seeing things' },
    { add: ['color_blindness'], remove: [], song: 'song2-diffuse', hint: 'TIP: Remember the last time through.' },
    { add: ['nearsighted'], remove: [], song: 'song1', hint: 'TIP: You can do this!' },
    { add: ['amnesia', 'deaf'], remove: [], song: 'song1-deaf', hint: 'TIP: Figure out what level you\'re on first.' },
    { add: ['blindness'], remove: ['deaf', 'nearsighted', 'color_blindness', 'paranoia' ], song: 'song1', hint: 'TIP: Figure out what level you\'re on first.' },
    { add: ['deaf'], remove: [], song: 'song1-deaf', hint: 'TIP: Muscle memory.' },
  ];
  const disabil_list = [
    { key : 'limp', name: 'Unipedalism' },
    { key : 'vertigo', name: 'Vertigo' },
    { key : 'paranoia', name: 'Dementia' },
    { key : 'color_blindness', name: 'Deuteranopia' },
    { key : 'nearsighted', name: 'Myopia' },
    { key : 'deaf', name: 'Deaf' },
    { key : 'amnesia', name: 'Amnesia' },
    { key : 'blindness', name: 'Blindness' },
    { key : 'dead', name: 'Dead' },
  ];

  let total_deaths = 0;
  let deaths_per_level = 0;
  let scores_disabled = false;
  if (DEBUG) {
    disabil_index = 0;
    level_index = 0;
    deaths_per_level = 2;
    for (let ii = 1; ii <= disabil_index; ++ii) {
      let dl = disabil_flow[ii];
      for (let jj = 0; jj < dl.add.length; ++jj) {
        disabil[dl.add[jj]] = true;
      }
      for (let jj = 0; jj < dl.remove.length; ++jj) {
        disabil[dl.remove[jj]] = false;
      }
      ++total_deaths;
    }
  }

  function curedName(key) {
    if (disabil_index === disabil_flow.length) {
      return 'Irrelevant';
    }
    if (key === 'color_blindness' || key === 'paranoia' || key === 'nearsighted') {
      return 'Irrelevant';
    }
    return 'CURED!';
  }

  let level_countdown = 0;
  let vertigo_counter = 0;

  function playSound(sound) {
    if (!disabil.deaf) {
      return sound_manager.play(sound);
    }
  }


  function filterColor(color) {
    if (!disabil.color_blindness) {
      return color;
    }
    let b = Math.min((color[0] + color[1] + color[2]) * 0.5, 1);
    return [b, b, b, color[3]];
  }

  const beyond_zebra = ['yuzz', 'wum', 'humpf', 'glikk', 'snee', 'quan', 'thnad',
    'spazz', 'floob', 'zatz', 'jogg', 'flunn', 'yekk', 'vroo'];
  const titles = [
    'Introduction',
    'Spikes',
    'Moving Danger',
    'Lasers',
    // amnesia titles:
    'The one with the spikes?',
    'Dangerous',
    'Look out!',
    'Tuesday',
    'Jumpy',
    'Gimme meds!',
    'Flursday',
  ];
  function randWord(words) {
    let idx = Math.floor(Math.random() * words.length);
    return words[idx];
  }

  let index_map = [0,1,2,3];
  let did_remap = false;
  let laser_sound;
  let last_index_label, level_index_label, level_title;
  function startMusic(victory) {
    sound_manager.playMusic(
      (victory ? null : disabil_flow[disabil_index].song) || 'song2',
      victory ? 1 : MUSIC_VOLUME, sound_manager.FADE);
  }
  function levelInit() {
    if (laser_sound) {
      laser_sound.stop();
      laser_sound = null;
    }
    startMusic();
    if (level_index === 0 && !did_remap) {
      index_map = [0,1,2,3];
      did_remap = true;
      if (disabil.amnesia) {
        for (let ii = 0; ii < index_map.length - 1; ++ii) {
          let idx = ii + Math.floor(Math.random() * (index_map.length - ii));
          let t = index_map[ii];
          index_map[ii] = index_map[idx];
          index_map[idx] = t;
        }
      }
    } else if (level_index > 0) {
      did_remap = false;
    }

    let eff_level_index = index_map[level_index];

    vertigo_counter = 0;
    level_countdown = 0;
    character = {
      pos: [2.25, 4.5],
      v: [0,0],
      on_ground: false,
      jumping: 0,
      jumping_released: true,
      runloop: 0.5,
      facing: 1,
    };
    level = {};
    level.timestamp_base = glov_engine.getFrameTimestamp();
    level.laser_dir = 0;
    level.solids = [
      [0,2, 4,3],
      [6,6, 10,7],
      [14,9, 18,10],
      [-1,-1, 0, LEVEL_H + 1], // left
      [LEVEL_W,-1, LEVEL_W + 1, LEVEL_H + 1], // right
      [0,LEVEL_H, LEVEL_W, LEVEL_H + 1], // top
      [5,LEVEL_H - 1, 13, LEVEL_H], // title area on top
      [0,-1, LEVEL_W, 0], // bottom
    ];
    level.dangers = [
      [0,0, 18,1],
    ];
    if ((eff_level_index === 0 || eff_level_index === 1) && disabil.paranoia) {
      level.dangers.push([6,7, 10, 8, 0, 1]);
      level.dangers.push([0,13, 5, 14, -1, 1]);
      level.dangers.push([5,12, 13, 13, -1, 1]);
      level.dangers.push([13,13, 18, 14, -1, 1]);
    }
    if (eff_level_index === 1) {
      level.solids.push([1,7, 3, 8]);
      level.dangers.push([1,6, 3,7, -1], [7.5,7, 8.5,8]);
    }
    level.lasers = [];
    if (eff_level_index === 2) {
      // x, ymid, h, magnitude, bad, yoffs, paranoid
      level.lasers.push([0.5, 6, 2, 2, 1, 0]);
      level.lasers.push([0.5, 3, 2, 2, 0, 0]);

      level.lasers.push([5,   8, 2, 2, 0, 0]);
      level.lasers.push([5,   5, 2, 2, 1, 0]);

      level.lasers.push([12, 10, 2, 2, 1, 0]);
      level.lasers.push([12,  7,  2, 2, 0, 0]);

      if (disabil.paranoia) {
        level.lasers.push([2.75, 7, 2, 2, 1, 0, 1]);
        level.lasers.push([2.75, 4, 2, 2, 0, 0, 1]);

        level.lasers.push([7.33, 8.67, 2, 2, 1, 0, 1]);
        level.lasers.push([7.33, 5.67, 2, 2, 0, 0, 1]);

        level.lasers.push([9.67, 9.33, 2, 2, 0, 0, 1]);
        level.lasers.push([9.67, 6.33, 2, 2, 1, 0, 1]);

        level.lasers.push([15, 11, 2, 2, 0, 0, 1]);
        level.lasers.push([15,  8, 2, 2, 1, 0, 1]);
      }
    }
    level.beams = [];
    if (eff_level_index === 3) {
      // x, y, slope
      level.beams.push([0,6, -1, 0]);
      level.beams.push([0,10, -1, 0.5]);
      level.beams.push([0,14, -1, 0]);
      level.beams.push([4,14, -1, 0.5]);
      level.beams.push([9,13, -1, 0]);
      level.beams.push([13,13, -1, 0.5]);

      if (disabil.paranoia) {
        level.beams.push([8,0, 1, 0, 1]);
        level.beams.push([4,0, 1, 0.5, 1]);
        level.beams.push([0,0, 1, 0, 1]);
        level.beams.push([0,4, 1, 0.5, 1]);
        level.beams.push([0,8, 1, 0, 1]);
        level.beams.push([0,12, 1, 0.5, 1]);
      }
    }

    level.exit = [16,10, 17, 12];

    if (last_index_label !== level_index) {
      if (disabil.amnesia) {
        level_index_label = `Level ${randWord(beyond_zebra)} of ${randWord(beyond_zebra)}`;
        level_title = randWord(titles);
      } else {
        level_index_label = `Level ${level_index + 1} of 4`;
        level_title = titles[level_index];
      }
      last_index_label = level_index;
    }

    playSound('respawn');
  }

  const JUMP_TIME = 0.25;
  const RUN_SPEED = 4.5;
  const JUMP_SPEED = 10;
  const GRAVITY = -9.8*2.5;
  const HORIZ_ACCEL = 60;
  const HORIZ_DECEL = 30;
  const DEAD_ACCEL = 2;
  const BOTTOM = 1;
  const TOP = 2;
  const LEFT = 4;
  const RIGHT = 8;
  const ON_GROUND = 16;
  const BEAM_FIRE = 0.4;
  const BEAM_CHARGE_SPEED = 0.0002;
  const RUN_LOOP_SCALE = 0.35;
  const RUN_LOOP_REST_SPEED = 1;
  function collide(rect) {
    let ret = 0;
    if (character.pos[0] + CHAR_W > rect[0] && character.pos[0] < rect[2]) {
      if (character.pos[1] > rect[1] && character.pos[1] < rect[3]) {
        ret |= BOTTOM; // of character
        if (character.pos[0] > rect[0] && character.pos[0] + CHAR_W < rect[2]) {
          ret |= ON_GROUND;
        }
      }
    }
    if (character.pos[0] + CHAR_W > rect[0] && character.pos[0] < rect[2]) {
      if (character.pos[1] + CHAR_H > rect[1] && character.pos[1] + CHAR_H < rect[3]) {
        ret |= TOP;
      }
    }
    if (character.pos[1] + CHAR_H > rect[1] && character.pos[1] < rect[3]) {
      if (character.pos[0] > rect[0] && character.pos[0] < rect[2]) {
        ret |= LEFT;
      }
      if (character.pos[0] + CHAR_W > rect[0] && character.pos[0] + CHAR_W < rect[2]) {
        ret |= RIGHT;
      }
    }
    return ret;
  }

  function updateDangers(dt) {
    for (let ii = 0; ii < level.lasers.length; ++ii) {
      let old_value = level.lasers[ii][5];
      let new_value = level.lasers[ii][5] = Math.sin((glov_engine.getFrameTimestamp() - level.timestamp_base) * 0.002 - Math.PI/2) * level.lasers[ii][3];
      if (ii === 0) {
        if (level.laser_dir === 0 && old_value < new_value) {
          level.laser_dir = 1;
          if (!character.exited && !character.dead) {
            laser_sound = playSound('laser');
          }
        } else if (level.laser_dir === 1 && old_value > new_value) {
          level.laser_dir = 0;
          if (!character.exited && !character.dead) {
            laser_sound = playSound('laser');
          }
        }
      }
    }
    for (let ii = 0; ii < level.beams.length; ++ii) {
      let old_value = level.beams[ii][3];
      level.beams[ii][3] += BEAM_CHARGE_SPEED * dt;
      while (level.beams[ii][3] > 1) {
        level.beams[ii][3] -= 1;
      }
      if (ii === 0) {
        let new_value = level.beams[ii][3];
        if (old_value < BEAM_FIRE && new_value >= BEAM_FIRE ||
          old_value < 0.5 + BEAM_FIRE && new_value >= 0.5 + BEAM_FIRE) {
          playSound('beam_fire');
        }
        if (old_value < 0.2 && new_value >= 0.2 ||
          old_value < 0.7 && new_value >= 0.7) {
          laser_sound = playSound('beam_charge');
        }
      }
    }
  }

  function playFootstep(peg) {
    playSound(peg ? 'pegstep5' : 'footstep4');
  }

  function doCharacterMotion(dt, dx, dy) {
    if (character.dead || character.exited) {
      dx = dy = 0;
    }
    if (dt > 30) {
      // timeslice
      while (dt) {
        let t = Math.min(dt, 16);
        doCharacterMotion(t, dx, dy);
        dt -= t;
      }
      return;
    }

    dt *= 0.001; // seconds

    let movement_scale = 1;
    let jump_scale = 1;
    if (disabil.limp) {
       movement_scale = Math.min(1, Math.sin(character.runloop*(2 * Math.PI) + (Math.PI/2)) * 0.5 + 1);
       jump_scale = Math.min(1, Math.sin(character.runloop*(2 * Math.PI) - (Math.PI/2)) * 0.5 + 1);
    }

    let was_on_ground = character.on_ground;
    if (!was_on_ground) {
      movement_scale = jump_scale;
    }
    let desired_horiz_vel = dx * RUN_SPEED;
    let accel = dt * (character.dead ? DEAD_ACCEL : dx ? HORIZ_ACCEL : HORIZ_DECEL);
    let delta = desired_horiz_vel - character.v[0];
    if (Math.abs(delta) <= accel) {
      character.v[0] = desired_horiz_vel;
    } else {
      character.v[0] += ((delta < 0) ? -1 : 1) * accel;
    }
    if (!dy) {
      character.jumping_released = true;
    }
    if (was_on_ground && dy && character.jumping_released) {
      character.v[1] = dy * JUMP_SPEED * jump_scale;
      character.jumping = JUMP_TIME;
      character.jumping_released = false;
      playSound('jump');
    } else if (character.jumping && dy) {
      if (dt >= character.jumping) {
        let leftover = dt - character.jumping;
        character.v[1] += GRAVITY * leftover;
        character.jumping = 0;
      } else {
        character.jumping -= dt;
        // velocity stays unchanged
      }
    } else {
      character.jumping = 0;
      character.v[1] += GRAVITY * dt;
    }
    let horiz_movement = character.v[0] * dt;
    // Update runloop
    let new_facing = (dx > 0) ? 1 : (dx < 0) ? -1 : character.facing;
    if (character.facing !== new_facing) {
      character.facing = new_facing;
      //character.runloop = 0;
    }
    if (was_on_ground && !character.dead) {
      let last_runloop = character.runloop;
      character.runloop += character.facing * horiz_movement * RUN_LOOP_SCALE * movement_scale;
      while (character.runloop < 0) {
        character.runloop += 1;
      }
      while (character.runloop >= 1) {
        character.runloop -= 1;
      }
      if (Math.abs(character.v[0]) < 0.1) {
        if (character.runloop < 0.25) {
          character.runloop = Math.max(0, character.runloop - RUN_LOOP_REST_SPEED * dt);
        } else if (character.runloop < 0.5) {
          character.runloop = Math.min(0.5, character.runloop + RUN_LOOP_REST_SPEED * dt);
        } else if (character.runloop < 0.75) {
          character.runloop = Math.max(0.5, character.runloop - RUN_LOOP_REST_SPEED * dt);
        } else {
          character.runloop = Math.min(1, character.runloop + RUN_LOOP_REST_SPEED * dt);
        }
      }
      if (last_runloop < 0.25 && character.runloop >= 0.25 && character.runloop < 0.5) {
        playFootstep(0);
      } else if (last_runloop > 0.5 && last_runloop < 0.75 && character.runloop >= 0.75) {
        playFootstep(disabil.limp ? 1 : 0);
      }
    }
    // horizontal
    character.pos[0] += horiz_movement * movement_scale;
    // check vs solids
    character.on_ground = (Math.abs(character.v[1]) < 0.001) ? was_on_ground : false;
    for (let ii = 0; ii < level.solids.length; ++ii) {
      let s = level.solids[ii];
      let c = collide(s);
      if (c & LEFT) {
        character.v[0] = 0;
        character.pos[0] = s[2];
      } else if (c & RIGHT) {
        character.v[0] = 0;
        character.pos[0] = s[0] - CHAR_W;
      }
    }
    // vertical
    character.pos[1] += character.v[1] * dt;
    for (let ii = 0; ii < level.solids.length; ++ii) {
      let s = level.solids[ii];
      let c = collide(s);
      if (c & TOP) {
        character.v[1] = 0;
        character.pos[1] = s[1] - CHAR_H;
      } else if (c & BOTTOM) {
        character.v[1] = 0;
        character.pos[1] = s[3];
      }
      if (c & BOTTOM) {
        character.on_ground = true;
      }
    }
    if (character.on_ground && !was_on_ground) {
      playSound(character.dead ? 'dead_land' :'jump_land');
    }
    // dangers in final position
    if (!character.exited && !character.dead) {
      for (let ii = 0; ii < level.dangers.length; ++ii) {
        let d = level.dangers[ii];
        if (d[5]) {
          continue;
        }
        if (collide([d[0] + 0.25, d[1], d[2] - 0.25, d[3]])) {
          playSound('death_spike');
          character.dead = 2;
          ++total_deaths;
          ++deaths_per_level;
          if (d[4] !== -1) {
            character.v[0] = 0;
          }
        }
      }
      for (let ii = 0; ii < level.lasers.length; ++ii) {
        let laser = level.lasers[ii];
        if (laser[4] && !laser[6]) { // bad && !paranoid
          let x = laser[0];
          let h = laser[2];
          let y = laser[1] - h/2 + laser[5];
          if (character.pos[0] < x && character.pos[0] + CHAR_W > x &&
            character.pos[1] + CHAR_H > y && character.pos[1] < y + h)
          {
            playSound('death_laser');
            character.dead = 1;
            ++total_deaths;
            ++deaths_per_level;
          }
        }
      }
      for (let ii = 0; ii < level.beams.length; ++ii) {
        let b = level.beams[ii];
        if (b[4]) { // paranoid
          continue;
        }
        if (b[3] > 0.5 + BEAM_FIRE) {
          if (util.lineCircleIntersect(b, [b[0] + LEVEL_W, b[1] + LEVEL_W * b[2]], [character.pos[0] + CHAR_W/2, character.pos[1] + CHAR_H/2], CHAR_H/2)) {
            playSound('death_beam');
            character.dead = 3;
            ++total_deaths;
            ++deaths_per_level;
          }
        }
      }
      if (character.dead) {
        level_countdown = COUNTDOWN_FAIL;
        if (laser_sound) {
          laser_sound.stop();
          laser_sound = null;
        }
      }
    }
    if (!character.dead && !character.exited) {
      if (collide(level.exit)) {
        character.exited = true;
        have_scores = false;
        if (scores_disabled) {
          score.updateHighScores(function () {
            have_scores = true;
          });
        } else {
          score.setScore('all', { disabil_index, level_index, deaths: total_deaths }, function () {
            have_scores = true;
          });
        }
        playSound('victory');
        level_countdown = COUNTDOWN_SUCCESS;
        if (laser_sound) {
          laser_sound.stop();
          laser_sound = null;
        }
      }
    }
  }

  function drawWorldElem(sprite, s, tile, color) {
    let w = s[2] - s[0];
    let h = s[3] - s[1];
    draw_list.queue(sprite, s[0] * TILESIZE,  game_height - s[3] * TILESIZE, Z.SPRITES, color || color_white,
      [w, h], tile ? [0,0, 16*w, ((s[4] < 0) ? -16 : 16) *h] : null);
  }

  function defaultCamera()
  {
    glov_camera.set2DAspectFixed(game_width, game_height);
    glov_camera.set2D(glov_camera.x0() - 64, glov_camera.y0(), glov_camera.x1() - 64, glov_camera.y1());
  }

  function nearsightedCamera() {
    glov_camera.zoom((character.pos[0] + character.pos[0]/LEVEL_W * CHAR_W) * TILESIZE, game_height - (character.pos[1] + (character.pos[1] / LEVEL_H) * CHAR_H) * TILESIZE, 8);
  }

  const TITLE_X = 5 * TILESIZE;
  const TITLE_Y = 0.25 * TILESIZE;
  const TITLE_W = 8 * TILESIZE;
  const TITLE_SIZE = TILESIZE * 0.75;
  const title_font_style = glov_font.style(null, {
    outline_width: 2.0,
    outline_color: 0x800000ff,
    glow_xoffs: 3.25,
    glow_yoffs: 3.25,
    glow_inner: -1.5,
    glow_outer: 7,
    glow_color: 0x000000ff,
  });

  function displayTitles() {
    let z = Z.UI2;
    if (level_countdown && character.exited && level_countdown < COUNTDOWN_SUCCESS / 2) {
      z = Z.UI;
    }
    font.drawSizedAligned(title_font_style, TITLE_X, TITLE_Y, z, TITLE_SIZE, glov_font.ALIGN.HCENTER,
      TITLE_W, TITLE_SIZE, level_index_label);
    font.drawSizedAligned(title_font_style, TITLE_X, TITLE_Y + TITLE_SIZE, z, TITLE_SIZE, glov_font.ALIGN.HCENTER,
      TITLE_W, TITLE_SIZE, level_title);
  }

  const disabil_font_style = glov_font.style(null, {
    outline_width: 2.0,
    outline_color: 0x000000ff,
    glow_xoffs: 0,
    glow_yoffs: 0,
    glow_inner: 1,
    glow_outer: 5,
    glow_color: 0xFFFFFFff,
  });
  const disabil_font_style_removed = glov_font.style(null, {
    color: 0x808080ff,
    outline_width: 2.0,
    outline_color: 0x000000ff,
    glow_xoffs: 0,
    glow_yoffs: 0,
    glow_inner: 1,
    glow_outer: 5,
    glow_color: 0x404040ff,
  });
  const new_font_style = glov_font.style(null, {
    color: 0xFFFF00ff,
    outline_width: 2.0,
    outline_color: 0x000000ff,
    glow_xoffs: 0,
    glow_yoffs: 0,
    glow_inner: 1,
    glow_outer: 5,
    glow_color: 0xFFFFFFff,
  });
  const tip_style = glov_font.style(null, {
    color: 0x80FF80ff,
    outline_width: 2.0,
    outline_color: 0x000000ff,
    glow_xoffs: 0,
    glow_yoffs: 0,
    glow_inner: 1,
    glow_outer: 5,
    glow_color: 0xFFFFFFff,
  });
  const DISABIL_X = [0.1 * TILESIZE, LEVEL_W / 3 * TILESIZE];
  let   DISABIL_Y = [1 * TILESIZE, 2.5 * TILESIZE];
  const DISABIL_SIZE = [TILESIZE * 0.60, TILESIZE * 1];
  let dd_counter = 0;
  let dd_state;
  let dd_blink;
  let dd_removed;
  let dd_new;
  function displayDisabilities(trans, dt, target_y) {
    if (target_y) {
      DISABIL_Y[1] = target_y;
    }
    let pos = 0;
    let end_of_set = !!trans;
    if (end_of_set) {
      if (!dd_counter) {
        // init!
        if (trans.remove.length) {
          dd_state = 1;
        } else if (trans.add.length) {
          dd_state = 0;
        } else {
          dd_state = 2;
        }
        dd_blink = null;
        dd_removed = {};
        dd_new = {};
      }
      pos = 1;
      dd_counter += dt;
      if (dd_state === 0) {
        // showing new
        if (dd_counter > 500) {
          dd_counter = 1;
          let k = trans.add.pop();
          dd_blink = k;
          disabil[k] = true;
          dd_new[k] = true;
          if (!trans.add.length) {
            dd_state = 2;
          }
        }
      } else if (dd_state === 1) {
        // showing removed
        if (dd_counter > 500) {
          dd_counter = 1;
          let k = trans.remove.pop();
          dd_blink = k;
          disabil[k] = false;
          dd_removed[k] = true;
          if (!trans.remove.length) {
            if (trans.add.length) {
              dd_state = 0;
            } else {
              dd_state = 2;
            }
          }
        }
      } else if (dd_state === 2) {
        if (dd_counter > 500) {
          dd_blink = null;
        }
      }
    } else {
      dd_counter = 0;
      dd_blink = 0;
      dd_removed = {};
      dd_new = {};
      if (level_countdown && character.exited && level_index === 3) {
        // interp to new pos
        pos = Math.max(0, Math.min(1, 1 - level_countdown / 1000));
      }
    }
    function interp(field) {
      return field[0] * (1 - pos) + field[1] * pos;
    }
    let x = interp(DISABIL_X);
    let y = DISABIL_Y.slice(0);
    let size = interp(DISABIL_SIZE);
    let any = false;
    for (let ii = 0; ii < disabil_list.length; ++ii) {
      if (disabil[disabil_list[ii].key]) {
        any = true;
      }
    }
    if (any || pos !== 0) {
      let alpha = any ? 255 : Math.floor(pos * 255);
      font.drawSizedAligned(glov_font.style(title_font_style,
        {
          color: 0xFFFFFF00 | alpha,
          outline_color: title_font_style.outline_color & 0xFFFFFF00 | alpha,
        }),
      x, interp(y), Z.UI2, size, glov_font.ALIGN.HLEFT, 0, 0, 'Afflictions:');
      y[0] += size;
      y[1] += size;
      x += size;
    }
    for (let ii = 0; ii < disabil_list.length; ++ii) {
      let key = disabil_list[ii].key;
      if (disabil[key] || dd_removed[key]) {
        let s = size;
        let style = disabil_font_style;
        if (key === dd_blink) {
          if (dd_removed[key]) {
            s *= 0.5 + 0.5 * (1 - dd_counter / 500);
          } else {
            s *= 1 + 0.2 * (1 - dd_counter / 500);
          }
          font.drawSizedAligned(new_font_style, x - 30, interp(y), Z.UI2, size * 0.8, glov_font.ALIGN.HRIGHT,
            0, 0, dd_removed[key] ? curedName(key) : 'NEW!');
        } else if (dd_removed[key]) {
          s *= 0.5;
          style = disabil_font_style_removed;
          font.drawSizedAligned(new_font_style, x - 30, interp(y), Z.UI2, size * 0.8, glov_font.ALIGN.HRIGHT,
            0, 0, curedName(key));
        } else if (dd_new[key]) {
          font.drawSizedAligned(new_font_style, x - 30, interp(y), Z.UI2, size * 0.8, glov_font.ALIGN.HRIGHT,
            0, 0, 'NEW!');
        }
        font.drawSizedAligned(style, x, interp(y), Z.UI2, s, glov_font.ALIGN.HLEFT|glov_font.ALIGN.VCENTER,
          0, size, (key === 'dead') ? `Dead (${total_deaths} times)` : disabil_list[ii].name);
        y[0] += size;
        y[1] += size;
      } else if (pos !== 0) {
        // advance y if it will be transitioned to next
        if (!trans) {
          trans = disabil_flow[disabil_index + 1];
        }
        if (trans && (trans.add.indexOf(key) !== -1 || trans.remove.indexOf(key) !== -1)) {
          y[1] += size;
        }
      }
    }
  }

  function doFade(fade) {
    draw_list.queue(sprites.white, glov_camera.x0(), glov_camera.y0(), Z.FADE, Array.isArray(fade) ? fade : [0,0,0,fade],
      [glov_camera.x1() - glov_camera.x0(), glov_camera.y1() - glov_camera.y0()]);
  }

  let was_skipped = false;

  function play(dt) {
    defaultCamera();

    if (disabil.nearsighted) {
      // letter box
      // top
      draw_list.queue(sprites.white, glov_camera.x0(), glov_camera.y0(), Z.LETTERBOX, color_black,
        [glov_camera.x1() - glov_camera.x0(), -glov_camera.y0()]);
      // bottom
      draw_list.queue(sprites.white, glov_camera.x0(), glov_camera.y1(), Z.LETTERBOX, color_black,
        [glov_camera.x1() - glov_camera.x0(), -(glov_camera.y1() - game_height)]);
      // left
      draw_list.queue(sprites.white, glov_camera.x0(), glov_camera.y0(), Z.LETTERBOX, color_black,
        [-64 - glov_camera.x0(), glov_camera.y1() - glov_camera.y0()]);
      // right
      draw_list.queue(sprites.white, glov_camera.x1(), glov_camera.y0(), Z.LETTERBOX, color_black,
        [-(glov_camera.x1() - game_width + 64), glov_camera.y1() - glov_camera.y0()]);
    }

    if (level_countdown && character.exited || deaths_per_level < 1 || !scores_disabled && deaths_per_level < 2) {
      // nothing
    } else if (!COMPO_VERSION && (scores_disabled && deaths_per_level === 1 || !scores_disabled && deaths_per_level === 2)) {
      font.drawSizedWrapped(tip_style, glov_camera.x1() - 25 - 400, glov_camera.y1() - 45 - 100, Z.LETTERBOX + 1,
        400, 40, glov_ui.font_height / 2,
        disabil_flow[disabil_index].hint);
    } else {
      if (glov_ui.buttonText({
        x: glov_camera.x1() - 320 - 25,
        y: glov_camera.y1() - 48 - 25,
        font_height: 24,
        h: 48,
        w: 320,
        text: 'Too hard?  Skip level',
        z: Z.UI2})
      ) {
        let text = 'Skip to the next set of ailments to get a feeling for what ' +
          'the rest of the game is like.\n\n' +
          'Note: skipping levels disables high score tracking.\n\n' +
          disabil_flow[disabil_index].hint;

        glov_ui.modalDialog({
          title: 'Platforming skills not good enough?',
          text,
          font_height: 24,
          buttons: {
            'SKIP': function () {
              scores_disabled = true;
              character.dead = 0;
              character.exited = true;
              have_scores = false;
              score.updateHighScores(function () {
                have_scores = true;
              });
              if (level_index === 3) {
                level_countdown = COUNTDOWN_SUCCESS - 100;
              } else {
                was_skipped = true;
                level_countdown = 1;
              }
            },
            'RETRY': null, // no callback
          },
        });
      }
    }

    if (glov_input.keyDownHit(key_codes.R) || glov_input.padDownHit(0, pad_codes.Y)) {
      playInit();
    }

    if (location.host.indexOf('localhost') !== -1) {
      if (glov_input.keyDownHit(key_codes.Q)) {
        level_index--;
        playInit();
      }
      if (glov_input.keyDownHit(key_codes.E)) {
        character.dead = 0;
        character.exited = true;
        level_countdown = 100;
      }
    }

    updateDangers(dt);

    let dx = 0;
    let dy = 0;
    if (glov_input.isKeyDown(key_codes.LEFT) || glov_input.isKeyDown(key_codes.A) || glov_input.isPadButtonDown(0, pad_codes.LEFT)) {
      dx = -1;
    } else if (glov_input.isKeyDown(key_codes.RIGHT) || glov_input.isKeyDown(key_codes.D) || glov_input.isPadButtonDown(0, pad_codes.RIGHT)) {
      dx = 1;
    }
    if (glov_input.isKeyDown(key_codes.UP) || glov_input.isKeyDown(key_codes.W) || glov_input.isPadButtonDown(0, pad_codes.UP) ||
      glov_input.isKeyDown(key_codes.SPACE) || glov_input.isPadButtonDown(0, pad_codes.A))
    {
      dy = 1;
    }

    doCharacterMotion(dt, dx, dy);

    // drawing

    if (disabil.nearsighted) {
      nearsightedCamera();
    }

    // character
    let char_draw_pos = [character.pos[0] * TILESIZE,  game_height - ((character.pos[1] + CHAR_H) * TILESIZE) + 64/16];
    if (character.facing < 0) {
      char_draw_pos[0] += CHAR_W * TILESIZE;
    }
    let char_draw_scale = [character.facing * TILESIZE*CHAR_W, TILESIZE*CHAR_H, 1, 1];
    let frame = Math.floor((character.runloop % 1) * 8);
    if (character.dead) {
      let death_frame = 12 + (character.dead - 1) * 3;
      let frame_rate = (character.dead === 2) ? 400 : 200;
      let frame_offs = Math.floor(glov_engine.getFrameTimestamp() / frame_rate) % 3;
      frame = death_frame + frame_offs;
    } else if (!character.on_ground) {
      frame = character.jumping ? 9 : 8;
    } else if (Math.abs(character.v[0]) < 0.1) {
      if (frame === 0) {
        frame = 10;
      } else if (frame === 4) {
        frame = 11;
      }
    }
    draw_list.queue((disabil.color_blindness && !disabil.nearsighted) ? sprites.avatar_colorblind : disabil.limp ? sprites.avatar_pegged : sprites.avatar, char_draw_pos[0], char_draw_pos[1], Z.CHARACTER, color_white,
      char_draw_scale, sprites.avatar.uidata.rects[frame]);

    // world
    if (disabil.vertigo) {
      if (character.on_ground) {
        let next = vertigo_counter + dt * 0.005;
        //glov_ui.print(null, 500, 500, 500, next.toFixed(2));
        if (vertigo_counter <= Math.PI) {
          vertigo_counter = Math.min(next, Math.PI);
        } else {
          vertigo_counter = Math.min(next, Math.PI * 2);
        }
      } else {
        vertigo_counter += dt * 0.005;
        while (vertigo_counter > Math.PI * 2) {
          vertigo_counter -= Math.PI * 2;
        }
      }
      glov_camera.zoom((character.pos[0] + CHAR_W/2) * TILESIZE, game_height - (character.pos[1]) * TILESIZE, 1 + 0.5 * Math.sin(vertigo_counter));
    } else if (disabil.nearsighted) {
      defaultCamera();
    }

    displayTitles();
    displayDisabilities();

    if (disabil.nearsighted) {
      nearsightedCamera();
    }

    // Background fill
    let bg_color = [0.4, 0.4, 0.4, 1];
    if (level_countdown) {
      let v = util.easeOut(Math.abs(Math.sin(level_countdown * 0.02)), 2);
      bg_color = character.dead ? [bg_color[0], bg_color[1] * 0.25*v, bg_color[2] * 0.25*v, 1] : [bg_color[0] * 0.5*v, bg_color[1], bg_color[2] * 0.5*v, 1];
    }
    draw_list.queue(sprites.game_bg, 0, game_height - LEVEL_H * TILESIZE, Z.BACKGROUND, bg_color, [LEVEL_W, LEVEL_H], [0,0,LEVEL_W * 16,LEVEL_H * 16]);

    // world elements

    for (let ii = 0; ii < 3; ++ii) {
      let s = level.solids[ii];
      draw_list.queue(sprites.solid,
        s[0] * TILESIZE,  game_height - s[3] * TILESIZE, Z.SPRITES, filterColor(color_bricks),
        [(s[2] - s[0]) * TILESIZE, (s[3] - s[1]) * TILESIZE, 1, 1], sprites.solid.uidata.rects[ii]);

    }
    for (let ii = 3; ii < level.solids.length; ++ii) {
      drawWorldElem(sprites.bricks, level.solids[ii], true, filterColor(color_bricks));
    }

    for (let ii = 0; ii < level.dangers.length; ++ii) {
      drawWorldElem(sprites.spikes, level.dangers[ii], true, character.dead ? [0.5,0,0,1] : color_white);
    }
    for (let ii = 0; ii < level.lasers.length; ++ii) {
      let laser = level.lasers[ii];
      let x = laser[0];
      let h = laser[2];
      let y = laser[1] - h/2 + laser[5];
      let bad = laser[4];
      let frame = ((glov_engine.getFrameTimestamp() / 150) ^ 0) % 4;
      draw_list.queue(sprites.lasers,
        (x - h / 4) * TILESIZE,  game_height - (y + h) * TILESIZE, Z.LASERS, filterColor(bad ? color_red : color_green),
        [TILESIZE, TILESIZE*2, 1, 1], sprites.lasers.uidata.rects[frame]);
    }

    for (let ii = 0; ii < level.beams.length; ++ii) {
      let b = level.beams[ii];
      let w = (b[2] < 0) ? Math.min(b[1], LEVEL_W - b[0]) : Math.min(LEVEL_H - b[1], LEVEL_W - b[0]);
      let p = b[3];
      let color;
      let beam_w = 3 + 5 * Math.abs(Math.sin((glov_engine.getFrameTimestamp() - level.timestamp_base) * 0.02));
      let spread = 0.5;
      if (p < BEAM_FIRE) {
        beam_w = 3;
        color = color_beam_green_warmup;
      } else if (p < 0.5) {
        //beam_w = 3;
        if (disabil.color_blindness) {
          color = color_beam_green_fire;
        } else {
          color = color_beam_green_warmup;
        }
      } else if (p < 0.5 + BEAM_FIRE) {
        beam_w = 3;
        color = color_beam_red_warmup;
      } else {
        color = color_beam_red_fire;
      }
      glov_ui.drawLine(b[0] * TILESIZE, game_height - b[1] * TILESIZE, (b[0] + w) * TILESIZE, game_height - (b[1] + w * b[2]) * TILESIZE, Z.BEAMS, beam_w, spread, filterColor(color));
    }


    if (disabil.color_blindness && !character.exited) {
      drawWorldElem(sprites.exit_desat, level.exit);
    } else {
      drawWorldElem(sprites.exit, level.exit);
    }

    if (disabil.blindness) {
      if (level_countdown) {
        if (character.exited) {
          let f = Math.max(0, 1 - (COUNTDOWN_SUCCESS - level_countdown) / 500);
          doFade(f);
        } else {
          let f = Math.max(0.3, 1 - (COUNTDOWN_FAIL - level_countdown) / 500);
          doFade([f, 0, 0, 1]);
        }
      } else {
        doFade(1);
      }
    }

    if (level_countdown) {
      let end_of_set = (level_index === 3 && character.exited);
      if (end_of_set) {
        let fade = Math.max(0, Math.min(1, 1 - level_countdown / 500));
        doFade(fade);
      }
      if (dt >= level_countdown) {
        if (end_of_set) {
          // just wait for UI
          if (disabil_index === disabil_flow.length - 1) {
            victoryInit();
          } else {
            endOfSetInit();
          }
        } else {
          if (character.exited) {
            level_index++;
            if (!was_skipped) {
              deaths_per_level = 0;
            }
            was_skipped = false;
          }
          playInit();
        }
      } else {
        level_countdown -= dt;
      }
    }
  }

  function playInit() {
    levelInit();
    $('.screen').hide();
    game_state = play;
  }

  const font_style_seq_complete = glov_font.style(null, {
    outline_width: 2.0,
    outline_color: 0x404040ff,
    glow_xoffs: 3.25,
    glow_yoffs: 3.25,
    glow_inner: -1.5,
    glow_outer: 7,
    glow_color: 0xFF0000ff,
  });
  const font_style_seq_progress = glov_font.style(null, {
    outline_width: 2.0,
    outline_color: 0x404040ff,
    glow_xoffs: 0,
    glow_yoffs: 0,
    glow_inner: -1.5,
    glow_outer: 7,
    glow_color: 0xFFFFFF80,
  });
  let disabil_trans;
  function endOfSet(dt) {
    defaultCamera();

    const font_size = TILESIZE * 1.5;

    let y = TILESIZE * 0.5;
    font.drawSizedAligned(font_style_seq_complete, -64, y, Z.UI2, font_size, glov_font.ALIGN.HCENTER,
      game_width, 0, 'Sequence Completed!');
    y += font_size + 20;

    displayDisabilities(disabil_trans, dt, y);

    if (dd_state === 2) {
      y = 685;

      const font_size2 = TILESIZE * 0.75;

      if (have_scores) {
        // show number of people who completed it here
        let scores = score.high_scores.all;
        let my_di = disabil_index - 1;
        let better = 0;
        let same = 0;
        let total = 0;
        for (let ii = 0; ii < scores.length; ++ii) {
          if (scores[ii].name === score.player_name) {
            continue;
          }
          ++total;
          if (scores[ii].score.disabil_index === my_di && scores[ii].score.level_index === level_index) {
            ++same;
          } else if (scores[ii].score.disabil_index > my_di || scores[ii].score.disabil_index === my_di &&
            scores[ii].score.level_index > level_index
          ) {
            ++better;
          }
        }
        font.drawSizedAligned(font_style_seq_progress, -64, y, Z.UI2, font_size2*0.8, glov_font.ALIGN.HCENTER,
          game_width, 0, `${Math.ceil(better / total * 100)}% of players have made it farther`);
        y += font_size2;
        if (same) {
          font.drawSizedAligned(font_style_seq_progress, -64, y, Z.UI2, font_size2*0.8, glov_font.ALIGN.HCENTER,
            game_width, 0, `${Math.ceil(same / total * 100)}% of players gave up here`);
          y += font_size2;
        }
      }

      font.drawSizedAligned(font_style_seq_progress, -64, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER,
        game_width, 0, `Starting Sequence ${disabil_index + 1} of ${disabil_flow.length}...`);
      y += font_size2;

      y += 20;
      if (glov_ui.buttonText({
        x: game_width / 2 - glov_ui.button_width / 2 - 64,
        y,
        text: 'CONTINUE'
      }) || glov_input.keyDownHit(key_codes.SPACE) || glov_input.keyDownHit(key_codes.RETURN) || glov_input.padDownHit(0, pad_codes.A)) {
        level_index = 0;
        deaths_per_level = 0;
        playInit();
      }
      y += glov_ui.button_height + 8;

      if (disabil_index === 8) {
        font.drawSizedAligned(font_style_seq_progress, -64, y, Z.UI2, font_size2*0.8, glov_font.ALIGN.HCENTER,
          game_width, 0, `(This one is nearly impossible)`);
        y += font_size2 * 0.8 + 8;
      }
    }
  }

  function endOfSetInit() {
    game_state = endOfSet;
    ++disabil_index;
    disabil_trans = JSON.parse(JSON.stringify(disabil_flow[disabil_index]));
    startMusic();
  }

  let victory_trans;
  function victory(dt) {
    startMusic(true);
    defaultCamera();

    const font_style = glov_font.style(null, {
      outline_width: 2.0,
      outline_color: 0x404040ff,
      glow_xoffs: 3.25,
      glow_yoffs: 3.25,
      glow_inner: -1.5,
      glow_outer: 7,
      glow_color: 0xFF0000ff,
    });
    const font_size = TILESIZE * 1.5;

    let y = 0;
    font.drawSizedAligned(font_style, -64, y, Z.UI2, font_size, glov_font.ALIGN.HCENTER,
      game_width, 0, 'All Sequences');
    y += font_size;
    font.drawSizedAligned(font_style, -64, y, Z.UI2, font_size, glov_font.ALIGN.HCENTER,
      game_width, 0, 'Completed!');
    y += font_size + 20;

    displayDisabilities(victory_trans, dt, y);

    y = 685;
    const font_size2 = TILESIZE * 0.75;
    if (have_scores) {
      // show number of people who completed it here
      let scores = score.high_scores.all;
      let my_di = disabil_index - 1;
      let better = 0;
      let same = 0;
      let total = 0;
      for (let ii = 0; ii < scores.length; ++ii) {
        if (scores[ii].name === score.player_name) {
          continue;
        }
        ++total;
        if (scores[ii].score.disabil_index === my_di && scores[ii].score.level_index === level_index) {
          ++same;
          if (scores[ii].score.deaths < total_deaths) {
            ++better;
          }
        }
      }
      font.drawSizedAligned(font_style_seq_progress, -64, y, Z.UI2, font_size2*0.8, glov_font.ALIGN.HCENTER,
        game_width, 0, `Only ${Math.ceil(same / total * 100)}% of players${scores_disabled?'':' also'} won!`);
      y += font_size2;
      if (!scores_disabled) {
        font.drawSizedAligned(font_style_seq_progress, -64, y, Z.UI2, font_size2*0.8, glov_font.ALIGN.HCENTER,
          game_width, 0, `${Math.ceil(better / same * 100)}% of those died fewer times than you`);
        y += font_size2;
      }

      y += 20;

      if (glov_ui.buttonText({
        x: game_width / 2 - glov_ui.button_width / 2 - 64,
        y,
        text: 'HIGH SCORES'
      })) {
        scoresInit();
      }

    }
  }

  function victoryInit() {
    disabil_index = disabil_flow.length;
    victory_trans = {add:['dead'], remove:['blindness', 'amnesia', 'deaf', 'limp' ]};
    game_state = victory;
    score.updateHighScores(function () {
      have_scores = true;
    });
  }

  const font_style_title = glov_font.style(null, {
    outline_width: 2.0,
    outline_color: 0x404040ff,
    glow_xoffs: 3.25,
    glow_yoffs: 3.25,
    glow_inner: -1.5,
    glow_outer: 7,
    glow_color: 0xFF0000ff,
  });
  const font_style_desc = glov_font.style(null, {
    outline_width: 2.0,
    outline_color: 0x202020ff,
    glow_xoffs: 3.25,
    glow_yoffs: 3.25,
    glow_inner: -1.5,
    glow_outer: 7,
    glow_color: 0x00000000,
  });
  function title(dt) {
    defaultCamera();

    const font_size = TILESIZE * 1.5;

    let y = TILESIZE * 2;
    font_style_title.glow_outer = 5 + 5 * Math.sin(glov_engine.getFrameTimestamp() * 0.002);
    font.drawSizedAligned(font_style_title, -64, y, Z.UI2, font_size, glov_font.ALIGN.HCENTER,
      game_width, 0, 'Delver\'s Sunset');
    y += font_size + 40;

    const font_size2 = TILESIZE * 0.5;
    const font_size3 = font_size2 * 1.2 ;
    font.drawSizedAligned(font_style_desc, -64, y, Z.UI2, font_size3, glov_font.ALIGN.HCENTER,
      game_width, 0, 'Jimb Esser - Dashing Strike Games');
    y += font_size3;
    font.drawSizedAligned(glov_font.styleColored(font_style_desc, 0x808080ff), -64, y, Z.UI2, font_size3, glov_font.ALIGN.HCENTER,
      game_width, 0, 'Ludum Dare #40');
    y += font_size3;
    font.drawSizedAligned(glov_font.styleColored(font_style_desc, 0x808080ff), -64, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER,
      game_width, 0, 'All code, art, sound, and');
    y += font_size2;
    font.drawSizedAligned(glov_font.styleColored(font_style_desc, 0x808080ff), -64, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER,
      game_width, 0, 'music created in 48 hours.');
    y += font_size2;

    y += 60;
    font.drawSizedAligned(font_style_desc, -64, y, Z.UI2, font_size3, glov_font.ALIGN.HCENTER,
      game_width, 0, 'A simple platformer gets less simple as you');
    y += font_size3;
    font.drawSizedAligned(font_style_desc, -64, y, Z.UI2, font_size3, glov_font.ALIGN.HCENTER,
      game_width, 0, 'are plagued with afflictions and disabilities');
    y += font_size3;

    y += 40;
    let y_save = y;
    let w = game_width / 4;
    let x = -64 + w / 2;
    font.drawSizedAligned(font_style_desc, x, y, Z.UI2, font_size3, glov_font.ALIGN.HCENTER, w, 0, 'Keyboard');
    y += font_size3;
    font.drawSizedAligned(font_style_desc, x, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER, w, 0, 'Arrows / WASD');
    y += font_size2;
    font.drawSizedAligned(font_style_desc, x, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER, w, 0, 'Up / W / Space');
    y += font_size2;
    font.drawSizedAligned(font_style_desc, x, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER, w, 0, 'R');
    y += font_size2;

    y = y_save;
    x += w;
    font.drawSizedAligned(font_style_desc, x, y, Z.UI2, font_size3, glov_font.ALIGN.HCENTER, w, 0, '- Controls -');
    y += font_size3;
    font.drawSizedAligned(font_style_desc, x, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER, w, 0, '- Move -');
    y += font_size2;
    font.drawSizedAligned(font_style_desc, x, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER, w, 0, '- Jump -');
    y += font_size2;
    font.drawSizedAligned(font_style_desc, x, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER, w, 0, '- Restart Level -');
    y += font_size2;

    y = y_save;
    x += w;
    font.drawSizedAligned(font_style_desc, x, y, Z.UI2, font_size3, glov_font.ALIGN.HCENTER, w, 0, 'Gamepad');
    y += font_size3;
    font.drawSizedAligned(font_style_desc, x, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER, w, 0, 'Stick or D-Pad');
    y += font_size2;
    font.drawSizedAligned(font_style_desc, x, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER, w, 0, 'A');
    y += font_size2;
    font.drawSizedAligned(font_style_desc, x, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER, w, 0, 'Y');
    y += font_size2;


    y += 80;

    if (glov_ui.buttonText({
      x: game_width / 2 - glov_ui.button_width / 2 - 64,
      y,
      text: 'BEGIN'
    }) || glov_input.keyDownHit(key_codes.SPACE) || glov_input.keyDownHit(key_codes.RETURN) || glov_input.padDownHit(0, pad_codes.A)) {
      disabil_index = level_index = 0;
      disabil = {};
      total_deaths = 0;
      deaths_per_level = 0;
      scores_disabled = false;
      playInit();
    }
    y += glov_ui.button_height + 8;

    if (glov_ui.buttonText({
      x: game_width / 2 - glov_ui.button_width / 2 - 64,
      y,
      text: 'HIGH SCORES'
    })) {
      scoresInit();
    }
  }

  function titleInit() {
    $('.screen').hide();
    startMusic(true);
    game_state = title;
  }

  function printScore(sc) {
    let seq = sc.disabil_index + ((sc.level_index === 3) ? 1 : 0);
    return `${seq === 9 ? 'COMPLETE' : `Sequence ${seq}`}, ${sc.deaths} Deaths`;
  }

  let scores_edit_box;
  function scores(dt) {
    defaultCamera();

    const font_size = TILESIZE * 1.5;

    let y = TILESIZE * 0.5;
    font_style_title.glow_outer = 7;
    font.drawSizedAligned(font_style_title, -64, y, Z.UI2, font_size, glov_font.ALIGN.HCENTER,
      game_width, 0, 'HIGH SCORES');
    y += font_size + 20;

    const font_size2 = TILESIZE * 0.45;
    let my_score = score.getScore('all');
    let has_score = my_score && (my_score.disabil_index || my_score.level_index === 3);
    font.drawSizedAligned(font_style_desc, -64, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER,
      game_width, 0, 'Your best: ' +
      (has_score ?  printScore(my_score) : 'None found'));
    y += font_size2 * 1.5;

    let hs = score.high_scores && score.high_scores.all;
    if (hs) {
      // if (DEBUG) {
      //   let ar = [];
      //   for (let ii = 0; ii < 10; ++ii) {
      //     for (let jj = 0; jj < hs.length; ++jj) {
      //       ar.push(hs[jj]);
      //     }
      //   }
      //   hs = ar;
      // }
      for (let ii = 0; ii < Math.min(hs.length, 20); ++ii) {
        let sc = hs[ii];
        let style = font_style_desc;
        if (sc.name === score.player_name) {
          style = glov_font.styleColored(style, 0xFFFF20ff);
        }
        font.drawSizedAligned(style, -64, y, Z.UI2, font_size2, glov_font.ALIGN.HCENTER,
          game_width, 0, `#${ii+1}: ${sc.name} - ${printScore(sc.score)}`);

        y += font_size2;

      }
    }

    // Bottom buttons
    y = game_height - glov_ui.button_height * 2 - 20;
    if (has_score) {
      const pad = 20;
      let x = game_width / 2 - (glov_ui.button_width + scores_edit_box.w + pad) / 2 - 64;
      if (scores_edit_box.run({
        x,
        y,
      }) === scores_edit_box.SUBMIT || glov_ui.buttonText({
        x: x + scores_edit_box.w + 20,
        y,
        w: glov_ui.button_width,
        h: glov_ui.button_height / 2,
        font_height: glov_ui.font_height / 2,
        text: 'Update Player Name'
      })) {
        // scores_edit_box.text
        if (scores_edit_box.text) {
          score.updatePlayerName(scores_edit_box.text);
        }
      }
    }

    y += glov_ui.button_height + 10;

    if (glov_ui.buttonText({
      x: game_width / 2 - glov_ui.button_width / 2 - 64,
      y,
      text: 'MAIN MENU'
    }) || glov_input.keyDownHit(key_codes.SPACE) || glov_input.keyDownHit(key_codes.RETURN) || glov_input.padDownHit(0, pad_codes.A)) {
      titleInit();
    }
  }

  function scoresInit() {
    scores_edit_box = glov_ui.createEditBox({
      x: 300,
      y: 100,
      w: 200,
    });
    scores_edit_box.setText(score.player_name);

    score.updateHighScores();
    game_state = scores;
  }

  let fake_load = 0;
  if (DEBUG) {
    //fake_load = 10;
  }

  function loading() {
    let load_count = glov_sprite.loading() + sound_manager.loading() + fake_load;
    $('#loading_text').text(`Loading (${load_count})...`);
    if (!load_count) {
      $('#loading').hide();
      //endOfSetInit();
      if (DEBUG) {
        titleInit();
        // playInit();
        // scoresInit();
      } else {
        titleInit();
      }
    }
  }

  function loadingInit() {
    initGraphics();
    $('.screen').hide();
    $('#loading').show();
    game_state = loading;
    loading();
  }

  game_state = loadingInit;

  function tick(dt) {
    game_state(dt);
  }

  loadingInit();
  glov_engine.go(tick);
}
