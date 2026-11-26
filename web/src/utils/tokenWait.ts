/**
 * AUD-037: waits for the captcha's token, but never forever. `waiting` is the list the widget's callbacks resolve;
 * if nothing answers in `ms` (the widget timed out, is not supported, or the network is stuck), the wait ends with
 * `undefined` — the services turn that into "Não conseguimos confirmar que você não é um robô" and the button frees.
 */
export function waitForToken(
  waiting: ((token: string | undefined) => void)[],
  start: () => void,
  ms: number
): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve) => {
    const timer = setTimeout(() => {
      const i = waiting.indexOf(done);
      if (i >= 0) waiting.splice(i, 1);
      resolve(undefined);
    }, ms);
    function done(token: string | undefined) {
      clearTimeout(timer);
      resolve(token);
    }
    waiting.push(done);
    start();
  });
}
