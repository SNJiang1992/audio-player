import { getExtName, isAudio } from './utils'

import AMR from './amr.min.js'

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
          const wavU8Array = AMR.toWAV(new Uint8Array(e.target.result))
          const url = URL.createObjectURL(new Blob([wavU8Array], { type: 'audio/wav' }))
          if (this.audio)
            this.audio.src = url
          URL.revokeObjectURL(url)
        }
        fr.readAsArrayBuffer(this._file)
      }
      else {
        fetch(this.playUrl).then((response) => {
          return response.arrayBuffer()
        }).then((buffer) => {
          const wavU8Array = AMR.toWAV(new Uint8Array(buffer))
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
