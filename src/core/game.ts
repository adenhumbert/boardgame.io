/*
 * Copyright 2017 The boardgame.io Authors
 *
 * Use of this source code is governed by a MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import * as plugins from '../plugins/main';
import { Flow } from './flow';
import { GameConfig, Move, LongFormMove, State } from '../types';
import * as logging from './logger';

/**
 * Game
 *
 * Helper to generate the game move reducer. The returned
 * reducer has the following signature:
 *
 * (G, action, ctx) => {}
 *
 * You can roll your own if you like, or use any Redux
 * addon to generate such a reducer.
 *
 * The convention used in this framework is to
 * have action.type contain the name of the move, and
 * action.args contain any additional arguments as an
 * Array.
 */
export function Game(game: GameConfig) {
  // The Game() function has already been called on this
  // config object, so just pass it through.
  if (game.processMove) {
    return game;
  }

  if (game.name === undefined) game.name = 'default';
  if (game.setup === undefined) game.setup = () => ({});
  if (game.moves === undefined) game.moves = {};
  if (game.playerView === undefined) game.playerView = G => G;
  if (game.plugins === undefined) game.plugins = [];

  game.plugins.forEach(plugin => {
    if (plugin.name === undefined) {
      throw new Error('Plugin missing name attribute');
    }
    if (plugin.name.includes(' ')) {
      throw new Error(plugin.name + ': Plugin name must not include spaces');
    }
  });

  if (game.name.includes(' ')) {
    throw new Error(game.name + ': Game name must not include spaces');
  }

  const flow = Flow(game);

  return {
    ...game,

    flow,

    moveNames: flow.moveNames,

    processMove: (state: State, action) => {
      let moveFn = flow.getMove(state.ctx, action.type, action.playerID);

      if (IsLongFormMove(moveFn)) {
        moveFn = moveFn.move;
      }

      if (moveFn instanceof Function) {
        const fn = plugins.FnWrap(moveFn, game.plugins);
        const ctxWithAPI = {
          ...plugins.EnhanceCtx(state),
          playerID: action.playerID,
        };
        let args = [state.G, ctxWithAPI];
        if (action.args !== undefined) {
          args = args.concat(action.args);
        }
        return fn(...args);
      }

      logging.error(`invalid move object: ${action.type}`);

      return state.G;
    },
  };
}

function IsLongFormMove(move: Move): move is LongFormMove {
  return move instanceof Object && (move as LongFormMove).move !== undefined;
}
