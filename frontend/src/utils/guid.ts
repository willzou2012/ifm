/** Generates a random identifier of 20 uppercase hex characters. */
export function generateGuid(): string {
  let result = ''
  for (let j = 0; j < 20; j++)
    result += Math.floor(Math.random() * 16)
      .toString(16)
      .toUpperCase()
  return result
}
