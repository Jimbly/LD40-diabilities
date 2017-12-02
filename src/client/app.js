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

// Virtual viewport for our game logic
const game_width = 1280;
const game_height = 960;

export function main(canvas)
{
  const glov_engine = require('./glov/engine.js');
  const glov_font = require('./glov/font.js');
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
  // const font = glov_engine.font;

  const loadTexture = glov_sprite.loadTexture.bind(glov_sprite);
  const createSprite = glov_sprite.createSprite.bind(glov_sprite);

  glov_ui.bindSounds(sound_manager, {
    button_click: 'button_click',
    rollover: 'rollover',
  });

  const color_white = math_device.v4Build(1, 1, 1, 1);
  const color_red = math_device.v4Build(1, 0, 0, 1);
  const color_green = math_device.v4Build(0, 1, 0, 1);
  const color_yellow = math_device.v4Build(1, 1, 0, 1);
  const color_beam_green_warmup = math_device.v4Build(0, 1, 0, 0.19);
  const color_beam_green_fire = math_device.v4Build(0, 1, 0, 1);
  const color_beam_red_warmup = math_device.v4Build(1, 0, 0, 0.19);
  const color_beam_red_fire = math_device.v4Build(1, 0, 0, 1);
  const color_bricks = math_device.v4Build(0.8, 0.5, 0.5, 1);
  // Cache key_codes
  const key_codes = glov_input.key_codes;
  const pad_codes = glov_input.pad_codes;

  let game_state;

  let sprites = {};

  const TILESIZE = 64;
  const CHAR_W = 0.5 * 1.5;
  const CHAR_H = 1 * 1.5;
  const LEVEL_W = 18;
  const LEVEL_H = 14;


  const spriteSize = 64;
  function initGraphics() {
    if (sprites.white) {
      return;
    }

    sound_manager.loadSound('test');
    //loadTexture('avatar.png');

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

    // sprites.avatar = createSprite('avatar.png', {
    //   width : CHAR_W * TILESIZE,
    //   height : CHAR_H * TILESIZE,
    //   rotation : 0,
    //   color : [1,1,1,1],
    //   origin: [0, CHAR_H * TILESIZE],
    //   textureRectangle : math_device.v4Build(0, 0, 16, 32)
    // });
    sprites.avatar = glov_ui.loadSpriteRect('avatar.png', [16, 16], [32]);
    sprites.avatar2 = glov_ui.loadSpriteRect('avatar2.png', [13, 13, 13, 13], [26, 26, 26]);
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

  let character;
  let level;
  let disabil = {
    limp: true,
    color_blindness: false,
    vertigo: false,
  };

  let level_index = 3;
  let level_countdown = 0;
  let vertigo_counter = 0;

  function filterColor(color) {
    if (!disabil.color_blindness) {
      return color;
    }
    let b = Math.min((color[0] + color[1] + color[2]) * 0.5, 1);
    return [b, b, b, color[3]];
  }

  function levelInit() {
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
    level.solids = [
      [0,2, 4,3],
      [6,6, 10,7],
      [14,9, 18,10],
      [-1,-1, 0, LEVEL_H + 1], // left
      [LEVEL_W,-1, LEVEL_W + 1, LEVEL_H + 1], // right
      [0,LEVEL_H, LEVEL_W, LEVEL_H + 1], // top
      [0,-1, LEVEL_W, 0], // bottom
    ];
    level.dangers = [
      [0,0, 18,1],
    ];
    if (level_index === 1) {
      level.solids.push([1,7, 3, 8]);
      level.dangers.push([1,6, 3,7, -1], [7.5,7, 8.5,8]);
    }
    level.lasers = [];
    if (level_index === 2) {
      // x, ymid, h, magnitude, bad, yoffs
      level.lasers.push([0.5, 6, 2, 2, 1, 0]);
      level.lasers.push([0.5, 3, 2, 2, 0, 0]);

      level.lasers.push([5, 8, 2, 2, 0, 0]);
      level.lasers.push([5, 5, 2, 2, 1, 0]);

      level.lasers.push([12, 10, 2, 2, 1, 0]);
      level.lasers.push([12, 7,  2, 2, 0, 0]);
    }
    level.beams = [];
    if (level_index === 3) {
      // x, y, slope
      level.beams.push([0,6, -1, 0]);
      level.beams.push([0,10, -1, 0.5]);
      level.beams.push([0,14, -1, 0]);
      level.beams.push([4,14, -1, 0.5]);
      level.beams.push([8,14, -1, 0]);
      level.beams.push([12,14, -1, 0.5]);
    }

    level.exit = [16,10, 17, 12];
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
  const BEAM_FIRE = 0.3;
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
      level.lasers[ii][5] = Math.sin((glov_engine.getFrameTimestamp() - level.timestamp_base) * 0.002) * level.lasers[ii][3];
    }
    for (let ii = 0; ii < level.beams.length; ++ii) {
      level.beams[ii][3] += BEAM_CHARGE_SPEED * dt;
      while (level.beams[ii][3] > 1) {
        level.beams[ii][3] -= 1;
      }
    }
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
    if (disabil.limp) {
       movement_scale = Math.min(1, Math.sin(character.runloop*(2 * Math.PI) - (Math.PI/2)) * 0.5 + 1);
    }

    let was_on_ground = character.on_ground;
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
      character.v[1] = dy * JUMP_SPEED * movement_scale;
      character.jumping = JUMP_TIME;
      character.jumping_released = false;
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
    if (was_on_ground) {
      character.runloop += character.facing * horiz_movement * RUN_LOOP_SCALE;
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
    // dangers in final position
    if (!character.exited && !character.dead) {
      for (let ii = 0; ii < level.dangers.length; ++ii) {
        let d = level.dangers[ii];
        if (collide([d[0] + 0.25, d[1], d[2] - 0.25, d[3]])) {
          character.dead = true;
        }
      }
      for (let ii = 0; ii < level.lasers.length; ++ii) {
        let laser = level.lasers[ii];
        if (laser[4]) { // bad
          let x = laser[0];
          let h = laser[2];
          let y = laser[1] - h/2 + laser[5];
          if (character.pos[0] < x && character.pos[0] + CHAR_W > x &&
            character.pos[1] + CHAR_H > y && character.pos[1] < y + h)
          {
            character.dead = true;
          }
        }
      }
      for (let ii = 0; ii < level.beams.length; ++ii) {
        let b = level.beams[ii];
        if (b[3] > 0.5 + BEAM_FIRE) {
          if (util.lineCircleIntersect(b, [b[0] + LEVEL_W, b[1] + LEVEL_W * b[2]], [character.pos[0] + CHAR_W/2, character.pos[1] + CHAR_H/2], CHAR_H/2)) {
            character.dead = true;
          }
        }
      }
      if (character.dead) {
        level_countdown = 3000;
      }
    }
    if (!character.dead && !character.exited) {
      if (collide(level.exit)) {
        character.exited = true;
        level_countdown = 1500;
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

  function play(dt) {
    defaultCamera();

    if (glov_input.keyDownHit(key_codes.R)) {
      playInit(dt);
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

    // character
    let char_draw_pos = [character.pos[0] * TILESIZE,  game_height - ((character.pos[1] + CHAR_H) * TILESIZE)];
    if (character.facing < 0) {
      char_draw_pos[0] += CHAR_W * TILESIZE;
    }
    let char_draw_scale = [character.facing * TILESIZE*CHAR_W, TILESIZE*CHAR_H, 1, 1];
    if (character.dead) {
      draw_list.queue(sprites.avatar, char_draw_pos[0], char_draw_pos[1], Z.CHARACTER, color_white,
        char_draw_scale, sprites.avatar.uidata.rects[1]);
    } else {
      let frame = Math.floor((character.runloop % 1) * 8);
      if (!character.on_ground) {
        frame = character.jumping ? 9 : 8;
      }
      draw_list.queue(sprites.avatar2, char_draw_pos[0], char_draw_pos[1], Z.CHARACTER, color_white,
        char_draw_scale, sprites.avatar2.uidata.rects[frame]);
    }

    // world
    if (disabil.vertigo) {
      vertigo_counter += dt * 0.01;
      if (character.on_ground) {
        vertigo_counter = Math.min(vertigo_counter, Math.PI * 2);
      } else {
        while (vertigo_counter > Math.PI * 2) {
          vertigo_counter -= Math.PI * 2;
        }
      }
      glov_camera.zoom((character.pos[0] + CHAR_W/2) * TILESIZE, game_height - (character.pos[1]) * TILESIZE, 1 + 0.5 * Math.sin(vertigo_counter));
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
      drawWorldElem(sprites.solid, level.solids[ii], false);
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
      let w = Math.min(b[1], LEVEL_W - b[0]);
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


    if (disabil.color_blindness) {
      drawWorldElem(sprites.exit_desat, level.exit);
    } else {
      drawWorldElem(sprites.exit, level.exit);
    }

    // let font_style = glov_font.style(null, {
    //   outline_width: 1.0,
    //   outline_color: 0x800000ff,
    //   glow_xoffs: 3.25,
    //   glow_yoffs: 3.25,
    //   glow_inner: -2.5,
    //   glow_outer: 5,
    //   glow_color: 0x000000ff,
    // });
    // glov_ui.print(font_style, test.character.x, test.character.y + (++font_test_idx * glov_ui.font_height), Z.SPRITES,
    //   'Outline and Drop Shadow');

    if (level_countdown) {
      if (dt >= level_countdown) {
        if (character.exited) {
          level_index++;
        }
        playInit(dt);
      } else {
        level_countdown -= dt;
      }
    }
  }

  function playInit(dt) {
    levelInit();
    $('.screen').hide();
    $('#title').show();
    game_state = play;
    play(dt);
  }

  function loading() {
    let load_count = glov_sprite.loading() + sound_manager.loading();
    $('#loading').text(`Loading (${load_count})...`);
    if (!load_count) {
      game_state = playInit;
    }
  }

  function loadingInit() {
    initGraphics();
    $('.screen').hide();
    $('#title').show();
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
