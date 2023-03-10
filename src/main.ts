// import { AudioPlayer } from './player'
import { ConvertPlayer } from './convertPlayer'

const player = new ConvertPlayer({
  url: '/test.amr',
})

player.mount(document.body)

const uploader: HTMLInputElement | null = document.querySelector('#uploader')
uploader?.addEventListener('change', () => {
  if (uploader && uploader.files && uploader.files?.length > 0) {
    const file = uploader.files[0]
    const player = new ConvertPlayer({
      file,
    })
    player.mount(document.body)
  }
})

export default {}
