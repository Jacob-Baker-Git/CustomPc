// What the build's memory actually looks like, and whether anything about it
// will cost frames. Reads only fields the catalogue already carries, so this
// works with an empty benchmark corpus.
//
// Memory affects the CPU side of a frame and the 1% lows, not the average —
// which is why it gets its own panel rather than a footnote on a frame rate.

// What each platform's memory controller is designed around. Running below this
// is a real cost; running far above it mostly is not.
//
// ⚠️ Keyed on socket AND memory type, not socket alone. LGA1700 takes both DDR4
// and DDR5, so a socket-only table judges a perfectly good DDR4-3600 kit
// against a DDR5 figure and calls it slow — advice that would push someone to
// buy memory their board cannot take. The type is what sets the ceiling.
const BASELINE = {
  'AM5|DDR5': 6000,
  'LGA1851|DDR5': 6000,
  'LGA1700|DDR5': 5600,
  'LGA1700|DDR4': 3200,
  'AM4|DDR4': 3200,
  'LGA1200|DDR4': 3000,
}

// Past this the controller decouples from the memory clock and the extra speed
// buys little or nothing — DDR5-8000 on AM5 is routinely SLOWER in games than
// 6000. Modelling it as 33% faster would be a confident, well-formatted lie.
const EFFECTIVE_CAP = {
  'AM5|DDR5': 6400,
  'LGA1851|DDR5': 7200,
  'LGA1700|DDR5': 7200,
  'LGA1700|DDR4': 4000,
  'AM4|DDR4': 3800,
  'LGA1200|DDR4': 3600,
}

const key = (socket, ramType) => `${socket}|${ramType}`

export const ramBaseline = (socket, ramType) => BASELINE[key(socket, ramType)] ?? null
export const ramEffectiveCap = (socket, ramType) => EFFECTIVE_CAP[key(socket, ramType)] ?? null

export function memoryProfile(parts) {
  const ram = parts?.ram
  const socket = parts?.cpu?.socket
  if (!ram) return null

  const sticks = ram.specs?.sticks ?? null
  const speed = ram.speed ?? null
  const type = ram.ramType ?? null
  const baseline = ramBaseline(socket, type)
  const cap = ramEffectiveCap(socket, type)
  const effective = speed && cap ? Math.min(speed, cap) : speed

  const notes = []

  // Single-channel is the big one, and it is bought by accident — a single
  // stick looks like the same amount of memory for less money, and roughly
  // halves bandwidth. It costs far more than the price difference.
  if (sticks === 1) {
    notes.push({
      severity: 'bad',
      text: 'Single stick, running in single-channel mode',
      detail: 'One stick gives the CPU about half the memory bandwidth two do. '
        + 'A second matching stick is usually the cheapest meaningful upgrade in a build, '
        + 'and it costs frames now rather than later.',
    })
  }

  if (speed && baseline && speed < baseline) {
    notes.push({
      severity: 'ok',
      text: `${type}-${speed} is below the ${baseline} this platform is built around`,
      detail: 'Memory speed sets how quickly the CPU can feed the graphics card. '
        + 'It shows up in the 1% lows more than the average frame rate.',
    })
  }

  if (speed && cap && speed > cap) {
    notes.push({
      severity: 'ok',
      text: `Above ${cap} the ${socket} memory controller decouples`,
      detail: `Rated ${speed}, but this platform stops gaining past roughly ${cap} and can `
        + 'lose performance beyond it. Nothing is wrong: you simply paid for headroom the board will not use.',
    })
  }

  return {
    capacityGb: ram.capacityGb ?? null,
    type,
    speed,
    effectiveSpeed: effective,
    sticks,
    channels: sticks === 1 ? 'single' : sticks >= 2 ? 'dual' : null,
    baseline,
    notes,
  }
}
