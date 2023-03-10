import { getExtName, isAudio } from './utils'

import AMR from './amr.min.js'

import AMRWB from './amrwb-util.js'

function float32Array2Uint8Array(float32Array: any) {
  const len = float32Array.length
  const output = new Uint8Array(len)

  for (let i = 0; i < len; i++) {
    let tmp = Math.max(-1, Math.min(1, float32Array[i]))
    tmp = tmp < 0 ? tmp * 0x8000 : tmp * 0x7FFF
    tmp = tmp / 256
    output[i] = tmp + 128
  }

  return output
}

function samplesToWAV(samples: Uint8Array) {
  const out = new Uint8Array(samples.length + 44)
  let offset = 0
  const write_int16 = function (value: number) { const a = new Uint8Array(2); (new Int16Array(a.buffer))[0] = value; out.set(a, offset); offset += 2 }
  const write_int32 = function (value: number) { const a = new Uint8Array(4); (new Int32Array(a.buffer))[0] = value; out.set(a, offset); offset += 4 }
  const write_string = function (value: string) { const d = (new TextEncoder()).encode(value); out.set(d, offset); offset += d.length }
  write_string('RIFF')
  write_int32(36 + samples.length)
  write_string('WAVEfmt ')
  write_int32(16)
  const bits_per_sample = 8
  const sample_rate = 16000
  const channels = 1
  const bytes_per_frame = bits_per_sample / 8 * channels
  const bytes_per_sec = bytes_per_frame * sample_rate
  write_int16(1); write_int16(1); write_int32(sample_rate)
  write_int32(bytes_per_sec); write_int16(bytes_per_frame)
  write_int16(bits_per_sample); write_string('data')
  write_int32(samples.length)
  out.set(samples, offset)
  return out
}

export interface ConvertOpt {
  /**
     * 文件地址
     */
  url?: string
  /**
     * 二进制文件（用于文件上传）
     */
  file?: File
  /**
     * 播放器初始化的回调
     */
  /**
     *  文件类型 指定后不再通过url来判断
     */
  fileType?: string
}

export class ConvertPlayer {
  private _file
  private extName: null | string = null
  private playUrl = ''
  public audio: HTMLAudioElement | null = null
  constructor(opt: ConvertOpt) {
    if (!opt.url && !opt.file) {
      console.error('url和file参数至少需要一个')
      return
    }

    if (opt.file) {
      if (!isAudio(opt.file))
        console.error('文件类型只能是音频文件')

      this._file = opt.file
    }

    if (opt.url)
      this.playUrl = opt.url

    //  overwrite filetype
    this.extName = opt.fileType ? opt.fileType : opt.file ? getExtName(opt.file.name) : getExtName(opt.url)

    this.createPlayer()
  }

  createPlayer() {
    this.audio = document.createElement('audio')
    this.audio.controls = true
    if (this.extName === 'amr') {
      if (this._file) {
        const fr = new FileReader()
        fr.onload = (e: any) => {
          const U8Array = new Uint8Array(e.target.result)
          const headerInfo = Array.from(U8Array.slice(0, 6)).toString()
          let wavU8Array = new Uint8Array()
          if (headerInfo === '35,33,65,77,82,10') {
            wavU8Array = AMR.toWAV(U8Array)
          }
          else {
            AMRWB.decodeInit()
            const samples = AMRWB.decode(U8Array)
            AMRWB.decodeExit()
            wavU8Array = samplesToWAV(float32Array2Uint8Array(samples))
          }
          const url = URL.createObjectURL(new Blob([wavU8Array], { type: 'audio/wav' }))
          if (this.audio)
            this.audio.src = url
        }
        fr.readAsArrayBuffer(this._file)
      }
      else {
        fetch(this.playUrl).then((response) => {
          return response.arrayBuffer()
        }).then((buffer) => {
          const U8Array = new Uint8Array(buffer)
          const headerInfo = Array.from(U8Array.slice(0, 6)).toString()
          let wavU8Array = new Uint8Array()
          if (headerInfo === '35,33,65,77,82,10') {
            wavU8Array = AMR.toWAV(U8Array)
          }
          else {
            AMRWB.decodeInit()
            const samples = AMRWB.decode(U8Array)
            AMRWB.decodeExit()
            wavU8Array = samplesToWAV(float32Array2Uint8Array(samples))
          }
          const url = URL.createObjectURL(new Blob([wavU8Array], { type: 'audio/wav' }))
          if (this.audio)
            this.audio.src = url
        })
      }
    }
    else {
      if (!this.playUrl && this._file)
        this.playUrl = URL.createObjectURL(this._file)
      this.audio.src = this.playUrl
    }
  }

  mount(parent: HTMLElement) {
    this.audio && parent.appendChild(this.audio)
  }
}
