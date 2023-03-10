/* Derived from https://github.com/yxl/opencore-amr-js/blob/master/js/pre.js
 * under terms of Apache 2 license
 * Adapted for use with amrwb codec from armnb
 */

import AMRWB from './amrwb.min'

const AMRWB_UTIL = {
  /**
    * Decode AMR file to the PCM data with sample rate 8000.
    * @param {Uint8Array} amr The raw amr file data.
    * @returns {Float32Array} PCM data if succeeded. Otherwise null.
    */
  decode(amr) {
    const raw = this._decode(amr)
    if (!raw)
      return null

    const out = new Float32Array(raw.length)
    for (let i = 0; i < out.length; i++)
      out[i] = raw[i] / 0x8000

    return out
  },
  /**
     * Decode RTP AMR file to the PCM data with sample rate 8000.
     * @param {Uint8Array} amr The raw amr file data.
     * @returns {Float32Array} PCM data if succeeded. Otherwise null.
     */
  decodeRtp(rtp) {
    const raw = this._decodeRtp(rtp)
    if (!raw)
      return null

    // Oversample as we go
    const out = new Float32Array(raw.length * 2)
    for (let i = 0; i < out.length; i++) {
      out[i * 2] = raw[i] / 0x8000
      out[(i * 2) + 1] = out[i * 2]
    }
    return out
  },
  /**
     * Initialise the decoder
     */
  decodeInit() {
    if (!this.decoder)
      this.decoder = this.D_IF_init()

    return this.decoder
  },
  /**
     * Exit the decoder
     */
  decodeExit() {
    if (this.decoder) {
      this.D_IF_exit(this.decoder)
      delete this.decoder
    }
  },
  /**
     * Decode AMR file to raw PCM data with sample rate 16000.
     * @param {Uint8Array} amr The raw amr file data.
     * @returns {Int16Array} PCM data if succeeded. Otherwise null.
     */
  _decode(amr) {
    // Check file header.
    if (String.fromCharCode.apply(null, amr.slice(0, this.AMR_HEADER.length)) !== this.AMR_HEADER)
      return null

    if (!this.decoder)
      return null

    let out = new Int16Array(Math.floor(amr.length / 6 * this.PCM_BUFFER_COUNT))

    let buf = AMRWB._malloc(this.AMR_BUFFER_COUNT)
    const decodeInBuffer = new Uint8Array(AMRWB._HEAPU8.buffer, buf, this.AMR_BUFFER_COUNT)

    buf = AMRWB._malloc(this.PCM_BUFFER_COUNT * 2)
    const decodeOutBuffer = new Int16Array(AMRWB._HEAPU8.buffer, buf, this.PCM_BUFFER_COUNT)

    let inOffset = this.AMR_HEADER.length
    let outOffset = 0
    while (inOffset + 1 < amr.length
             && outOffset + 1 < out.length) {
      // Find the package size
      const size = this.SIZES[(amr[inOffset] >> 3) & 0x0F]
      if (inOffset + size + 1 > amr.length)
        break

      decodeInBuffer.set(amr.slice(inOffset, inOffset + size + 1))
      this.D_IF_decode(this.decoder, decodeInBuffer.byteOffset, decodeOutBuffer.byteOffset, 0)

      if (outOffset + this.PCM_BUFFER_COUNT > out.length) {
        const newOut = new Int16Array(out.length * 2)
        newOut.set(out.slice(0, outOffset))
        out = newOut
      }
      out.set(decodeOutBuffer, outOffset)
      outOffset += this.PCM_BUFFER_COUNT
      inOffset += size + 1
    }

    AMRWB._free(decodeInBuffer.byteOffset)
    AMRWB._free(decodeOutBuffer.byteOffset)

    return out.slice(0, outOffset)
  },
  /**
     * Decode RTP packet to raw PCM data with sample rate 16000.
     * @param {Uint8Array} rtp The RTP encapsulated amr file data.
     * @returns {Int16Array} PCM data if succeeded. Otherwise null.
     */
  _decodeRtp(rtp) {
    const tocPtr = this.RTP_HEADER_SIZE + 1
    let payloadLengthCheck = 0
    let payLoadptr
    for (payLoadptr = this.RTP_HEADER_SIZE + 1;
      ((rtp[payLoadptr] & 0x80) === 0x80) && (payLoadptr < rtp.length);
      payLoadptr++) {
      // Calculate AMR frame size to check packet matches calculated length from TOC
      payloadLengthCheck += this._rtpFrameSize(rtp[payLoadptr]) + 1 // The +1 is for the byte in the TOC
    }
    // Add header and TOC size to AMR data size to yield calculated packet size and advance payload pointer past final TOC entry
    payloadLengthCheck += this._rtpFrameSize(rtp[payLoadptr]) + this.RTP_HEADER_SIZE + 2
    payLoadptr++

    if (payloadLengthCheck !== rtp.length) {
      // eslint-disable-next-line no-console
      console.log(`RTP calculated vs actual length error: Calc ${payloadLengthCheck}, actual: ${rtp.length}`)
      return null
    }
    if (!this.decoder)
      return null

    let out = new Int16Array(Math.floor(rtp.length / 6 * this.PCM_BUFFER_COUNT))
    let buf = AMRWB._malloc(this.AMR_BUFFER_COUNT)
    const decodeInBuffer = new Uint8Array(AMRWB._HEAPU8.buffer, buf, this.AMR_BUFFER_COUNT)
    buf = AMRWB._malloc(this.PCM_BUFFER_COUNT * 2)
    const decodeOutBuffer = new Int16Array(AMRWB._HEAPU8.buffer, buf, this.PCM_BUFFER_COUNT)
    let outPcmPtr = 0

    while ((((tocPtr === this.RTP_HEADER_SIZE + 1) && (rtp[tocPtr - 1] === this.RTP_TOC_HEADER))
                 || ((rtp[tocPtr - 1] & 0x80) === 0x80))
                 && (payLoadptr < rtp.length)) {
      const frameSize = this._rtpFrameSize(rtp[tocPtr])
      if (payLoadptr + frameSize > rtp.length)
        break

      decodeInBuffer.set([rtp[tocPtr] & 0x7F]) // Start code
      decodeInBuffer.set(rtp.slice(payLoadptr, payLoadptr + frameSize), 1)
      this.D_IF_decode(this.decoder, decodeInBuffer.byteOffset, decodeOutBuffer.byteOffset, 0)
      if (outPcmPtr + this.PCM_BUFFER_COUNT > out.length) {
        const newOut = new Int16Array(out.length * 2)
        newOut.set(out.slice(0, outPcmPtr))
        out = newOut
      }
      out.set(decodeOutBuffer, outPcmPtr)
      outPcmPtr += this.PCM_BUFFER_COUNT
      payLoadptr += frameSize
    }
    AMRWB._free(decodeInBuffer.byteOffset)
    AMRWB._free(decodeOutBuffer.byteOffset)
    return out.slice(0, outPcmPtr)
  },
  _rtpFrameSize(key) {
    const frameSizeIndex = (key >> 3) & 0x0F
    const frameSize = this.SIZES[frameSizeIndex]
    return frameSize
  },

  // Decoding modes and its frame sizes (bytes), respectively
  SIZES: [17, 23, 32, 36, 40, 46, 50, 58, 60, 5, -1, -1, -1, -1, -1, 0],

  AMR_BUFFER_COUNT: 61,

  PCM_BUFFER_COUNT: 320,

  AMR_HEADER: '#!AMR-WB\n',

  WAV_HEADER_SIZE: 44,

  RTP_HEADER_SIZE: 12,

  RTP_PAYLOAD_ID: 97,

  RTP_TOC_HEADER: 0xF0,
}

Object.assign(AMRWB, AMRWB_UTIL)

export default AMRWB

