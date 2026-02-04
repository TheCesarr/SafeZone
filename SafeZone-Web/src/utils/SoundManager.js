class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.4; // Master volume (not too loud)
        this.masterGain.connect(this.ctx.destination);
    }

    playTone(freq, duration, type = 'sine', startTime = 0) {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    // 1. Channel Join (Happy ascending chime)
    playJoin() {
        this.playTone(400, 0.1, 'sine', 0);
        this.playTone(600, 0.4, 'sine', 0.1);
    }

    // 2. Channel Leave (Descending chime)
    playLeave() {
        this.playTone(600, 0.1, 'sine', 0);
        this.playTone(400, 0.4, 'sine', 0.1);
    }

    // 3. Message Received (Sharp Ding)
    playMessage() {
        this.playTone(800, 0.1, 'sine', 0);
        this.playTone(1200, 0.3, 'sine', 0.05);
    }

    // 4. Mute Toggle (Click)
    playMute(isMuted) {
        // High pitch "pip" for unmute, muted thud for mute
        if (!isMuted) {
            // Unmuting (Active)
            this.playTone(600, 0.05, 'triangle', 0);
        } else {
            // Muting (Off)
            this.playTone(300, 0.05, 'triangle', 0);
        }
    }

    // 5. Deafen Toggle (Deeper Click)
    playDeafen(isDeafened) {
        if (!isDeafened) {
            this.playTone(500, 0.1, 'square', 0);
        } else {
            this.playTone(200, 0.1, 'square', 0);
        }
    }

    // 6. Screen Share (Tech Sound)
    playScreenShare(isStarting) {
        if (isStarting) {
            this.playTone(400, 0.1, 'sawtooth', 0);
            this.playTone(800, 0.3, 'sawtooth', 0.1);
        } else {
            this.playTone(800, 0.1, 'sawtooth', 0);
            this.playTone(400, 0.3, 'sawtooth', 0.1);
        }
    }
}

export default new SoundManager();
