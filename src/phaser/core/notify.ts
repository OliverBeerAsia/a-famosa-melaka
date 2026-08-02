/**
 * Transient screen-space text: the toast notification and the location name
 * card.
 *
 * Both are fire-and-forget — they create their own text object, animate it and
 * destroy it — so they are free functions rather than a system. They live in
 * one place because every system that wants to say something to the player
 * ("Acquired: rope", "Time: 19:00 - Golden Hour") used to reach back into
 * GameScene for it.
 */

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../game';
import { DEPTH_UI_NOTIFICATION, DEPTH_UI_NAME_CARD } from './depth';
import { TEXT_COLOR, TYPE, textStyle } from './typography';

/** Toast near the top of the screen: fades in, holds, fades out. */
export function showNotification(scene: Phaser.Scene, text: string): Phaser.GameObjects.Text {
  const notification = scene.add.text(
    GAME_WIDTH / 2,
    GAME_HEIGHT * 0.2,
    text,
    // display 16: a toast is a button-tier legend, and toasts run long
    // ("Acquired: Letter of Commendation") — see the note in showLocationCard.
    textStyle(TYPE.displayLabel, { color: TEXT_COLOR.brass, align: 'center' })
  );
  notification.setOrigin(0.5, 0.5);
  notification.setScrollFactor(0);
  notification.setDepth(DEPTH_UI_NOTIFICATION);
  notification.setAlpha(0);

  // Animate in and out
  scene.tweens.add({
    targets: notification,
    alpha: 1,
    y: GAME_HEIGHT * 0.15,
    duration: 400,
    ease: 'Power2',
    onComplete: () => {
      scene.time.delayedCall(2000, () => {
        scene.tweens.add({
          targets: notification,
          alpha: 0,
          y: GAME_HEIGHT * 0.1,
          duration: 400,
          onComplete: () => notification.destroy(),
        });
      });
    },
  });

  return notification;
}

/** The big location title shown on arrival. */
export function showLocationCard(scene: Phaser.Scene, name: string): Phaser.GameObjects.Text {
  // display 24 — the world tier, exactly as the standard specifies for the
  // location name card. Location names are short ("A Famosa Fortress" is the
  // longest at 17 glyphs = 408px), so they fit the viewport at this rung.
  const titleText = scene.add.text(
    GAME_WIDTH / 2, GAME_HEIGHT / 3, name,
    textStyle(TYPE.displayWorld, { color: TEXT_COLOR.brass })
  );
  titleText.setOrigin(0.5, 0.5);
  titleText.setScrollFactor(0);
  titleText.setDepth(DEPTH_UI_NAME_CARD);
  titleText.setAlpha(0);

  // Fade in then out
  scene.tweens.add({
    targets: titleText,
    alpha: 1,
    duration: 500,
    onComplete: () => {
      scene.time.delayedCall(2000, () => {
        scene.tweens.add({
          targets: titleText,
          alpha: 0,
          duration: 1000,
          onComplete: () => titleText.destroy(),
        });
      });
    },
  });

  return titleText;
}
