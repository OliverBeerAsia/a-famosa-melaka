/**
 * Message Box UI
 *
 * Simple popup for showing object descriptions,
 * pickup notifications, and game messages.
 */

export default class MessageBox {
  constructor(scene) {
    this.scene = scene;
    this.isVisible = false;
    this.autoHideTimer = null;

    this.createUI();
    this.setupEvents();
  }

  createUI() {
    const width = 500;
    const height = 100;
    const x = (960 - width) / 2;
    const y = 400;

    // Container
    this.container = this.scene.add.container(x, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(2500);
    this.container.setAlpha(0);

    // Background
    this.background = this.scene.add.rectangle(0, 0, width, height, 0x1a1410, 0.95);
    this.background.setOrigin(0, 0);
    this.background.setStrokeStyle(3, 0xD4A574);
    this.container.add(this.background);

    // Title
    this.titleText = this.scene.add.text(width / 2, 12, '', {
      font: 'bold 20px monospace',
      fill: '#F4B41A'
    });
    this.titleText.setOrigin(0.5, 0);
    this.container.add(this.titleText);

    // Message text
    this.messageText = this.scene.add.text(15, 40, '', {
      font: '16px monospace',
      fill: '#F5E6D3',
      wordWrap: { width: width - 30 }
    });
    this.container.add(this.messageText);
  }

  setupEvents() {
    this.scene.events.on('showMessage', this.show, this);
  }

  show(data) {
    const { title, text, duration = 3000 } = data;

    // Clear any existing timer
    if (this.autoHideTimer) {
      this.autoHideTimer.remove();
    }

    // Set content
    this.titleText.setText(title || '');
    this.messageText.setText(text || '');

    // Adjust height based on text
    const textHeight = this.messageText.height;
    const newHeight = Math.max(80, textHeight + 60);
    this.background.setSize(500, newHeight);

    // Show
    this.isVisible = true;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      y: 400,
      duration: 200,
      ease: 'Back.easeOut'
    });

    // Auto-hide after duration
    this.autoHideTimer = this.scene.time.delayedCall(duration, () => {
      this.hide();
    });
  }

  hide() {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      y: 420,
      duration: 200,
      onComplete: () => {
        this.isVisible = false;
      }
    });
  }

  destroy() {
    this.scene.events.off('showMessage', this.show, this);
    if (this.autoHideTimer) {
      this.autoHideTimer.remove();
    }
    this.container.destroy();
  }
}

