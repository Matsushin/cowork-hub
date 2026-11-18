/** 締め切り（ミリ秒）までの残り秒数。切り上げで、過ぎていたら0 */
export function secondsLeft(deadlineMs: number, nowMs: number) {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}
