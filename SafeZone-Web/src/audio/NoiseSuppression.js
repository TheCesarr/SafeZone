/**
 * NoiseSuppression - RNNoise AI Noise Suppression for WebRTC
 * Uses @jitsi/rnnoise-wasm with AudioWorklet for real-time noise filtering
 * 
 * Usage:
 *   const ns = new NoiseSuppression();
 *   const processedStream = await ns.init(rawMicStream);
 *   // processedStream is a MediaStream with noise-filtered audio
 *   ns.destroy(); // cleanup
 */

const RNNOISE_FRAME_SIZE = 480; // RNNoise expects 480 samples per frame (10ms at 48kHz)

export class NoiseSuppression {
    constructor() {
        this.audioContext = null;
        this.sourceNode = null;
        this.processorNode = null;
        this.destinationNode = null;
        this.rnnoiseModule = null;
        this.rnnoiseState = null;
        this.inputPtr = null;
        this.outputPtr = null;
        this.inputBuffer = new Float32Array(RNNOISE_FRAME_SIZE);
        this.inputBufferOffset = 0;
        this.enabled = true;
        this.processedStream = null;
    }

    /**
     * Initialize noise suppression on a mic stream
     * @param {MediaStream} stream - Raw microphone MediaStream
     * @returns {MediaStream} - Processed MediaStream with noise removed
     */
    async init(stream) {
        try {
            // Create AudioContext at 48kHz (RNNoise requirement)
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000
            });

            // Resume AudioContext (required for Electron/Chrome autoplay policy)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Load RNNoise WASM module
            const { createRNNWasmModuleSync } = await import('@jitsi/rnnoise-wasm');
            this.rnnoiseModule = await createRNNWasmModuleSync();

            // Initialize RNNoise
            this.rnnoiseModule._rnnoise_init();
            this.rnnoiseState = this.rnnoiseModule._rnnoise_create();

            // Allocate WASM memory for audio buffers
            this.inputPtr = this.rnnoiseModule._malloc(RNNOISE_FRAME_SIZE * 4);
            this.outputPtr = this.rnnoiseModule._malloc(RNNOISE_FRAME_SIZE * 4);

            // Create audio processing pipeline
            this.sourceNode = this.audioContext.createMediaStreamSource(stream);
            this.destinationNode = this.audioContext.createMediaStreamDestination();

            // Use ScriptProcessorNode (widely supported in Electron)
            // Buffer size 4096 gives us multiple RNNoise frames per callback
            this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

            this.processorNode.onaudioprocess = (event) => {
                const input = event.inputBuffer.getChannelData(0);
                const output = event.outputBuffer.getChannelData(0);

                if (!this.enabled || !this.rnnoiseState) {
                    // Bypass - copy input to output directly
                    output.set(input);
                    return;
                }

                // Process input in RNNOISE_FRAME_SIZE chunks
                let inputOffset = 0;
                let outputOffset = 0;

                while (inputOffset < input.length) {
                    // Fill the 480-sample buffer
                    const remaining = RNNOISE_FRAME_SIZE - this.inputBufferOffset;
                    const available = input.length - inputOffset;
                    const toCopy = Math.min(remaining, available);

                    this.inputBuffer.set(
                        input.subarray(inputOffset, inputOffset + toCopy),
                        this.inputBufferOffset
                    );
                    this.inputBufferOffset += toCopy;
                    inputOffset += toCopy;

                    // When we have a full frame, process it
                    if (this.inputBufferOffset >= RNNOISE_FRAME_SIZE) {
                        // Scale float [-1,1] to int16 range for RNNoise
                        const inputHeap = this.rnnoiseModule.HEAPF32;
                        const inputStart = this.inputPtr >> 2;

                        for (let i = 0; i < RNNOISE_FRAME_SIZE; i++) {
                            inputHeap[inputStart + i] = this.inputBuffer[i] * 32768.0;
                        }

                        // Run RNNoise
                        this.rnnoiseModule._rnnoise_process_frame(
                            this.rnnoiseState,
                            this.outputPtr,
                            this.inputPtr
                        );

                        // Read processed output and scale back to float
                        const outputHeap = this.rnnoiseModule.HEAPF32;
                        const outputStart = this.outputPtr >> 2;

                        for (let i = 0; i < RNNOISE_FRAME_SIZE; i++) {
                            if (outputOffset + i < output.length) {
                                output[outputOffset + i] = outputHeap[outputStart + i] / 32768.0;
                            }
                        }
                        outputOffset += RNNOISE_FRAME_SIZE;
                        this.inputBufferOffset = 0;
                    }
                }
            };

            // Connect: Source → Processor → Destination
            this.sourceNode.connect(this.processorNode);
            this.processorNode.connect(this.destinationNode);

            this.processedStream = this.destinationNode.stream;
            console.log('[NoiseSuppression] RNNoise initialized successfully');
            return this.processedStream;
        } catch (error) {
            console.error('[NoiseSuppression] Failed to initialize:', error);
            // Return original stream as fallback
            return stream;
        }
    }

    /**
     * Enable/disable noise suppression without destroying the pipeline
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`[NoiseSuppression] ${enabled ? 'Enabled' : 'Disabled'}`);
    }

    /**
     * Get the processed stream (or null if not initialized)
     */
    getProcessedStream() {
        return this.processedStream;
    }

    /**
     * Cleanup all resources
     */
    destroy() {
        try {
            if (this.processorNode) {
                this.processorNode.disconnect();
                this.processorNode.onaudioprocess = null;
                this.processorNode = null;
            }
            if (this.sourceNode) {
                this.sourceNode.disconnect();
                this.sourceNode = null;
            }
            if (this.destinationNode) {
                this.destinationNode = null;
            }
            if (this.rnnoiseState && this.rnnoiseModule) {
                this.rnnoiseModule._rnnoise_destroy(this.rnnoiseState);
                this.rnnoiseState = null;
            }
            if (this.inputPtr && this.rnnoiseModule) {
                this.rnnoiseModule._free(this.inputPtr);
                this.inputPtr = null;
            }
            if (this.outputPtr && this.rnnoiseModule) {
                this.rnnoiseModule._free(this.outputPtr);
                this.outputPtr = null;
            }
            if (this.audioContext) {
                this.audioContext.close().catch(() => { });
                this.audioContext = null;
            }
            this.processedStream = null;
            this.rnnoiseModule = null;
            console.log('[NoiseSuppression] Destroyed');
        } catch (e) {
            console.error('[NoiseSuppression] Destroy error:', e);
        }
    }
}
