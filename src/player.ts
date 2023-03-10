import BenzAMRRecorder from 'benz-amr-recorder'
import { getExtName, isAudio } from './utils'

let raf: any

/**
 * 播放器传入的参数
 * @remark
 * url和file必须有一个  同时传url会覆盖掉file参数
 */
export interface PlayerOpt {
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
  afterInit: Function
  /**
   *  文件类型 指定后不再通过url来判断
   */
  fileType?: string
}

export class AudioPlayer {
  private _file
  private extName: null | string = null
  private playUrl = ''
  private commonPlayer: HTMLAudioElement | null = null
  private amrPlayer: any = null
  private afterInit: Function | undefined
  private _onEnd: undefined | Function
  /**
   *  音频的总时间
   */
  public duration = 0
  private timeUpdateFn: Function | undefined
  private startTime = 0
  private temporary = 0
  /**
   *
   * @typeParam PlayerOpt
   *
   */
  constructor(opt: PlayerOpt) {
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

    this.afterInit = opt.afterInit

    this.createPlayer()
  }

  /**
   * @private
   */
  createPlayer() {
    if (this.extName === 'amr') {
      this.amrPlayer = new BenzAMRRecorder()
      if (this.playUrl) {
        this.amrPlayer.initWithUrl(this.playUrl).then(() => {
          this.duration = this.amrPlayer.getDuration()
          this.afterInit && this.afterInit()
          this.amrPlayer.onStop(() => {
            this._onEnd && this._onEnd()
          })
        })
      }
      else {
        this.amrPlayer.initWithBlob(this._file).then(() => {
          this.duration = this.amrPlayer.getDuration()
          this.afterInit && this.afterInit()
          this.amrPlayer.onStop(() => {
            this._onEnd && this._onEnd()
          })
        })
      }
    }
    else {
      if (!this.playUrl && this._file)
        this.playUrl = URL.createObjectURL(this._file)
      const audio = document.createElement('audio')
      audio.src = this.playUrl
      audio.onloadedmetadata = () => {
        this.duration = audio.duration
        this.commonPlayer = audio
        this.afterInit && this.afterInit()
        audio.addEventListener('timeupdate', () => {
          const now = new Date().valueOf()
          this.timeUpdateFn && this.startTime !== 0 && this.timeUpdateFn((now - this.startTime) / 1000 + this.temporary)
        })
        audio.addEventListener('ended', () => {
          this.temporary = 0
          this._onEnd && this._onEnd()
        })
        audio.addEventListener('playing', () => {
          this.startTime = new Date().valueOf()
        })
        audio.addEventListener('pause', () => {
          this.temporary += (new Date().valueOf() - this.startTime) / 1000
        })
      }
    }
  }

  /**
   *
   * @remarks
   * 播放功能
   */
  play() {
    if (this.amrPlayer && this.amrPlayer.isInit()) {
      if (this.amrPlayer.isPlaying())
        return
      raf = requestAnimationFrame(this.amrTimeUpdate.bind(this))
      this.amrPlayer.play(this.temporary)
      this.amrPlayer.onEnded(() => {
        raf && cancelAnimationFrame(raf)
      })
    }

    this.commonPlayer && this.commonPlayer.play()
  }

  /**
   * @remarks
   * 是暂停，不是停止功能
   */
  pause() {
    this.amrPlayer && this.amrPlayer.pause()
    raf && cancelAnimationFrame(raf)
    this.commonPlayer && this.commonPlayer.pause()
  }

  /**
   *
   * @param time 选择从当前时间播放
   */
  setTime(time: number) {
    this.temporary = time
    if (this.commonPlayer)
      this.commonPlayer.currentTime = time
  }

  /**
   * 销毁该播放器实例，解绑事件
   */
  destroy() {
    this.pause()
    this.amrPlayer && this.amrPlayer.stop() && this.amrPlayer.destroy()
    this.commonPlayer = null
    this.amrPlayer = null
  }

  /**
   *
   * @param fn 可传参数为当前的时间
   * @example
   * play.onTimeUpdate(time=>console.log(time))
   *
   */
  onTimeUpdate(fn: Function) {
    this.timeUpdateFn = fn
  }

  /**
   *
   * @param fn 音频播放完成的回调
   */
  onEnd(fn: Function) {
    this._onEnd = fn
  }

  /**
   * @private
   */
  amrTimeUpdate() {
    if (this.amrPlayer && this.amrPlayer.isPlaying())
      this.timeUpdateFn && this.timeUpdateFn(this.amrPlayer.getCurrentPosition())
    raf = requestAnimationFrame(this.amrTimeUpdate.bind(this))
  }
}
