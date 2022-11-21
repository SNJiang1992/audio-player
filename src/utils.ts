export function isAudio(file: File) {
  return /audio/.test(file.type)
}

export function getExtName(name: string) {
  const arr = name.split('.')
  return arr[arr.length - 1]
}
