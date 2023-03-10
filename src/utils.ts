export function isAudio(file: File) {
  return /audio/.test(file.type)
}

export function getExtName(name: string | undefined) {
  if (name === undefined)
    return null
  const matches = name.match(/.*\.([^\.\?]+)\??[^\.\?]*/)
  return matches && matches.length > 0 ? matches[1] : null
}
