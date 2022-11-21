import { AudioPlayer } from './player'

const uploader: HTMLInputElement | null = document.querySelector('#uploader')
const playBtn = document.querySelector('#start')
const pauseBtn = document.querySelector('#pause')
const destroyBtn = document.querySelector('#destroy')
const progressCtx: HTMLDivElement | null = document.querySelector('#progress')

let player: any
playBtn?.addEventListener('click', () => {
  player.play()
})
pauseBtn?.addEventListener('click', () => {
  player.pause()
})

uploader!.addEventListener('change', () => {
  if (uploader?.files && uploader.files.length > 0) {
    player = new AudioPlayer({
      file: uploader.files[0],
      afterInit() {

      },
    })

    destroyBtn?.addEventListener('click', () => {
      player.destroy()
    })
  }
})

player = new AudioPlayer({
  // url: 'http://127.0.0.1:5500/test.amr',
  url: 'http://127.0.0.1:5500/test.m4a',
  afterInit() {
    alert('加载完成')
    player.onTimeUpdate((time: number) => {
      const progress = time / player.duration
      render(progress)
    })
  },
})

function render(progress: number) {
  const current = progress >= 1 || (1 - progress) <= 0.01 ? '100%' : `${progress * 100}%`
  progressCtx!.style.background = `linear-gradient(to right, red ${current},white ${current})`
}

export default {}
